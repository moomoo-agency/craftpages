// CraftPages MCP over stdio, for AI clients that only start local commands (Claude Desktop
// and older tools). It passes each JSON-RPC line from stdin to the app's Streamable HTTP
// endpoint and writes the answers to stdout, one per line. The app must be running.
//
// Run by the app's own binary in Node mode, so nothing else needs installing:
//   ELECTRON_RUN_AS_NODE=1 CRAFTPAGES_MCP_URL=http://127.0.0.1:7424/mcp \
//   CRAFTPAGES_MCP_TOKEN=… <CraftPages binary> craftpages-mcp.mjs
// Settings → AI shows the ready-made client entry.

import { createInterface } from 'node:readline'

const url = process.env.CRAFTPAGES_MCP_URL || 'http://127.0.0.1:7424/mcp'
const token = process.env.CRAFTPAGES_MCP_TOKEN || ''
let session = ''
let version = ''

const write = (message) => process.stdout.write(JSON.stringify(message) + '\n')
const fail = (id, message) => write({ jsonrpc: '2.0', id, error: { code: -32000, message } })

async function forward(line) {
  let message
  try {
    message = JSON.parse(line)
  } catch {
    return write({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } })
  }
  const ids = (Array.isArray(message) ? message : [message])
    .filter((m) => m && m.id !== undefined && m.method)
    .map((m) => m.id)
  let res
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: `Bearer ${token}`,
        ...(session ? { 'Mcp-Session-Id': session } : {}),
        ...(version ? { 'MCP-Protocol-Version': version } : {})
      },
      body: line
    })
  } catch {
    for (const id of ids)
      fail(id, `CraftPages isn't running (nothing answers at ${url}). Open it and try again.`)
    return
  }
  session = res.headers.get('mcp-session-id') || session
  if (res.status === 202) return
  const text = await res.text()
  if (!res.ok) {
    const reason =
      res.status === 401
        ? 'CraftPages refused the token. Copy the entry again from Settings → AI.'
        : `CraftPages answered ${res.status}: ${text.trim()}`
    for (const id of ids) fail(id, reason)
    return
  }
  const answer = JSON.parse(text)
  for (const reply of Array.isArray(answer) ? answer : [answer]) {
    if (reply?.result?.protocolVersion) version = reply.result.protocolVersion
    write(reply)
  }
}

// One at a time, in order: initialize has to finish before the session id is known.
let queue = Promise.resolve()
const lines = createInterface({ input: process.stdin })
lines.on('line', (line) => {
  if (!line.trim()) return
  queue = queue.then(() => forward(line)).catch((error) => process.stderr.write(`${error}\n`))
})
lines.on('close', () => {
  queue.then(async () => {
    if (session) {
      await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'Mcp-Session-Id': session }
      }).catch(() => {})
    }
    process.exit(0)
  })
})
