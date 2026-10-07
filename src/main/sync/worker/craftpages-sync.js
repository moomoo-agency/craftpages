/**
 * craftpages-sync: the Worker CraftPages sets up in the user's own Cloudflare account so
 * several computers can share a project (see unfinished/SYNC.md).
 *
 *   R2 (BUCKET)               objects/<sha256>, snapshots/<project>/<id>.json,
 *                             projects/<project>.json (name)
 *   Durable Object (PROJECTS) one per project: the head (moved with compare-and-swap,
 *                             one request at a time) and the live WebSocket channel
 *
 * Every request carries a device key (Authorization: Bearer, or ?key= for WebSockets);
 * valid keys are the Worker's KEY_* secrets, one per computer.
 */

const json = (value, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' }
  })

const HASH = /^[0-9a-f]{64}$/
const ID = /^[0-9a-f]{8,64}$/
const SNAPSHOT = /^[\w-]{1,100}$/

/** Compares in constant time, so the key can't be guessed from response timing. */
function sameText(a, b) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function authorized(request, env) {
  const url = new URL(request.url)
  const header = request.headers.get('authorization') || ''
  const key = header.startsWith('Bearer ') ? header.slice(7) : url.searchParams.get('key') || ''
  if (key.length < 32) return false
  return Object.entries(env).some(
    ([name, value]) => name.startsWith('KEY_') && typeof value === 'string' && sameText(value, key)
  )
}

async function sha256(buffer) {
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export class Project {
  constructor(state) {
    this.state = state
  }

  async fetch(request) {
    const url = new URL(request.url)
    if (url.pathname.endsWith('/live')) {
      if (request.headers.get('upgrade') !== 'websocket')
        return json({ error: 'WebSocket only' }, 426)
      const pair = new WebSocketPair()
      this.state.acceptWebSocket(pair[1])
      pair[1].send(JSON.stringify({ type: 'presence', people: this.people() }))
      return new Response(null, { status: 101, webSocket: pair[0] })
    }
    if (request.method === 'GET') return json((await this.state.storage.get('head')) ?? null)
    if (request.method === 'POST') {
      const { expect, snapshot, device } = await request.json()
      if (!SNAPSHOT.test(snapshot || '')) return json({ error: 'Invalid snapshot id' }, 400)
      const head = (await this.state.storage.get('head')) ?? null
      if ((head?.rev ?? 0) !== expect) return json({ ok: false, head })
      const next = {
        snapshot,
        rev: expect + 1,
        at: new Date().toISOString(),
        device: String(device || '').slice(0, 100)
      }
      await this.state.storage.put('head', next)
      this.broadcast({ type: 'head', head: next })
      return json({ ok: true, head: next })
    }
    return json({ error: 'Not found' }, 404)
  }

  people() {
    return this.state
      .getWebSockets()
      .map((socket) => socket.deserializeAttachment())
      .filter(Boolean)
  }

  broadcast(message) {
    const text = JSON.stringify(message)
    for (const socket of this.state.getWebSockets()) {
      try {
        socket.send(text)
      } catch {
        // Closing: it's dropped on its own.
      }
    }
  }

  async webSocketMessage(socket, message) {
    let data
    try {
      data = JSON.parse(message)
    } catch {
      return
    }
    if (data.type !== 'presence') return
    socket.serializeAttachment({
      device: String(data.device || '').slice(0, 100),
      page: data.page ? String(data.page).slice(0, 500) : null,
      mode: data.mode ? String(data.mode).slice(0, 20) : null,
      at: new Date().toISOString()
    })
    this.broadcast({ type: 'presence', people: this.people() })
  }

  async webSocketClose(socket) {
    socket.serializeAttachment(null)
    this.broadcast({ type: 'presence', people: this.people() })
  }
}

export default {
  async fetch(request, env) {
    if (!authorized(request, env)) return json({ error: 'Not authorized' }, 401)
    const url = new URL(request.url)
    const parts = url.pathname.split('/').filter(Boolean)
    const method = request.method

    // GET /projects
    if (parts[0] === 'projects' && parts.length === 1 && method === 'GET') {
      const listed = await env.BUCKET.list({ prefix: 'projects/' })
      const projects = []
      for (const object of listed.objects) {
        const id = object.key.slice('projects/'.length).replace(/\.json$/, '')
        if (!ID.test(id)) continue
        const info = await (await env.BUCKET.get(object.key))?.json().catch(() => null)
        const head = await env.PROJECTS.get(env.PROJECTS.idFromName(id)).fetch('https://do/head')
        const current = await head.json()
        projects.push({
          id,
          name: info?.name ?? id,
          at: current?.at ?? null,
          device: current?.device ?? null
        })
      }
      return json(projects)
    }

    if (parts[0] === 'projects' && ID.test(parts[1] || '')) {
      const id = parts[1]
      // PUT /projects/:id (name)
      if (parts.length === 2 && method === 'PUT') {
        const { name } = await request.json()
        await env.BUCKET.put(
          `projects/${id}.json`,
          JSON.stringify({ name: String(name).slice(0, 200) })
        )
        return json({ ok: true })
      }
      // GET|POST /projects/:id/head, GET /projects/:id/live
      if (parts.length === 3 && (parts[2] === 'head' || parts[2] === 'live')) {
        const stub = env.PROJECTS.get(env.PROJECTS.idFromName(id))
        return stub.fetch(new Request(`https://do/${parts[2]}`, request))
      }
      // PUT|GET /projects/:id/snapshots/:sid
      if (parts.length === 4 && parts[2] === 'snapshots' && SNAPSHOT.test(parts[3])) {
        const key = `snapshots/${id}/${parts[3]}.json`
        if (method === 'PUT') {
          await env.BUCKET.put(key, await request.text())
          return json({ ok: true })
        }
        const object = await env.BUCKET.get(key)
        return object
          ? new Response(object.body, { headers: { 'content-type': 'application/json' } })
          : json(null, 404)
      }
    }

    // POST /objects/missing { hashes }
    if (parts[0] === 'objects' && parts[1] === 'missing' && method === 'POST') {
      const { hashes } = await request.json()
      const list = (Array.isArray(hashes) ? hashes : [])
        .filter((hash) => HASH.test(hash))
        .slice(0, 1000)
      const found = await Promise.all(list.map((hash) => env.BUCKET.head(`objects/${hash}`)))
      return json(list.filter((_, index) => !found[index]))
    }

    // PUT|GET /objects/:hash
    if (parts[0] === 'objects' && HASH.test(parts[1] || '') && parts.length === 2) {
      const key = `objects/${parts[1]}`
      if (method === 'PUT') {
        const body = await request.arrayBuffer()
        if ((await sha256(body)) !== parts[1])
          return json({ error: 'Content does not match its hash' }, 400)
        await env.BUCKET.put(key, body)
        return json({ ok: true })
      }
      const object = await env.BUCKET.get(key)
      return object ? new Response(object.body) : json({ error: 'Not found' }, 404)
    }

    return json({ error: 'Not found' }, 404)
  }
}
