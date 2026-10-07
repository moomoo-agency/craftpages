import { randomBytes } from 'crypto'
import { posix } from 'path'
import { baseOf, openRemote, type Remote, type ServerConnection } from '../deploy/server'
import { decrypt, deriveKey, encrypt } from './crypto'
import { checkSnapshot, type Snapshot } from './snapshots'
import type { LiveChannel, LiveEvent, RemoteHead, SyncProject, SyncStore } from './store'
import type { SyncPresence } from '../../shared/types'

/**
 * A sync store in a folder on an FTP / SFTP server, ideally outside the web root:
 *
 *   <folder>/craftpages-sync.json      salt + passphrase check (not secret)
 *   <folder>/objects/ab/<hash>         file contents, encrypted, shared by projects
 *   <folder>/projects/<id>/info        name
 *   <folder>/projects/<id>/head        the head (rev, snapshot)
 *   <folder>/projects/<id>/lock        held while the head moves
 *   <folder>/projects/<id>/snapshots/<snapshot id>
 *   <folder>/projects/<id>/presence/<device>
 *
 * Everything but the salt file is encrypted with the sync passphrase. Servers can't
 * compare-and-swap, so the head moves under a lock file that is written, then read back
 * to check it's ours; an abandoned lock expires after a minute.
 */

const SALT_FILE = 'craftpages-sync.json'
const CHECK = 'craftpages-sync'
const LOCK_TTL = 60_000
const POLL = 45_000
/** Someone counts as present while their last announce is this recent. */
const PRESENT_FOR = 2 * POLL + 15_000

interface Opened {
  remote: Remote
  base: string
  key: Buffer
}

/** Opens the folder, creating the salt file on first use when `create` is set. */
async function openFolder(
  connection: ServerConnection,
  dir: string,
  passphrase: string,
  create: boolean,
  onHostKey?: (key: string) => void
): Promise<Opened> {
  if (passphrase.length < 8) throw new Error('The sync passphrase needs at least 8 characters.')
  const remote = await openRemote(connection, onHostKey)
  try {
    const base = baseOf(remote, dir)
    const text = await remote.readText(posix.join(base, SALT_FILE))
    if (!text) {
      if (!create) throw new Error(`No CraftPages sync data in ${base} on ${connection.host}.`)
      const salt = randomBytes(16)
      const key = await deriveKey(passphrase, salt)
      await remote.ensureDir(base)
      await remote.writeText(
        posix.join(base, SALT_FILE),
        JSON.stringify({
          version: 1,
          salt: salt.toString('base64'),
          check: encrypt(key, Buffer.from(CHECK)).toString('base64')
        })
      )
      return { remote, base, key }
    }
    const meta = JSON.parse(text) as { salt: string; check: string }
    const key = await deriveKey(passphrase, Buffer.from(meta.salt, 'base64'))
    let ok = false
    try {
      ok = decrypt(key, Buffer.from(meta.check, 'base64')).toString() === CHECK
    } catch {
      ok = false
    }
    if (!ok) throw new Error('The sync passphrase is wrong for this sync folder.')
    return { remote, base, key }
  } catch (error) {
    await remote.close().catch(() => null)
    throw error
  }
}

const readJson = async <T>(opened: Opened, path: string): Promise<T | null> => {
  const data = await opened.remote.readBytes(posix.join(opened.base, path))
  return data ? (JSON.parse(decrypt(opened.key, data).toString('utf8')) as T) : null
}

const writeJson = async (opened: Opened, path: string, value: unknown): Promise<void> => {
  const full = posix.join(opened.base, path)
  await opened.remote.ensureDir(posix.dirname(full))
  await opened.remote.writeBytes(full, encrypt(opened.key, Buffer.from(JSON.stringify(value))))
}

/** Projects in the sync folder, for opening one on another computer. */
export async function listServerProjects(
  connection: ServerConnection,
  dir: string,
  passphrase: string
): Promise<SyncProject[]> {
  const opened = await openFolder(connection, dir, passphrase, false)
  try {
    const entries = await opened.remote.list(posix.join(opened.base, 'projects')).catch(() => [])
    const projects: SyncProject[] = []
    for (const entry of entries) {
      if (!entry.dir || !/^[0-9a-f]{8,64}$/.test(entry.name)) continue
      const info = await readJson<{ name: string }>(opened, `projects/${entry.name}/info`).catch(
        () => null
      )
      const head = await readJson<RemoteHead>(opened, `projects/${entry.name}/head`).catch(
        () => null
      )
      projects.push({
        id: entry.name,
        name: info?.name ?? entry.name,
        at: head?.at ?? null,
        device: head?.device ?? null
      })
    }
    return projects
  } finally {
    await opened.remote.close().catch(() => null)
  }
}

export async function openServerStore(
  connection: ServerConnection,
  dir: string,
  passphrase: string,
  project: string,
  onHostKey?: (key: string) => void
): Promise<SyncStore> {
  if (!/^[0-9a-f]{8,64}$/.test(project)) throw new Error('Invalid project id')
  const opened = await openFolder(connection, dir, passphrase, true, onHostKey)
  const projectDir = `projects/${project}`
  const objectFile = (hash: string): string => `objects/${hash.slice(0, 2)}/${hash.slice(2)}`
  /** Shard folder → the object names in it, listed once per session. */
  const shards = new Map<string, Set<string>>()

  const listShard = async (shard: string): Promise<Set<string>> => {
    let names = shards.get(shard)
    if (!names) {
      const entries = await opened.remote
        .list(posix.join(opened.base, 'objects', shard))
        .catch(() => [])
      names = new Set(entries.filter((entry) => !entry.dir).map((entry) => entry.name))
      shards.set(shard, names)
    }
    return names
  }

  const lockPath = posix.join(opened.base, projectDir, 'lock')
  const withLock = async <T>(device: string, task: () => Promise<T>): Promise<T> => {
    const token = randomBytes(8).toString('hex')
    for (let attempt = 0; ; attempt++) {
      const current = await opened.remote.readText(lockPath)
      const held = current
        ? (JSON.parse(current) as { token: string; until: number; device: string })
        : null
      if (held && held.until > Date.now()) {
        if (attempt >= 10)
          throw new Error(
            `${held.device} is syncing this project right now. Try again in a moment.`
          )
        await new Promise((resolve) => setTimeout(resolve, 1000))
        continue
      }
      await opened.remote.ensureDir(posix.dirname(lockPath))
      await opened.remote.writeText(
        lockPath,
        JSON.stringify({ token, device, until: Date.now() + LOCK_TTL })
      )
      // Two computers may have written at once: only the one whose lock is there goes on.
      await new Promise((resolve) => setTimeout(resolve, 300))
      const check = await opened.remote.readText(lockPath)
      if (check && (JSON.parse(check) as { token: string }).token === token) break
    }
    try {
      return await task()
    } finally {
      await opened.remote.remove(lockPath).catch(() => null)
    }
  }

  const store: SyncStore = {
    getHead: () => readJson<RemoteHead>(opened, `${projectDir}/head`),
    moveHead: (expect, snapshot, device) =>
      withLock(device, async () => {
        const head = await readJson<RemoteHead>(opened, `${projectDir}/head`)
        if ((head?.rev ?? 0) !== expect) return { ok: false, head }
        const next: RemoteHead = {
          snapshot,
          rev: expect + 1,
          at: new Date().toISOString(),
          device
        }
        // Written aside and renamed, so a cut connection never leaves half a head.
        const full = posix.join(opened.base, projectDir, 'head')
        await opened.remote.writeBytes(
          `${full}.tmp`,
          encrypt(opened.key, Buffer.from(JSON.stringify(next)))
        )
        await opened.remote.rename(`${full}.tmp`, full)
        return { ok: true, head: next }
      }),
    missing: async (hashes) => {
      const out: string[] = []
      for (const hash of hashes)
        if (!(await listShard(hash.slice(0, 2))).has(hash.slice(2))) out.push(hash)
      return out
    },
    putObject: async (hash, data) => {
      const full = posix.join(opened.base, objectFile(hash))
      await opened.remote.ensureDir(posix.dirname(full))
      await opened.remote.writeBytes(full, encrypt(opened.key, data))
      ;(await listShard(hash.slice(0, 2))).add(hash.slice(2))
    },
    getObject: async (hash) => {
      const data = await opened.remote.readBytes(posix.join(opened.base, objectFile(hash)))
      if (!data) throw new Error(`The sync store is missing a file (${hash.slice(0, 12)}…).`)
      return decrypt(opened.key, data)
    },
    putSnapshot: (snapshot) =>
      writeJson(opened, `${projectDir}/snapshots/${snapshot.id}`, snapshot),
    getSnapshot: async (id) => {
      if (!/^[\w-]+$/.test(id)) throw new Error('Invalid snapshot id')
      const snapshot = await readJson<Snapshot>(opened, `${projectDir}/snapshots/${id}`)
      return snapshot && checkSnapshot(snapshot)
    },
    putInfo: (info) => writeJson(opened, `${projectDir}/info`, info),
    close: () => opened.remote.close()
  }
  return store
}

/**
 * Presence over FTP / SFTP: every 45 s this computer writes what it has open and reads
 * what the others wrote, and notices when the head moved. No server push, so others show
 * up within a minute or so.
 */
export function serverLive(
  connection: ServerConnection,
  dir: string,
  passphrase: string,
  project: string,
  onEvent: (event: LiveEvent) => void
): LiveChannel {
  let mine: Omit<SyncPresence, 'at'> | null = null
  let lastRev = -1
  let stopped = false
  let timer: ReturnType<typeof setTimeout> | null = null

  const poll = async (): Promise<void> => {
    if (stopped) return
    try {
      const opened = await openFolder(connection, dir, passphrase, false)
      try {
        const folder = `projects/${project}/presence`
        if (mine)
          await writeJson(opened, `${folder}/${Buffer.from(mine.device).toString('hex')}`, {
            ...mine,
            at: new Date().toISOString()
          })
        const entries = await opened.remote.list(posix.join(opened.base, folder)).catch(() => [])
        const people: SyncPresence[] = []
        for (const entry of entries) {
          if (entry.dir) continue
          const presence = await readJson<SyncPresence>(opened, `${folder}/${entry.name}`).catch(
            () => null
          )
          if (presence && Date.now() - Date.parse(presence.at) < PRESENT_FOR) people.push(presence)
        }
        onEvent({ type: 'presence', people })
        const head = await readJson<RemoteHead>(opened, `projects/${project}/head`)
        if (head && head.rev !== lastRev) {
          if (lastRev !== -1) onEvent({ type: 'head', head })
          lastRev = head.rev
        }
      } finally {
        await opened.remote.close().catch(() => null)
      }
    } catch {
      // Offline or the server is busy: try again at the next poll.
    }
    if (!stopped) timer = setTimeout(poll, POLL)
  }
  timer = setTimeout(poll, 1000)

  return {
    announce: (presence) => {
      mine = presence
    },
    close: () => {
      stopped = true
      if (timer) clearTimeout(timer)
    }
  }
}
