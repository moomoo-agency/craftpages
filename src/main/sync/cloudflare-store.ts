import WebSocket from 'ws'
import { call, inBatches, type Credentials } from '../deploy/cloudflare'
import { workerUrl } from '../deploy/workers'
import { checkSnapshot, type Snapshot } from './snapshots'
import type { LiveChannel, LiveEvent, RemoteHead, SyncProject, SyncStore } from './store'
import workerSource from './worker/craftpages-sync.js?raw'

/**
 * Sync through the user's own Cloudflare account: one Worker (craftpages-sync) with an
 * R2 bucket and a Durable Object per project, set up by the app. Each computer has its
 * own key, stored as a Worker secret here and in that computer's keychain.
 */

export const SYNC_WORKER = 'craftpages-sync'
/**
 * Raise when the Worker's code changes: computers on a newer app update it on their next
 * sync (if their token may), and the older Worker keeps working until then.
 */
export const SYNC_WORKER_VERSION = 1
export const SYNC_BUCKET = 'craftpages-sync'
const COMPATIBILITY_DATE = '2025-09-01'
const UPLOADS = 6

const account = (creds: Credentials): string => `/accounts/${encodeURIComponent(creds.accountId)}`

/** Cloudflare's errors for the things setup needs, in plain words. */
function setupError(error: unknown): Error {
  const message = (error as Error).message
  if (/10042|enable R2|R2 is not enabled|purchase/i.test(message))
    return new Error(
      'R2 storage isn’t turned on for this Cloudflare account yet. Open Cloudflare → R2 Object Storage once and enable it (the free tier is enough), then try again.'
    )
  if (/R2|buckets/i.test(message) && /permission|not authorized|10000/i.test(message))
    return new Error(
      'The API token can’t manage R2. Add Account · Workers R2 Storage · Edit to it (Cloudflare → My Profile → API Tokens).'
    )
  return error as Error
}

/**
 * Creates (or updates) the sync Worker and its bucket, and registers this computer's
 * key. Safe to run again: another computer joining runs the same steps.
 */
export async function setupCloudflareSync(
  creds: Credentials,
  device: { id: string; key: string }
): Promise<string> {
  try {
    await call(creds.token, `${account(creds)}/r2/buckets`, {
      method: 'POST',
      body: JSON.stringify({ name: SYNC_BUCKET })
    }).catch((error: Error) => {
      // Already there from an earlier setup or another computer.
      if (!/10004|already exists|already own/i.test(error.message)) throw error
    })

    const upload = async (withMigration: boolean): Promise<void> => {
      const metadata = {
        main_module: 'worker.js',
        compatibility_date: COMPATIBILITY_DATE,
        bindings: [
          { type: 'r2_bucket', name: 'BUCKET', bucket_name: SYNC_BUCKET },
          { type: 'durable_object_namespace', name: 'PROJECTS', class_name: 'Project' }
        ],
        // Secrets set earlier (other computers' keys) stay.
        keep_bindings: ['secret_text'],
        tags: ['craftpages'],
        ...(withMigration ? { migrations: { new_tag: 'v1', new_sqlite_classes: ['Project'] } } : {})
      }
      const form = new FormData()
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
      form.append(
        'worker.js',
        new File([workerSource], 'worker.js', { type: 'application/javascript+module' }),
        'worker.js'
      )
      await call(creds.token, `${account(creds)}/workers/scripts/${SYNC_WORKER}`, {
        method: 'PUT',
        body: form
      })
    }
    // The Durable Object class is created by a migration, once; later uploads must not repeat it.
    await upload(true).catch(async (error: Error) => {
      if (!/migration|tag/i.test(error.message)) throw error
      await upload(false)
    })

    await call(creds.token, `${account(creds)}/workers/scripts/${SYNC_WORKER}/secrets`, {
      method: 'PUT',
      body: JSON.stringify({ name: `KEY_${device.id}`, text: device.key, type: 'secret_text' })
    })
    await call(creds.token, `${account(creds)}/workers/scripts/${SYNC_WORKER}/subdomain`, {
      method: 'POST',
      body: JSON.stringify({ enabled: true, previews_enabled: false })
    }).catch(() => null)
    const url = await workerUrl(creds, SYNC_WORKER)
    if (!url)
      throw new Error(
        'The account has no workers.dev subdomain yet. Open Cloudflare → Workers & Pages once to get one, then try again.'
      )
    return url
  } catch (error) {
    throw setupError(error)
  }
}

/** Talks to a sync Worker: its URL and this computer's key. */
async function fetchJson<T>(url: string, key: string, init: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${key}`,
        ...(typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers
      }
    })
  } catch {
    throw new Error('Can’t reach the sync Worker. Check the internet connection.')
  }
  if (response.status === 401)
    throw new Error(
      'The sync Worker doesn’t know this computer’s key. Set up sync again in Project settings → Sync.'
    )
  if (response.status === 404 && init.method !== 'PUT') return null as T
  if (!response.ok) throw new Error(`Sync Worker: HTTP ${response.status} ${await response.text()}`)
  return (await response.json()) as T
}

export async function listCloudflareProjects(url: string, key: string): Promise<SyncProject[]> {
  return (await fetchJson<SyncProject[]>(`${url}/projects`, key)) ?? []
}

export function openCloudflareStore(url: string, key: string, project: string): SyncStore {
  if (!/^[0-9a-f]{8,64}$/.test(project)) throw new Error('Invalid project id')
  const base = `${url}/projects/${project}`
  return {
    getHead: () => fetchJson<RemoteHead | null>(`${base}/head`, key),
    moveHead: (expect, snapshot, device) =>
      fetchJson(`${base}/head`, key, {
        method: 'POST',
        body: JSON.stringify({ expect, snapshot, device })
      }),
    missing: async (hashes) => {
      const out: string[] = []
      for (let i = 0; i < hashes.length; i += 1000)
        out.push(
          ...(await fetchJson<string[]>(`${url}/objects/missing`, key, {
            method: 'POST',
            body: JSON.stringify({ hashes: hashes.slice(i, i + 1000) })
          }))
        )
      return out
    },
    putObject: async (hash, data) => {
      await fetchJson(`${url}/objects/${hash}`, key, { method: 'PUT', body: new Uint8Array(data) })
    },
    getObject: async (hash) => {
      const response = await fetch(`${url}/objects/${hash}`, {
        headers: { Authorization: `Bearer ${key}` }
      })
      if (!response.ok) throw new Error(`The sync store is missing a file (${hash.slice(0, 12)}…).`)
      return Buffer.from(await response.arrayBuffer())
    },
    putSnapshot: async (snapshot) => {
      await fetchJson(`${base}/snapshots/${snapshot.id}`, key, {
        method: 'PUT',
        body: JSON.stringify(snapshot)
      })
    },
    getSnapshot: async (id) => {
      const snapshot = await fetchJson<Snapshot | null>(`${base}/snapshots/${id}`, key)
      return snapshot && checkSnapshot(snapshot)
    },
    putInfo: async (info) => {
      await fetchJson(base, key, { method: 'PUT', body: JSON.stringify(info) })
    },
    live: (onEvent) => cloudflareLive(`${base}/live`, key, onEvent),
    close: async () => undefined
  }
}

/** Uploads several objects at a time. */
export async function putObjects(
  store: SyncStore,
  items: string[],
  read: (hash: string) => Promise<Buffer>,
  onProgress: (done: number) => void
): Promise<void> {
  let done = 0
  await inBatches(items, UPLOADS, async (hash) => {
    await store.putObject(hash, await read(hash))
    onProgress(++done)
  })
}

/** The live channel: a WebSocket to the project's Durable Object, reconnecting as needed. */
function cloudflareLive(
  url: string,
  key: string,
  onEvent: (event: LiveEvent) => void
): LiveChannel {
  let socket: WebSocket | null = null
  let mine: string | null = null
  let stopped = false
  let delay = 1000
  let timer: ReturnType<typeof setTimeout> | null = null
  let ping: ReturnType<typeof setInterval> | null = null

  const connect = (): void => {
    if (stopped) return
    const ws = new WebSocket(`${url.replace(/^http/, 'ws')}?key=${encodeURIComponent(key)}`)
    socket = ws
    ws.on('open', () => {
      delay = 1000
      if (mine) ws.send(mine)
      // Keeps the connection open through proxies; the Durable Object stays hibernated.
      ping = setInterval(() => ws.readyState === WebSocket.OPEN && ws.ping(), 30_000)
    })
    ws.on('message', (data) => {
      try {
        onEvent(JSON.parse(String(data)) as LiveEvent)
      } catch {
        // Not ours.
      }
    })
    const retry = (): void => {
      if (ping) clearInterval(ping)
      if (stopped || socket !== ws) return
      socket = null
      timer = setTimeout(connect, delay)
      delay = Math.min(delay * 2, 60_000)
    }
    ws.on('close', retry)
    ws.on('error', () => ws.close())
  }
  connect()

  return {
    announce: (presence) => {
      mine = JSON.stringify({ type: 'presence', ...presence })
      if (socket?.readyState === WebSocket.OPEN) socket.send(mine)
    },
    close: () => {
      stopped = true
      if (timer) clearTimeout(timer)
      if (ping) clearInterval(ping)
      socket?.close()
    }
  }
}
