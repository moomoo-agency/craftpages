import { createHash, randomBytes } from 'crypto'
import { constants, createReadStream } from 'fs'
import { copyFile, mkdir, readdir, readFile, rename, stat, writeFile } from 'fs/promises'
import { hostname } from 'os'
import { dirname, join } from 'path'
import { writeFiles, type FileWrite } from '../history'
import { APP_DIR } from '../settings'
import { listFiles } from '../workspace'
import type { SnapshotDetails, SnapshotKind, SnapshotSummary } from '../../shared/types'

/**
 * Versions of a project: every publish (and later every sync) records the whole site
 * as a snapshot. File contents are stored once by hash in `.sitecms/store/objects/`, as
 * copy-on-write clones where the disk supports it (APFS, Btrfs), so an unchanged file
 * costs nothing however many snapshots hold it.
 *
 * The same layout is what a sync store keeps remotely (see unfinished/SYNC.md): syncing
 * is copying missing objects and snapshots, then moving `head`.
 */

export interface Snapshot {
  version: 1
  id: string
  parent: string | null
  kind: SnapshotKind
  at: string
  device: string
  label: string
  /** Site files: path → sha256. */
  files: Record<string, string>
  /** Project data that travels with the site (.sitecms/…): path → sha256. */
  data: Record<string, string>
  /** Site files that were not published (kept off the site, never uploaded). */
  unpublished?: string[]
  deploy?: { target: string; id: string; url: string; where: string }
  /** A sync that joined two lines of work: the other one's last version. */
  merged?: string
}

export const STORE_DIR = 'store'
const store = (root: string): string => join(root, APP_DIR, STORE_DIR)
const objectPath = (root: string, hash: string): string =>
  join(store(root), 'objects', hash.slice(0, 2), hash.slice(2))
const snapshotPath = (root: string, id: string): string =>
  join(store(root), 'snapshots', `${id}.json`)
const headPath = (root: string): string => join(store(root), 'head.json')

/** Project data that is per-computer or rebuilt locally, so never part of a snapshot. */
const LOCAL_DATA = new Set(['history', 'trash', STORE_DIR, 'deploy-state.json', 'sync.json'])

/** This computer's name as people know it ("Vitalii's MacBook" rather than a domain). */
export const deviceName = (): string =>
  hostname().replace(/\.(local|home|lan|localdomain)$/i, '') || 'This computer'

// ---------- Hashing (cached by size and modification time) ----------

const hashCache = new Map<string, { key: string; hash: string }>()

async function hashFile(full: string): Promise<string> {
  const info = await stat(full)
  const key = `${info.size}:${info.mtimeMs}`
  const cached = hashCache.get(full)
  if (cached?.key === key) return cached.hash
  const hash = await new Promise<string>((resolve, reject) => {
    const digest = createHash('sha256')
    createReadStream(full)
      .on('data', (chunk) => digest.update(chunk))
      .on('end', () => resolve(digest.digest('hex')))
      .on('error', reject)
  })
  hashCache.set(full, { key, hash })
  return hash
}

async function dataFiles(root: string, dir = ''): Promise<string[]> {
  const base = join(root, APP_DIR, dir)
  const entries = await readdir(base, { withFileTypes: true }).catch(() => [])
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = dir ? `${dir}/${entry.name}` : entry.name
      if (!dir && LOCAL_DATA.has(entry.name)) return []
      if (entry.isDirectory()) return dataFiles(root, path)
      return entry.isFile() && entry.name !== '.DS_Store' ? [path] : []
    })
  )
  return nested.flat()
}

/** Copies a file into the object store unless it's there already. */
async function keep(root: string, full: string, hash: string): Promise<void> {
  const target = objectPath(root, hash)
  if (
    await stat(target).then(
      () => true,
      () => false
    )
  )
    return
  await mkdir(dirname(target), { recursive: true })
  const temp = `${target}.${randomBytes(4).toString('hex')}.tmp`
  // A clone where the file system supports it, a plain copy elsewhere.
  await copyFile(full, temp, constants.COPYFILE_FICLONE)
  await rename(temp, target)
}

// ---------- Reading ----------

export async function readHead(root: string): Promise<string | null> {
  try {
    return (JSON.parse(await readFile(headPath(root), 'utf8')) as { snapshot: string }).snapshot
  } catch {
    return null
  }
}

/** A path inside a project: relative, forward slashes, no way out of the folder. */
const SAFE_PATH = /^(?!\/)(?!.*(^|\/)\.\.(\/|$))[^\0\\]+$/

export function checkSnapshot(snapshot: Snapshot): Snapshot {
  for (const [path, hash] of [...Object.entries(snapshot.files), ...Object.entries(snapshot.data)])
    if (!SAFE_PATH.test(path) || !/^[0-9a-f]{64}$/.test(hash))
      throw new Error(`The version ${snapshot.id} lists an invalid file: ${path}`)
  return snapshot
}

export async function readSnapshot(root: string, id: string): Promise<Snapshot> {
  if (!/^[\w-]+$/.test(id)) throw new Error('Invalid snapshot id')
  return checkSnapshot(JSON.parse(await readFile(snapshotPath(root, id), 'utf8')) as Snapshot)
}

export async function readObject(root: string, hash: string): Promise<Buffer> {
  if (!/^[0-9a-f]{64}$/.test(hash)) throw new Error('Invalid object id')
  return readFile(objectPath(root, hash))
}

export async function hasSnapshot(root: string, id: string): Promise<boolean> {
  return stat(snapshotPath(root, id)).then(
    () => true,
    () => false
  )
}

export async function hasObject(root: string, hash: string): Promise<boolean> {
  return stat(objectPath(root, hash)).then(
    () => true,
    () => false
  )
}

/** Keeps bytes that came from a sync store, checking they are what their hash says. */
export async function storeObject(root: string, hash: string, data: Buffer): Promise<void> {
  if (createHash('sha256').update(data).digest('hex') !== hash)
    throw new Error(`A file from the sync store is damaged (${hash.slice(0, 12)}…).`)
  const target = objectPath(root, hash)
  await mkdir(dirname(target), { recursive: true })
  const temp = `${target}.${randomBytes(4).toString('hex')}.tmp`
  await writeFile(temp, data)
  await rename(temp, target)
}

export async function storeSnapshot(root: string, snapshot: Snapshot): Promise<void> {
  checkSnapshot(snapshot)
  if (!/^[\w-]+$/.test(snapshot.id)) throw new Error('Invalid snapshot id')
  await mkdir(dirname(snapshotPath(root, snapshot.id)), { recursive: true })
  await writeFile(snapshotPath(root, snapshot.id), JSON.stringify(snapshot))
}

export async function setHead(root: string, id: string): Promise<void> {
  await mkdir(store(root), { recursive: true })
  await writeFile(headPath(root), JSON.stringify({ snapshot: id }))
}

type Content = { files: Record<string, string>; data: Record<string, string> }

/** Same site files and project data. */
export function sameContent(a: Content, b: Content): boolean {
  const same = (x: Record<string, string>, y: Record<string, string>): boolean =>
    Object.keys(x).length === Object.keys(y).length &&
    Object.entries(x).every(([path, hash]) => y[path] === hash)
  return same(a.files, b.files) && same(a.data, b.data)
}

/**
 * Snapshots reachable from `from` (parents and merged lines) until `stop`, newest first.
 * Missing ones (not pulled) are skipped.
 */
export async function chain(
  root: string,
  from: string | null,
  stop: string | null = null,
  limit = 1000
): Promise<Snapshot[]> {
  const seen = new Map<string, Snapshot>()
  const queue = [from]
  while (queue.length && seen.size < limit) {
    const id = queue.shift()
    if (!id || id === stop || seen.has(id)) continue
    const snapshot = await readSnapshot(root, id).catch(() => null)
    if (!snapshot) continue
    seen.set(id, snapshot)
    queue.push(snapshot.parent, snapshot.merged ?? null)
  }
  return [...seen.values()].sort((a, b) => b.at.localeCompare(a.at))
}

/** Every snapshot reachable from the head, newest first. */
export async function history(root: string, limit = 200): Promise<Snapshot[]> {
  return chain(root, await readHead(root), null, limit)
}

function diff(
  from: Record<string, string>,
  to: Record<string, string>
): { added: string[]; changed: string[]; removed: string[] } {
  const added: string[] = []
  const changed: string[] = []
  for (const [path, hash] of Object.entries(to)) {
    if (!(path in from)) added.push(path)
    else if (from[path] !== hash) changed.push(path)
  }
  const removed = Object.keys(from).filter((path) => !(path in to))
  return { added, changed, removed }
}

export async function summaries(root: string): Promise<SnapshotSummary[]> {
  const list = await history(root)
  const byId = new Map(list.map((snapshot) => [snapshot.id, snapshot]))
  return list.map((snapshot) => {
    const parent = snapshot.parent ? byId.get(snapshot.parent) : undefined
    const { added, changed, removed } = diff(parent?.files ?? {}, snapshot.files)
    return {
      id: snapshot.id,
      kind: snapshot.kind,
      at: snapshot.at,
      device: snapshot.device,
      label: snapshot.label,
      files: Object.keys(snapshot.files).length,
      added: added.length,
      changed: changed.length,
      removed: removed.length,
      unpublished: snapshot.unpublished?.length ?? 0,
      deploy: snapshot.deploy ?? null,
      first: !parent
    }
  })
}

export async function details(root: string, id: string): Promise<SnapshotDetails> {
  const snapshot = await readSnapshot(root, id)
  const parent = snapshot.parent
    ? await readSnapshot(root, snapshot.parent).catch(() => null)
    : null
  return { ...diff(parent?.files ?? {}, snapshot.files), unpublished: snapshot.unpublished ?? [] }
}

// ---------- Writing ----------

/** Hashes of the folder as it is now: site files and the project data that travels. */
export async function scan(
  root: string
): Promise<{ files: Record<string, string>; data: Record<string, string> }> {
  const site = await listFiles(root)
  const files: Record<string, string> = {}
  for (const file of site) files[file.path] = await hashFile(join(root, file.path))
  const data: Record<string, string> = {}
  for (const path of await dataFiles(root)) data[path] = await hashFile(join(root, APP_DIR, path))
  return { files, data }
}

/** Records the folder as a new snapshot on top of the head, and moves the head to it. */
export async function createSnapshot(
  root: string,
  options: {
    kind: SnapshotKind
    label: string
    unpublished?: string[]
    deploy?: Snapshot['deploy']
    /** Default: the head. */
    parent?: string | null
    merged?: string
  }
): Promise<Snapshot> {
  const { files, data } = await scan(root)
  for (const [path, hash] of Object.entries(files)) await keep(root, join(root, path), hash)
  for (const [path, hash] of Object.entries(data)) await keep(root, join(root, APP_DIR, path), hash)
  const snapshot: Snapshot = {
    version: 1,
    id: `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomBytes(3).toString('hex')}`,
    parent: options.parent !== undefined ? options.parent : await readHead(root),
    kind: options.kind,
    at: new Date().toISOString(),
    device: deviceName(),
    label: options.label,
    files,
    data,
    ...(options.unpublished?.length ? { unpublished: options.unpublished } : {}),
    ...(options.deploy ? { deploy: options.deploy } : {}),
    ...(options.merged ? { merged: options.merged } : {})
  }
  await mkdir(dirname(snapshotPath(root, snapshot.id)), { recursive: true })
  await writeFile(snapshotPath(root, snapshot.id), JSON.stringify(snapshot))
  await writeFile(headPath(root), JSON.stringify({ snapshot: snapshot.id }))
  return snapshot
}

/**
 * Puts the site files back as they were in a snapshot, as one undoable step. Files added
 * since are removed; project settings and drafts stay as they are now.
 */
export async function restoreSnapshot(
  root: string,
  id: string
): Promise<{ historyId: string | null; files: number }> {
  const snapshot = await readSnapshot(root, id)
  const { files: now } = await scan(root)
  const writes: FileWrite[] = []
  for (const [path, hash] of Object.entries(snapshot.files))
    if (now[path] !== hash) writes.push({ path, content: await readObject(root, hash) })
  for (const path of Object.keys(now))
    if (!(path in snapshot.files)) writes.push({ path, content: null })
  if (!writes.length) return { historyId: null, files: 0 }
  const historyId = await writeFiles(
    root,
    writes,
    `Restore the version of ${new Date(snapshot.at).toLocaleString()}`
  )
  return { historyId, files: writes.length }
}

/** Writes a snapshot out as a complete project folder (site files and project data). */
export async function exportSnapshot(root: string, id: string, target: string): Promise<number> {
  const snapshot = await readSnapshot(root, id)
  if ((await readdir(target).catch(() => [])).some((name) => name !== '.DS_Store'))
    throw new Error('Choose an empty folder: the version is written there as a complete project.')
  const all = [
    ...Object.entries(snapshot.files).map(([path, hash]) => [join(target, path), hash] as const),
    ...Object.entries(snapshot.data).map(
      ([path, hash]) => [join(target, APP_DIR, path), hash] as const
    )
  ]
  for (const [full, hash] of all) {
    await mkdir(dirname(full), { recursive: true })
    await copyFile(objectPath(root, hash), full, constants.COPYFILE_FICLONE)
  }
  return all.length
}
