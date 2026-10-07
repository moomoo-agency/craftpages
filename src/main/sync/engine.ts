import { randomBytes } from 'crypto'
import { mkdir, readFile, rm, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import {
  collect,
  r2Access,
  rememberPublished,
  saveState,
  type Credentials
} from '../deploy/cloudflare'
import { flushDrafts, reloadDrafts } from '../drafts'
import { writeFiles, type FileWrite } from '../history'
import {
  APP_DIR,
  connectionById,
  connectionForHint,
  getSiteSettings,
  getSyncSecret,
  setSyncSecret,
  syncDeviceId,
  trustHostKey
} from '../settings'
import { broadcast, getWorkspace } from '../state'
import {
  listCloudflareProjects,
  openCloudflareStore,
  putObjects,
  setupCloudflareSync,
  SYNC_WORKER_VERSION
} from './cloudflare-store'
import { listServerProjects, openServerStore, serverLive } from './server-store'
import {
  chain,
  createSnapshot,
  deviceName,
  hasObject,
  hasSnapshot,
  readHead,
  readObject,
  readSnapshot,
  sameContent,
  scan,
  setHead,
  storeObject,
  storeSnapshot,
  type Snapshot
} from './snapshots'
import type { LiveChannel, LiveEvent, RemoteHead, SyncStore } from './store'
import type {
  SiteSettings,
  SyncPresence,
  SyncProjectView,
  SyncResult,
  SyncSetup,
  SyncSource,
  SyncStatus
} from '../../shared/types'
import { isServerConnection } from '../../shared/types'

/**
 * Sync between computers (unfinished/SYNC.md): pull what others synced, merge it into
 * the folder file by file, then push this folder's work and move the shared head with
 * compare-and-swap. Settings are per computer, in `.sitecms/sync.json` (never synced).
 */

interface SyncConfig {
  mode: 'cloudflare' | 'server'
  connection: string
  /** Server: the sync folder. */
  dir: string
  /** Cloudflare: the sync Worker's address. */
  url: string
  /** The last version this folder and the store agreed on. */
  base: string | null
  rev: number
  lastSync: string | null
  /** Files changed on both sides at the last sync. */
  conflicts: string[]
  /** Cloudflare: the version of the sync Worker this computer last set up. */
  workerVersion?: number
}

const configFile = (root: string): string => join(root, APP_DIR, 'sync.json')
const conflictDir = (root: string): string => join(root, APP_DIR, 'conflicts')

async function readConfig(root: string): Promise<SyncConfig | null> {
  try {
    return JSON.parse(await readFile(configFile(root), 'utf8')) as SyncConfig
  } catch {
    return null
  }
}

async function writeConfig(root: string, config: SyncConfig | null): Promise<void> {
  if (!config) return rm(configFile(root), { force: true })
  await mkdir(dirname(configFile(root)), { recursive: true })
  await writeFile(configFile(root), JSON.stringify(config, null, 2))
}

export async function isSyncOn(root: string): Promise<boolean> {
  return (await readConfig(root)) !== null
}

// ---------- Opening a store ----------

/** The secret a store needs: Cloudflare = this computer's key for that account. */
const cloudflareSecret = (accountId: string): string => `cloudflare:${accountId}`
const serverSecret = (project: string): string => `server:${project}`

async function cloudflareKey(creds: Credentials): Promise<string> {
  const name = cloudflareSecret(creds.accountId)
  let key = await getSyncSecret(name)
  if (!key) {
    key = randomBytes(32).toString('base64url')
    await setSyncSecret(name, key)
  }
  return key
}

/** The sync Worker's address, set up at most once per account while the app runs. */
const workerUrls = new Map<string, string>()

/**
 * Sets up (or reuses) the sync Worker in a Cloudflare account. The token must reach R2:
 * publishing never needed that, so older tokens get a plain explanation instead of an
 * API error.
 */
async function ensureWorker(creds: Credentials): Promise<string> {
  const known = workerUrls.get(creds.accountId)
  if (known) return known
  const r2 = await r2Access(creds)
  if (r2 === 'disabled')
    throw new Error(
      'R2 storage isn’t turned on in this Cloudflare account yet. Turn it on once in Cloudflare → R2 Object Storage (the free tier is enough), then try again.'
    )
  if (r2 === 'missing')
    throw new Error(
      'This connection’s API token can publish, but sync between computers also needs Account · Workers R2 Storage · Edit. Update the token in App settings → Deploy connections.'
    )
  const url = await setupCloudflareSync(creds, {
    id: await syncDeviceId(),
    key: await cloudflareKey(creds)
  })
  workerUrls.set(creds.accountId, url)
  return url
}

async function openStoreFor(
  source: SyncSource & { url?: string },
  project: string
): Promise<SyncStore> {
  const connection = await connectionById(source.connection)
  if (source.mode === 'cloudflare') {
    if (isServerConnection(connection.type))
      throw new Error('Choose a Cloudflare connection for sync.')
    if (!source.url) throw new Error('Sync isn’t set up on this computer yet.')
    return openCloudflareStore(source.url, await cloudflareKey(connection), project)
  }
  if (!isServerConnection(connection.type))
    throw new Error('Choose an FTP or SFTP connection for sync.')
  const passphrase = source.passphrase ?? (await getSyncSecret(serverSecret(project)))
  if (!passphrase)
    throw new Error('The sync passphrase is missing on this computer. Turn sync on again.')
  return openServerStore(connection, source.dir ?? '', passphrase, project, (key) => {
    trustHostKey(connection.id, key).catch(() => null)
  })
}

async function openStore(root: string, config: SyncConfig): Promise<SyncStore> {
  const site = await getSiteSettings(root)
  return openStoreFor(config, site.id)
}

// ---------- Pull ----------

/** Fetches snapshots from `id` back to ones this folder already has. */
async function pullSnapshots(store: SyncStore, root: string, id: string): Promise<Snapshot[]> {
  const pulled: Snapshot[] = []
  const queue: (string | null | undefined)[] = [id]
  const seen = new Set<string>()
  while (queue.length) {
    const next = queue.shift()
    if (!next || seen.has(next)) continue
    seen.add(next)
    if (await hasSnapshot(root, next)) continue
    const snapshot = await store.getSnapshot(next)
    if (!snapshot) continue
    await storeSnapshot(root, snapshot)
    pulled.push(snapshot)
    queue.push(snapshot.parent, snapshot.merged)
  }
  return pulled
}

async function pullObjects(store: SyncStore, root: string, snapshot: Snapshot): Promise<void> {
  const hashes = [...new Set([...Object.values(snapshot.files), ...Object.values(snapshot.data)])]
  for (const hash of hashes)
    if (!(await hasObject(root, hash))) await storeObject(root, hash, await store.getObject(hash))
}

const parseJson = (data: Buffer | null): Record<string, unknown> | null => {
  if (!data) return null
  try {
    return JSON.parse(data.toString('utf8')) as Record<string, unknown>
  } catch {
    return null
  }
}

/** Unsaved edits (drafts.json): merged page by page. */
function mergeDrafts(
  base: Record<string, unknown> | null,
  mine: Record<string, unknown> | null,
  theirs: Record<string, unknown> | null
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  const keys = new Set([
    ...Object.keys(base ?? {}),
    ...Object.keys(mine ?? {}),
    ...Object.keys(theirs ?? {})
  ])
  for (const key of keys) {
    // Whoever changed it wins; changed on both sides, this computer's stays.
    const mineUnchanged = JSON.stringify(mine?.[key]) === JSON.stringify(base?.[key])
    const pick = mineUnchanged ? theirs?.[key] : mine?.[key]
    if (pick !== undefined) out[key] = pick
  }
  return out
}

/** Settings arrive from the other computer, but the deploy connection stays one of ours. */
async function mergeSiteSettings(mine: Buffer | null, theirs: Buffer): Promise<Buffer> {
  const incoming = parseJson(theirs) as SiteSettings | null
  if (!incoming?.deploy) return theirs
  const local = parseJson(mine) as SiteSettings | null
  const matching = await connectionForHint(incoming.deploy.connectionHint)
  incoming.deploy.connection = matching ?? local?.deploy?.connection ?? ''
  return Buffer.from(JSON.stringify(incoming, null, 2) + '\n')
}

interface Merged {
  pulled: number
  conflicts: string[]
}

/**
 * Brings the other side's version into the folder: for each file, whoever changed it
 * since the common base wins; when both did, this folder's copy stays and theirs is
 * kept in .sitecms/conflicts/ for "Use theirs".
 */
async function mergeInto(root: string, base: Snapshot | null, theirs: Snapshot): Promise<Merged> {
  await flushDrafts()
  const now = await scan(root)
  const conflicts: string[] = []
  let pulled = 0

  const siteWrites: FileWrite[] = []
  const sitePaths = new Set([
    ...Object.keys(base?.files ?? {}),
    ...Object.keys(theirs.files),
    ...Object.keys(now.files)
  ])
  for (const path of sitePaths) {
    const b = base?.files[path]
    const t = theirs.files[path]
    const m = now.files[path]
    if (t === m || t === b) continue
    if (m === b) {
      siteWrites.push({ path, content: t ? await readObject(root, t) : null })
      pulled++
    } else {
      conflicts.push(path)
      if (t) {
        const aside = join(conflictDir(root), path)
        await mkdir(dirname(aside), { recursive: true })
        await writeFile(aside, await readObject(root, t))
      }
    }
  }
  if (siteWrites.length) await writeFiles(root, siteWrites, `Sync: changes from ${theirs.device}`)

  const dataPaths = new Set([
    ...Object.keys(base?.data ?? {}),
    ...Object.keys(theirs.data),
    ...Object.keys(now.data)
  ])
  let draftsChanged = false
  for (const path of dataPaths) {
    const b = base?.data[path]
    const t = theirs.data[path]
    const m = now.data[path]
    if (t === m || t === b) continue
    const full = join(root, APP_DIR, path)
    const read = (hash: string | undefined): Promise<Buffer | null> =>
      hash ? readObject(root, hash) : Promise.resolve(null)
    let content: Buffer | null
    if (path === 'drafts.json') {
      content = Buffer.from(
        JSON.stringify(
          mergeDrafts(parseJson(await read(b)), parseJson(await read(m)), parseJson(await read(t)))
        )
      )
      draftsChanged = true
    } else if (m !== b) {
      // Other project data changed on both sides: this computer's stays.
      continue
    } else if (path === 'site.json' && t) {
      content = await mergeSiteSettings(await read(m), await readObject(root, t))
    } else {
      content = await read(t)
    }
    if (content === null) await rm(full, { force: true })
    else {
      await mkdir(dirname(full), { recursive: true })
      await writeFile(full, content)
    }
    pulled++
  }
  if (draftsChanged) await reloadDrafts()
  return { pulled, conflicts }
}

/** Whether `ancestor` is reachable from `from`. */
async function contains(root: string, from: string, ancestor: string): Promise<boolean> {
  return (await chain(root, from)).some((snapshot) => snapshot.id === ancestor)
}

/** Publishes made on other computers count as published from here, for the live check. */
async function adoptPublishes(root: string, pulled: Snapshot[], head: Snapshot): Promise<void> {
  for (const snapshot of pulled.filter((s) => s.kind === 'publish' && s.deploy))
    await rememberPublished(root, snapshot.deploy!.id)
  const latest = pulled
    .filter((s) => s.kind === 'publish' && s.deploy)
    .sort((a, b) => b.at.localeCompare(a.at))[0]
  // The folder now is exactly what's live: nothing changed since the last publish.
  if (latest && latest.id === head.id && sameContent(await scan(root), head)) {
    const site = await getSiteSettings(root)
    await saveState(root, await collect(root, site, { server: site.deploy.target === 'server' }), {
      id: latest.deploy!.id,
      url: latest.deploy!.url,
      branch: 'production'
    })
  }
}

// ---------- Sync ----------

let running: Promise<SyncResult> | null = null
const lastError = new Map<string, string | null>()
let lastSeen: RemoteHead | null = null

export function syncNow(root: string): Promise<SyncResult> {
  if (running) return running
  report(root, { busy: true })
  running = runSync(root)
    .then(
      (result) => {
        lastError.set(root, null)
        return result
      },
      (error: Error) => {
        lastError.set(root, error.message)
        throw error
      }
    )
    .finally(() => {
      running = null
      report(root)
    })
  return running
}

/**
 * A newer app may ship a newer sync Worker: update it if this computer's token may. If
 * not, the Worker already there keeps working, so sync goes on either way.
 */
async function updateWorker(root: string, config: SyncConfig): Promise<SyncConfig> {
  if (config.mode !== 'cloudflare' || (config.workerVersion ?? 0) >= SYNC_WORKER_VERSION)
    return config
  try {
    const connection = await connectionById(config.connection)
    workerUrls.delete(connection.accountId)
    const url = await ensureWorker(connection)
    const next = { ...config, url, workerVersion: SYNC_WORKER_VERSION }
    await writeConfig(root, next)
    return next
  } catch {
    return config
  }
}

async function runSync(root: string): Promise<SyncResult> {
  const stored = await readConfig(root)
  if (!stored) throw new Error('Sync is off for this project.')
  const config = await updateWorker(root, stored)
  const store = await openStore(root, config)
  const device = deviceName()
  try {
    for (let attempt = 0; attempt < 4; attempt++) {
      const remote = await store.getHead()
      lastSeen = remote
      const localHead = await readHead(root)
      const result: SyncResult = { pulled: 0, pushed: false, conflicts: [], from: null }
      let parent = localHead
      let merged: string | undefined
      let pulled: Snapshot[] = []

      if (remote && remote.snapshot !== config.base && remote.snapshot !== localHead) {
        pulled = await pullSnapshots(store, root, remote.snapshot)
        const theirs = await readSnapshot(root, remote.snapshot)
        await pullObjects(store, root, theirs)
        const base = config.base ? await readSnapshot(root, config.base).catch(() => null) : null
        const outcome = await mergeInto(root, base, theirs)
        Object.assign(result, outcome, { from: theirs.device })
        parent = theirs.id
        // Versions made here since the last sync stay in the history as a merged line.
        if (localHead && localHead !== config.base && !(await contains(root, theirs.id, localHead)))
          merged = localHead
      }

      const now = await scan(root)
      const parentSnapshot = parent ? await readSnapshot(root, parent).catch(() => null) : null
      let head = parent
      if (!parentSnapshot || merged || !sameContent(now, parentSnapshot)) {
        head = (
          await createSnapshot(root, {
            kind: 'sync',
            label: merged ? 'Synced (work from two computers joined)' : 'Synced',
            parent,
            merged
          })
        ).id
      } else if (parent) await setHead(root, parent)

      if (pulled.length) await adoptPublishes(root, pulled, await readSnapshot(root, head!))

      if (remote?.snapshot === head) {
        await writeConfig(root, {
          ...config,
          base: head,
          rev: remote.rev,
          lastSync: new Date().toISOString(),
          conflicts: result.conflicts
        })
        return result
      }

      // Upload what the store doesn't have, oldest version first, then move the head.
      const pulledIds = new Set(pulled.map((s) => s.id))
      const outgoing = (await chain(root, head, config.base)).filter((s) => !pulledIds.has(s.id))
      const hashes = [
        ...new Set(outgoing.flatMap((s) => [...Object.values(s.files), ...Object.values(s.data)]))
      ]
      const missing = await store.missing(hashes)
      await putObjects(
        store,
        missing,
        (hash) => readObject(root, hash),
        () => null
      )
      for (const snapshot of [...outgoing].reverse()) await store.putSnapshot(snapshot)
      if (!remote) await store.putInfo({ name: (await getSiteSettings(root)).siteName })

      const moved = await store.moveHead(remote?.rev ?? 0, head!, device)
      lastSeen = moved.head
      if (!moved.ok) continue // Someone synced in between: take theirs in first.
      await writeConfig(root, {
        ...config,
        base: head,
        rev: moved.head!.rev,
        lastSync: new Date().toISOString(),
        conflicts: result.conflicts
      })
      return { ...result, pushed: true }
    }
    throw new Error('Other computers kept syncing at the same moment. Try again.')
  } finally {
    await store.close().catch(() => null)
  }
}

// ---------- Turning sync on and off ----------

export async function enableSync(root: string, setup: SyncSetup): Promise<SyncResult> {
  const site = await getSiteSettings(root)
  const connection = await connectionById(setup.connection)
  let url = ''
  if (setup.mode === 'cloudflare') {
    workerUrls.delete(connection.accountId)
    url = await ensureWorker(connection)
  } else {
    if (!setup.passphrase) throw new Error('Choose a sync passphrase (at least 8 characters).')
    // Opening the store checks the passphrase (and creates the folder on first use).
    const store = await openStoreFor(setup, site.id)
    await store.close()
    await setSyncSecret(serverSecret(site.id), setup.passphrase)
  }
  const previous = await readConfig(root)
  await writeConfig(root, {
    mode: setup.mode,
    connection: setup.connection,
    dir: setup.dir ?? '',
    url,
    base: previous?.base ?? null,
    rev: 0,
    lastSync: null,
    conflicts: [],
    workerVersion: setup.mode === 'cloudflare' ? SYNC_WORKER_VERSION : undefined
  })
  startLive(root)
  return syncNow(root)
}

export async function disableSync(root: string): Promise<void> {
  stopLive()
  await writeConfig(root, null)
  report(root)
}

// ---------- Getting a project on another computer ----------

async function sourceWithUrl(source: SyncSource): Promise<SyncSource & { url?: string }> {
  if (source.mode !== 'cloudflare') return source
  const connection = await connectionById(source.connection)
  return { ...source, url: await ensureWorker(connection) }
}

export async function listProjects(source: SyncSource): Promise<SyncProjectView[]> {
  const full = await sourceWithUrl(source)
  if (full.mode === 'cloudflare')
    return listCloudflareProjects(
      full.url!,
      await cloudflareKey(await connectionById(full.connection))
    )
  const connection = await connectionById(full.connection)
  if (!full.passphrase) throw new Error('Enter the sync passphrase.')
  return listServerProjects(connection, full.dir ?? '', full.passphrase)
}

/** Downloads a project's latest version into an empty folder and turns sync on there. */
export async function getProject(
  source: SyncSource,
  project: string,
  folder: string
): Promise<void> {
  const full = await sourceWithUrl(source)
  const store = await openStoreFor(full, project)
  try {
    const head = await store.getHead()
    if (!head) throw new Error('That project has nothing synced yet.')
    await pullSnapshots(store, folder, head.snapshot)
    const snapshot = await readSnapshot(folder, head.snapshot)
    await pullObjects(store, folder, snapshot)
    for (const [path, hash] of Object.entries(snapshot.files)) {
      await mkdir(dirname(join(folder, path)), { recursive: true })
      await writeFile(join(folder, path), await readObject(folder, hash))
    }
    for (const [path, hash] of Object.entries(snapshot.data)) {
      let content = await readObject(folder, hash)
      if (path === 'site.json') content = await mergeSiteSettings(null, content)
      await mkdir(dirname(join(folder, APP_DIR, path)), { recursive: true })
      await writeFile(join(folder, APP_DIR, path), content)
    }
    await setHead(folder, head.snapshot)
    if (full.mode === 'server' && full.passphrase)
      await setSyncSecret(serverSecret(project), full.passphrase)
    await writeConfig(folder, {
      mode: full.mode,
      connection: full.connection,
      dir: full.dir ?? '',
      url: full.url ?? '',
      base: head.snapshot,
      rev: head.rev,
      lastSync: new Date().toISOString(),
      conflicts: [],
      workerVersion: full.mode === 'cloudflare' ? SYNC_WORKER_VERSION : undefined
    })
    const pulled = await chain(folder, head.snapshot)
    for (const s of pulled.filter((s) => s.kind === 'publish' && s.deploy))
      await rememberPublished(folder, s.deploy!.id)
  } finally {
    await store.close().catch(() => null)
  }
}

/** Replaces this folder's copy of a conflicted file with the other computer's. */
export async function takeTheirs(root: string, path: string): Promise<void> {
  const config = await readConfig(root)
  if (!config?.conflicts.includes(path)) throw new Error(`${path} has no conflict to resolve.`)
  const aside = join(conflictDir(root), path)
  const content = await readFile(aside).catch(() => null)
  await writeFiles(root, [{ path, content }], `Sync: use the other computer’s ${path}`)
  await rm(aside, { force: true })
  await writeConfig(root, { ...config, conflicts: config.conflicts.filter((p) => p !== path) })
  report(root)
}

// ---------- Status and live presence ----------

let live: { root: string; channel: LiveChannel } | null = null
let people: SyncPresence[] = []

export async function syncStatus(root: string): Promise<SyncStatus> {
  const config = await readConfig(root)
  if (!config)
    return {
      mode: 'off',
      connection: '',
      where: '',
      lastSync: null,
      remote: null,
      behind: false,
      ahead: false,
      conflicts: [],
      people: [],
      busy: false,
      error: null
    }
  const head = await readHead(root)
  const base = config.base ? await readSnapshot(root, config.base).catch(() => null) : null
  const ahead = !base || head !== config.base || !sameContent(await scan(root), base)
  const me = deviceName()
  return {
    mode: config.mode,
    connection: config.connection,
    where: config.mode === 'cloudflare' ? config.url : config.dir || '/',
    lastSync: config.lastSync,
    remote: lastSeen ? { device: lastSeen.device, at: lastSeen.at, rev: lastSeen.rev } : null,
    behind: Boolean(lastSeen && lastSeen.rev > config.rev),
    ahead,
    conflicts: config.conflicts,
    people: people.filter((person) => person.device !== me),
    busy: running !== null,
    error: lastError.get(root) ?? null
  }
}

function report(root: string, patch: Partial<SyncStatus> = {}): void {
  if (getWorkspace()?.root !== root) return
  syncStatus(root)
    .then((status) => broadcast({ type: 'sync', status: { ...status, ...patch } }))
    .catch(() => null)
}

let announced: Omit<SyncPresence, 'at'> = { device: deviceName(), page: null, mode: null }

export function announce(page: string | null, mode: string | null): void {
  announced = { device: deviceName(), page, mode }
  live?.channel.announce(announced)
}

/** Opens the live channel for the open project (presence, others' syncs). */
export async function startLive(root: string): Promise<void> {
  stopLive()
  lastSeen = null
  const config = await readConfig(root)
  if (!config) return
  const site = await getSiteSettings(root)
  const onEvent = (event: LiveEvent): void => {
    if (event.type === 'presence') people = event.people
    if (event.type === 'head') lastSeen = event.head
    report(root)
  }
  try {
    let channel: LiveChannel | null = null
    if (config.mode === 'cloudflare') {
      const connection = await connectionById(config.connection)
      channel = openCloudflareStore(config.url, await cloudflareKey(connection), site.id).live!(
        onEvent
      )
    } else {
      const connection = await connectionById(config.connection)
      const passphrase = await getSyncSecret(serverSecret(site.id))
      if (passphrase) channel = serverLive(connection, config.dir, passphrase, site.id, onEvent)
    }
    if (!channel) return
    live = { root, channel }
    channel.announce(announced)
    // What the others did while this computer was away.
    const store = await openStore(root, config).catch(() => null)
    if (store) {
      lastSeen = await store.getHead().catch(() => null)
      await store.close().catch(() => null)
      report(root)
    }
  } catch {
    // No connection now: the status shows it at the next sync.
  }
}

export function stopLive(): void {
  live?.channel.close()
  live = null
  people = []
}
