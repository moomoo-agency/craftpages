import { app } from 'electron'
import { randomBytes, timingSafeEqual } from 'crypto'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'http'
import type { Duplex } from 'stream'
import { WebSocketServer, type WebSocket } from 'ws'
import { broadcast } from '../state'
import { onDecision, isAutoAccept } from './proposals'
import { onSelection } from './selection'
import { INSTRUCTIONS, TOOLS, type ToolContent } from './tools'
import type { McpStatus, Workspace } from '../../shared/types'
import stdioShim from '../../../resources/craftpages-mcp.mjs?asset&asarUnpack'

/**
 * MCP on 127.0.0.1, over two transports that share one dispatcher:
 * - WebSocket (JSON-RPC 2.0, one message per frame): Claude Code.
 * - Streamable HTTP (POST /mcp, JSON responses, no server stream): Codex, Cursor and most others.
 * The app is a tool server only: the user's own AI client connects to it.
 *
 * Security: loopback only, bearer token on every request, any request carrying an
 * Origin header is refused (shuts out web pages), and the Host must be loopback
 * (shuts out DNS rebinding).
 */

const PROTOCOL_VERSIONS = ['2025-06-18', '2025-11-25', '2025-03-26', '2024-11-05']
const PATH = '/mcp'
const MAX_MESSAGE = 32 * 1024 * 1024
/** HTTP sessions are kept this long after their last request, so a client keeps its name. */
const SESSION_TTL = 24 * 60 * 60 * 1000
/** …but only listed as connected while they were used this recently. */
const SESSION_ACTIVE = 10 * 60 * 1000
const MAX_SESSIONS = 100

interface Client {
  name: string
  /** Server → client messages. HTTP clients have no stream, so notifications skip them. */
  push?: (message: Record<string, unknown>) => void
}

interface WsClient extends Client {
  socket: WebSocket
}

interface Session extends Client {
  lastSeen: number
}

interface JsonRpcMessage {
  jsonrpc: '2.0'
  id?: string | number | null
  method?: string
  params?: Record<string, unknown>
}

class RpcError extends Error {
  constructor(
    readonly code: number,
    message: string
  ) {
    super(message)
  }
}

let http: Server | null = null
let wss: WebSocketServer | null = null
let sweeper: NodeJS.Timeout | null = null
const clients = new Set<WsClient>()
const sessions = new Map<string, Session>()
let state = { running: false, port: 0, token: '', error: null as string | null }

function clientNames(): string[] {
  const since = Date.now() - SESSION_ACTIVE
  return [
    ...[...clients].map((client) => client.name),
    ...[...sessions.values()].filter((s) => s.lastSeen >= since).map((s) => s.name)
  ]
}

export function mcpStatus(): McpStatus {
  const url = `ws://127.0.0.1:${state.port}${PATH}`
  const httpUrl = `http://127.0.0.1:${state.port}${PATH}`
  const config = { type: 'ws', url, headers: { Authorization: `Bearer ${state.token}` } }
  return {
    running: state.running,
    port: state.port,
    url,
    httpUrl,
    token: state.token,
    clients: clientNames(),
    error: state.error,
    autoAccept: isAutoAccept(),
    // User scope so it works whatever folder Claude Code starts in; removing first
    // makes the same command safe to rerun after a token or port change.
    command: `claude mcp remove -s user craftpages 2>/dev/null; claude mcp add-json -s user craftpages '${JSON.stringify(config)}'`,
    // The token rides in the URL: Codex can't set a fixed header from the command line,
    // and an env var would have to be set in every shell Codex starts from.
    codexCommand: `codex mcp remove craftpages >/dev/null 2>&1; codex mcp add craftpages --url '${httpUrl}?token=${state.token}'`,
    httpConfig: JSON.stringify(
      { craftpages: { url: httpUrl, headers: { Authorization: `Bearer ${state.token}` } } },
      null,
      2
    ),
    // The app's own binary runs the stdio bridge in Node mode, so no Node install is needed.
    stdioConfig: JSON.stringify(
      {
        mcpServers: {
          craftpages: {
            command: process.execPath,
            args: [stdioShim],
            env: {
              ELECTRON_RUN_AS_NODE: '1',
              CRAFTPAGES_MCP_URL: httpUrl,
              CRAFTPAGES_MCP_TOKEN: state.token
            }
          }
        }
      },
      null,
      2
    )
  }
}

const notifyStatus = (): void => broadcast({ type: 'mcp', status: mcpStatus() })

function tokenMatches(given: string): boolean {
  const a = Buffer.from(given)
  const b = Buffer.from(state.token)
  return a.length === b.length && timingSafeEqual(a, b)
}

/** Why a request is refused before it reaches MCP, or null when it may go on. */
function gate(req: IncomingMessage): [number, string] | null {
  if (req.headers.origin) return [403, 'Forbidden']
  const host = (req.headers.host ?? '').toLowerCase()
  if (!/^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(host)) return [403, 'Forbidden']
  const url = new URL(req.url ?? '/', 'http://127.0.0.1')
  if (url.pathname !== PATH) return [404, 'Not Found']
  const header = req.headers.authorization ?? ''
  const token = header.startsWith('Bearer ')
    ? header.slice(7).trim()
    : (url.searchParams.get('token') ?? '')
  if (!tokenMatches(token)) return [401, 'Unauthorized']
  return null
}

// ---------- WebSocket ----------

function onUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void {
  const refused = gate(req)
  if (refused) {
    socket.write(
      `HTTP/1.1 ${refused[0]} ${refused[1]}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`
    )
    socket.destroy()
    return
  }
  wss!.handleUpgrade(req, socket, head, (ws) => connected(ws))
}

function wsSend(socket: WebSocket, message: Record<string, unknown>): void {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify({ jsonrpc: '2.0', ...message }))
}

function connected(socket: WebSocket): void {
  const client: WsClient = {
    socket,
    name: 'AI client',
    push: (message) => wsSend(socket, message)
  }
  clients.add(client)
  notifyStatus()
  socket.on('message', (raw) => {
    let parsed: JsonRpcMessage | JsonRpcMessage[]
    try {
      parsed = JSON.parse(raw.toString())
    } catch {
      return wsSend(socket, { id: null, error: { code: -32700, message: 'Parse error' } })
    }
    for (const message of Array.isArray(parsed) ? parsed : [parsed]) {
      handle(client, message)
        .then((response) => response && wsSend(socket, response))
        .catch(() => {})
    }
  })
  socket.on('close', () => {
    clients.delete(client)
    notifyStatus()
  })
  socket.on('error', () => socket.terminate())
}

// ---------- Streamable HTTP ----------

function reply(
  res: ServerResponse,
  status: number,
  body?: unknown,
  headers: Record<string, string> = {}
): void {
  if (body === undefined) {
    res.writeHead(status, { 'Content-Length': '0', ...headers }).end()
    return
  }
  const data = Buffer.from(typeof body === 'string' ? body : JSON.stringify(body))
  res
    .writeHead(status, {
      'Content-Type': typeof body === 'string' ? 'text/plain' : 'application/json',
      'Content-Length': String(data.length),
      ...headers
    })
    .end(data)
}

function readBody(req: IncomingMessage): Promise<Buffer | null> {
  return new Promise((resolve, reject) => {
    if (Number(req.headers['content-length'] ?? 0) > MAX_MESSAGE) return resolve(null)
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_MESSAGE) {
        req.removeAllListeners('data')
        resolve(null)
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

const rpcError = (code: number, message: string): Record<string, unknown> => ({
  jsonrpc: '2.0',
  id: null,
  error: { code, message }
})

function newSession(id: string): Session {
  if (sessions.size >= MAX_SESSIONS) {
    const oldest = [...sessions.entries()].sort((a, b) => a[1].lastSeen - b[1].lastSeen)[0]
    sessions.delete(oldest[0])
  }
  const session: Session = { name: 'AI client', lastSeen: Date.now() }
  sessions.set(id, session)
  return session
}

async function onRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const refused = gate(req)
  if (refused) {
    const [status, text] = refused
    return reply(
      res,
      status,
      status === 404 ? `CraftPages MCP: use http://127.0.0.1:${state.port}${PATH}\n` : `${text}\n`
    )
  }
  const sessionId = String(req.headers['mcp-session-id'] ?? '')
  if (req.method === 'DELETE') {
    const known = sessions.delete(sessionId)
    if (known) notifyStatus()
    return reply(res, known ? 200 : 404)
  }
  // No server-initiated stream: every tool answers within its POST.
  if (req.method !== 'POST') return reply(res, 405, undefined, { Allow: 'POST, DELETE' })

  const version = req.headers['mcp-protocol-version']
  if (typeof version === 'string' && !PROTOCOL_VERSIONS.includes(version)) {
    return reply(res, 400, rpcError(-32600, `Unsupported MCP-Protocol-Version: ${version}`))
  }
  const body = await readBody(req)
  if (!body) return reply(res, 413, rpcError(-32600, 'Message too large'), { Connection: 'close' })
  let parsed: JsonRpcMessage | JsonRpcMessage[]
  try {
    parsed = JSON.parse(body.toString('utf8'))
  } catch {
    return reply(res, 400, rpcError(-32700, 'Parse error'))
  }
  const messages = Array.isArray(parsed) ? parsed : [parsed]
  if (!messages.length || messages.some((m) => !m || typeof m !== 'object')) {
    return reply(res, 400, rpcError(-32600, 'Invalid request'))
  }

  // initialize starts a session. A session the app no longer knows (it was restarted) is taken
  // up again under the client's id rather than refused: some clients don't re-initialize on 404.
  const headers: Record<string, string> = {}
  let session: Session
  const listedBefore = clientNames().length
  if (messages.some((m) => m.method === 'initialize')) {
    const id = randomBytes(16).toString('hex')
    session = newSession(id)
    headers['Mcp-Session-Id'] = id
  } else if (/^[\x21-\x7e]{1,128}$/.test(sessionId)) {
    session = sessions.get(sessionId) ?? newSession(sessionId)
  } else {
    // Sessionless client: served, but not listed.
    session = { name: 'AI client', lastSeen: Date.now() }
  }
  session.lastSeen = Date.now()
  if (clientNames().length !== listedBefore) notifyStatus()

  const responses = (await Promise.all(messages.map((m) => handle(session, m)))).filter(
    (r): r is Record<string, unknown> => r !== null
  )
  if (!responses.length) return reply(res, 202, undefined, headers)
  const wrapped = responses.map((r) => ({ jsonrpc: '2.0', ...r }))
  reply(res, 200, Array.isArray(parsed) ? wrapped : wrapped[0], headers)
}

/** Forgets idle HTTP sessions and drops them from the "connected" list once they go quiet. */
function sweep(): void {
  const before = clientNames().join('\n')
  const expired = Date.now() - SESSION_TTL
  for (const [id, session] of sessions) if (session.lastSeen < expired) sessions.delete(id)
  if (clientNames().join('\n') !== before) notifyStatus()
}

// ---------- Shared ----------

/** Server → client notification; clients show or log these as they see fit. */
function notifyAll(event: string, data: Record<string, unknown>): void {
  for (const client of clients) {
    client.push?.({
      method: 'notifications/message',
      params: { level: 'info', logger: 'craftpages', data: { event, ...data } }
    })
  }
}

/** The response to a message, or null for notifications and responses. */
async function handle(
  client: Client,
  message: JsonRpcMessage
): Promise<Record<string, unknown> | null> {
  if (!message.method) return null // a response to something we never ask; ignore
  const isRequest = message.id !== undefined && message.id !== null
  try {
    const result = await dispatch(client, message.method, message.params ?? {})
    return isRequest ? { id: message.id, result } : null
  } catch (error) {
    if (!isRequest) return null
    const code = error instanceof RpcError ? error.code : -32603
    return { id: message.id, error: { code, message: (error as Error).message } }
  }
}

async function dispatch(
  client: Client,
  method: string,
  params: Record<string, unknown>
): Promise<unknown> {
  switch (method) {
    case 'initialize': {
      const info = params.clientInfo as { name?: string; version?: string } | undefined
      if (info?.name) {
        client.name = info.version ? `${info.name} ${info.version}` : info.name
        notifyStatus()
      }
      const requested = String(params.protocolVersion ?? '')
      return {
        protocolVersion: PROTOCOL_VERSIONS.includes(requested) ? requested : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false }, logging: {} },
        serverInfo: { name: 'craftpages', title: 'CraftPages', version: app.getVersion() },
        instructions: INSTRUCTIONS
      }
    }

    case 'ping':
    case 'logging/setLevel':
      return {}

    case 'tools/list':
      return {
        tools: TOOLS.map(({ name, description, inputSchema, annotations }) => ({
          name,
          description,
          inputSchema,
          ...(annotations ? { annotations } : {})
        }))
      }

    case 'tools/call': {
      const tool = TOOLS.find((t) => t.name === params.name)
      if (!tool) throw new RpcError(-32602, `Unknown tool: ${String(params.name)}`)
      try {
        const output = await tool.run((params.arguments as Record<string, unknown>) ?? {}, {
          client: client.name
        })
        const content: ToolContent[] =
          typeof output === 'string' ? [{ type: 'text', text: output }] : output
        return { content }
      } catch (error) {
        // Tool failures are results the model can read and react to, not protocol errors.
        return { content: [{ type: 'text', text: (error as Error).message }], isError: true }
      }
    }

    default:
      if (method.startsWith('notifications/')) return undefined
      throw new RpcError(-32601, `Method not found: ${method}`)
  }
}

export async function stopMcp(): Promise<void> {
  for (const client of clients) client.socket.close(1001, 'Server stopping')
  clients.clear()
  sessions.clear()
  if (sweeper) clearInterval(sweeper)
  sweeper = null
  wss?.close()
  wss = null
  if (http) {
    const server = http
    await new Promise<void>((resolve) => {
      server.close(() => resolve())
      server.closeAllConnections()
    })
  }
  http = null
  state = { ...state, running: false }
  notifyStatus()
}

export async function startMcp(port: number, token: string): Promise<McpStatus> {
  await stopMcp()
  state = { running: false, port, token, error: null }
  const server = createServer((req, res) => {
    onRequest(req, res).catch((error: Error) => {
      if (!res.headersSent) reply(res, 500, rpcError(-32603, error.message))
      else res.destroy()
    })
  })
  server.on('upgrade', onUpgrade)
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(port, '127.0.0.1', () => resolve())
    })
    http = server
    wss = new WebSocketServer({
      noServer: true,
      maxPayload: MAX_MESSAGE,
      // The MCP SDK's WebSocket transport asks for the "mcp" subprotocol.
      handleProtocols: (protocols) => (protocols.has('mcp') ? 'mcp' : false)
    })
    sweeper = setInterval(sweep, 60 * 1000)
    sweeper.unref()
    state.running = true
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    state.error =
      code === 'EADDRINUSE'
        ? `Port ${port} is already in use. Pick another in Settings.`
        : (error as Error).message
  }
  notifyStatus()
  return mcpStatus()
}

export function setToken(token: string): void {
  state.token = token
  // Clients authenticated with the old token are dropped.
  for (const client of clients) client.socket.close(4001, 'Token changed')
  sessions.clear()
  notifyStatus()
}

onSelection((selection) => {
  if (selection) notifyAll('selection', { ...selection })
})

onDecision((proposal) => {
  notifyAll('proposal_decided', {
    id: proposal.id,
    title: proposal.title,
    status: proposal.status,
    reason: proposal.reason
  })
})

/** Tells connected AI clients that the user opened another project; their earlier reads are void. */
export function notifyProjectSwitched(workspace: Workspace | null): void {
  notifyAll('project_switched', {
    project: workspace?.folder ?? null,
    note: 'The user switched projects. Call site_info again; proposals must name the new project.'
  })
}

export { notifyStatus as broadcastMcpStatus }
