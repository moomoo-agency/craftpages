import { app } from 'electron'
import { timingSafeEqual } from 'crypto'
import { createServer, type IncomingMessage, type Server } from 'http'
import type { Duplex } from 'stream'
import { WebSocketServer, type WebSocket } from 'ws'
import { broadcast } from '../state'
import { onDecision, isAutoAccept } from './proposals'
import { onSelection } from './selection'
import { INSTRUCTIONS, TOOLS, type ToolContent } from './tools'
import type { McpStatus, Workspace } from '../../shared/types'

/**
 * MCP over WebSocket (JSON-RPC 2.0, one message per frame) on 127.0.0.1.
 * The app is a tool server only: the user's own AI client connects to it.
 *
 * Security: loopback only, bearer token required, and any request carrying an
 * Origin header is refused, which shuts out web pages (including DNS rebinding).
 */

const PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05']
const PATH = '/mcp'

interface Client {
  socket: WebSocket
  name: string
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
const clients = new Set<Client>()
let state = { running: false, port: 0, token: '', error: null as string | null }

export function mcpStatus(): McpStatus {
  const url = `ws://127.0.0.1:${state.port}${PATH}`
  const config = { type: 'ws', url, headers: { Authorization: `Bearer ${state.token}` } }
  return {
    running: state.running,
    port: state.port,
    url,
    token: state.token,
    clients: [...clients].map((client) => client.name),
    error: state.error,
    autoAccept: isAutoAccept(),
    // User scope so it works whatever folder Claude Code starts in; removing first
    // makes the same command safe to rerun after a token or port change.
    command: `claude mcp remove -s user craftpages 2>/dev/null; claude mcp add-json -s user craftpages '${JSON.stringify(config)}'`
  }
}

const notifyStatus = (): void => broadcast({ type: 'mcp', status: mcpStatus() })

function tokenMatches(given: string): boolean {
  const a = Buffer.from(given)
  const b = Buffer.from(state.token)
  return a.length === b.length && timingSafeEqual(a, b)
}

function refuse(socket: Duplex, status: string): void {
  socket.write(`HTTP/1.1 ${status}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`)
  socket.destroy()
}

function onUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void {
  if (req.headers.origin) return refuse(socket, '403 Forbidden')
  const url = new URL(req.url ?? '/', 'http://127.0.0.1')
  if (url.pathname !== PATH) return refuse(socket, '404 Not Found')
  const header = req.headers.authorization ?? ''
  const token = header.startsWith('Bearer ')
    ? header.slice(7).trim()
    : (url.searchParams.get('token') ?? '')
  if (!tokenMatches(token)) return refuse(socket, '401 Unauthorized')
  wss!.handleUpgrade(req, socket, head, (ws) => connected(ws))
}

function send(client: Client, message: Record<string, unknown>): void {
  if (client.socket.readyState === client.socket.OPEN) {
    client.socket.send(JSON.stringify({ jsonrpc: '2.0', ...message }))
  }
}

/** Server → client notification; clients show or log these as they see fit. */
function notifyAll(event: string, data: Record<string, unknown>): void {
  for (const client of clients) {
    send(client, {
      method: 'notifications/message',
      params: { level: 'info', logger: 'craftpages', data: { event, ...data } }
    })
  }
}

function connected(socket: WebSocket): void {
  const client: Client = { socket, name: 'AI client' }
  clients.add(client)
  notifyStatus()

  socket.on('message', (raw) => {
    let parsed: JsonRpcMessage | JsonRpcMessage[]
    try {
      parsed = JSON.parse(raw.toString())
    } catch {
      return send(client, { id: null, error: { code: -32700, message: 'Parse error' } })
    }
    for (const message of Array.isArray(parsed) ? parsed : [parsed]) {
      handle(client, message).catch(() => {})
    }
  })
  socket.on('close', () => {
    clients.delete(client)
    notifyStatus()
  })
  socket.on('error', () => socket.terminate())
}

async function handle(client: Client, message: JsonRpcMessage): Promise<void> {
  if (!message.method) return // a response to something we never ask; ignore
  const isRequest = message.id !== undefined && message.id !== null
  try {
    const result = await dispatch(client, message.method, message.params ?? {})
    if (isRequest) send(client, { id: message.id, result })
  } catch (error) {
    if (!isRequest) return
    const code = error instanceof RpcError ? error.code : -32603
    send(client, { id: message.id, error: { code, message: (error as Error).message } })
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
  wss?.close()
  wss = null
  if (http) await new Promise<void>((resolve) => http!.close(() => resolve()))
  http = null
  state = { ...state, running: false }
  notifyStatus()
}

export async function startMcp(port: number, token: string): Promise<McpStatus> {
  await stopMcp()
  state = { running: false, port, token, error: null }
  const server = createServer((_req, res) => {
    res
      .writeHead(426, { 'Content-Type': 'text/plain' })
      .end(`CraftPages MCP: connect with WebSocket to ws://127.0.0.1:${port}${PATH}\n`)
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
      maxPayload: 32 * 1024 * 1024,
      // The MCP SDK's WebSocket transport asks for the "mcp" subprotocol.
      handleProtocols: (protocols) => (protocols.has('mcp') ? 'mcp' : false)
    })
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
