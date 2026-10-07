import { createHash, randomBytes } from 'crypto'
import { readFile } from 'fs/promises'
import { hostname } from 'os'
import { join, posix } from 'path'
import { PassThrough, Readable } from 'stream'
import { Client as FtpClient } from 'basic-ftp'
import SftpClient from 'ssh2-sftp-client'
import { collect, saveState, type SiteFile } from './cloudflare'
import { syncHtaccess } from '../blog-generate'
import type {
  DeployConnection,
  Deployment,
  DeployProgress,
  DeployResult,
  ForeignDeploy,
  ServerCheck,
  SiteSettings
} from '../../shared/types'

/**
 * Publishing to an ordinary web host over FTP, FTPS or SFTP.
 *
 * The server can't say what is on it, so CraftPages keeps a manifest next to the
 * site (`.craftpages/manifest.json`: path → hash, and an id per publish). A publish
 * uploads only files whose hash changed, assets before pages so a page never points
 * at a file that isn't there yet, then deletes what the previous publish uploaded and
 * the site no longer has. Files CraftPages didn't upload are never deleted.
 */

const MANIFEST_DIR = '.craftpages'
const MANIFEST = `${MANIFEST_DIR}/manifest.json`
const TIMEOUT = 20_000

export interface Manifest {
  version: 1
  /** Changes with every publish; this folder remembers the ids it published. */
  id: string
  at: string
  device: string
  files: Record<string, string>
}

export type ServerConnection = DeployConnection & { token: string }

/** The operations a publish needs, over FTP or SFTP alike. Paths are absolute. */
export interface Remote {
  home: string
  list: (dir: string) => Promise<{ name: string; dir: boolean }[]>
  /** The file's bytes, or null when there is no such file. */
  readBytes: (path: string) => Promise<Buffer | null>
  writeBytes: (path: string, data: Buffer) => Promise<void>
  readText: (path: string) => Promise<string | null>
  writeText: (path: string, text: string) => Promise<void>
  upload: (local: string, remote: string) => Promise<void>
  ensureDir: (dir: string) => Promise<void>
  remove: (path: string) => Promise<void>
  rename: (from: string, to: string) => Promise<void>
  close: () => Promise<void>
}

/** OpenSSH-style fingerprint of a server key: SHA256:base64. */
const done = (): void => undefined

const fingerprint = (key: Buffer): string =>
  `SHA256:${createHash('sha256').update(key).digest('base64').replace(/=+$/, '')}`

async function openFtp(connection: ServerConnection): Promise<Remote> {
  const client = new FtpClient(TIMEOUT)
  try {
    await client.access({
      host: connection.host,
      port: connection.port || 21,
      user: connection.username,
      password: connection.token,
      secure: Boolean(connection.secure)
    })
  } catch (error) {
    client.close()
    throw friendly(error, connection)
  }
  const home = await client.pwd()
  // basic-ftp runs one command at a time; a queue keeps parallel callers in order.
  let queue: Promise<unknown> = Promise.resolve()
  const run = <T>(task: () => Promise<T>): Promise<T> => {
    const next = queue.then(task, task)
    queue = next.catch(() => null)
    return next
  }
  const readBytes = (path: string): Promise<Buffer | null> =>
    run(async () => {
      const chunks: Buffer[] = []
      const sink = new PassThrough()
      sink.on('data', (chunk: Buffer) => chunks.push(chunk))
      try {
        await client.downloadTo(sink, path)
        return Buffer.concat(chunks)
      } catch (error) {
        if (/\b550\b|not found|no such/i.test((error as Error).message)) return null
        throw error
      }
    })
  const writeBytes = (path: string, data: Buffer): Promise<void> =>
    run(() => client.uploadFrom(Readable.from([data]), path)).then(done)
  return {
    home,
    list: (dir) =>
      run(async () =>
        (await client.list(dir)).map((entry) => ({ name: entry.name, dir: entry.isDirectory }))
      ),
    readBytes,
    writeBytes,
    readText: async (path) => (await readBytes(path))?.toString('utf8') ?? null,
    writeText: (path, text) => writeBytes(path, Buffer.from(text)),
    upload: (local, remote) => run(() => client.uploadFrom(local, remote)).then(done),
    ensureDir: (dir) =>
      run(async () => {
        // ensureDir changes the working folder; paths stay absolute, so that's harmless.
        await client.ensureDir(dir)
      }),
    remove: (path) => run(() => client.remove(path, true)).then(done),
    rename: (from, to) => run(() => client.rename(from, to)).then(done),
    close: async () => client.close()
  }
}

async function openSftp(
  connection: ServerConnection,
  onHostKey?: (key: string) => void
): Promise<Remote> {
  const client = new SftpClient('craftpages')
  let seen = ''
  try {
    await client.connect({
      host: connection.host,
      port: connection.port || 22,
      username: connection.username,
      readyTimeout: TIMEOUT,
      ...(connection.keyPath
        ? {
            privateKey: await readFile(connection.keyPath),
            passphrase: connection.token || undefined
          }
        : { password: connection.token }),
      // Trust on first use: afterwards the key must match what was trusted.
      hostVerifier: (key: Buffer) => {
        seen = fingerprint(key)
        return !connection.hostKey || connection.hostKey === seen
      }
    })
  } catch (error) {
    await client.end().catch(() => null)
    if (connection.hostKey && seen && seen !== connection.hostKey)
      throw new Error(
        `The server ${connection.host} identifies itself with a different key than before ` +
          `(${seen}, was ${connection.hostKey}). If the host changed its server, edit the ` +
          'connection in Settings to trust the new key; otherwise someone may be in between.'
      )
    throw friendly(error, connection)
  }
  if (seen && seen !== connection.hostKey) onHostKey?.(seen)
  const home = await client.cwd()
  return {
    home,
    list: async (dir) =>
      (await client.list(dir)).map((entry) => ({ name: entry.name, dir: entry.type === 'd' })),
    readBytes: async (path) => {
      if (!(await client.exists(path))) return null
      return (await client.get(path)) as Buffer
    },
    writeBytes: async (path, data) => {
      await client.put(data, path)
    },
    readText: async (path) => {
      if (!(await client.exists(path))) return null
      return ((await client.get(path)) as Buffer).toString('utf8')
    },
    writeText: async (path, text) => {
      await client.put(Buffer.from(text), path)
    },
    upload: async (local, remote) => {
      await client.fastPut(local, remote)
    },
    ensureDir: async (dir) => {
      if (!(await client.exists(dir))) await client.mkdir(dir, true)
    },
    remove: async (path) => {
      await client.delete(path, true)
    },
    rename: async (from, to) => {
      // posix-rename replaces the target; plain SFTP rename refuses to.
      await client.posixRename(from, to).catch(async () => {
        await client.delete(to, true)
        await client.rename(from, to)
      })
    },
    close: async () => {
      await client.end()
    }
  }
}

/** Login and network errors in plain words. */
function friendly(error: unknown, connection: ServerConnection): Error {
  const message = (error as Error).message ?? String(error)
  const where = `${connection.host}:${connection.port || (connection.type === 'sftp' ? 22 : 21)}`
  if (/ENOTFOUND|EAI_AGAIN/.test(message))
    return new Error(`Can’t find the server ${connection.host}.`)
  if (/ECONNREFUSED/.test(message))
    return new Error(
      `${where} refused the connection. Check the address and port` +
        (connection.type === 'ftp' ? ', or try SFTP.' : '.')
    )
  if (/ETIMEDOUT|Timeout|timed out/i.test(message))
    return new Error(`${where} didn’t answer in time.`)
  if (
    /\b530\b|authentication|auth fail|All configured authentication methods failed/i.test(message)
  )
    return new Error(
      `The server didn’t accept the user name or password for ${connection.username}.`
    )
  if (/AUTH TLS|\b534\b|TLS/i.test(message) && connection.type === 'ftp')
    return new Error(`${where}: ${message}. If the server has no TLS, turn off “Encrypt (FTPS)”.`)
  return new Error(`${where}: ${message}`)
}

export async function openRemote(
  connection: ServerConnection,
  onHostKey?: (key: string) => void
): Promise<Remote> {
  return connection.type === 'sftp' ? openSftp(connection, onHostKey) : openFtp(connection)
}

/** The site's folder as an absolute path ('' or relative = from where the login starts). */
export const baseOf = (remote: Remote, remoteDir: string): string =>
  posix.normalize(remoteDir.startsWith('/') ? remoteDir : posix.join(remote.home, remoteDir || '.'))

/** Logs in and lists the folders in `dir`: the connection test and the folder picker. */
export async function checkServer(
  connection: ServerConnection,
  dir?: string,
  onHostKey?: (key: string) => void
): Promise<ServerCheck> {
  let hostKey: string | undefined
  const remote = await openRemote(connection, (key) => {
    hostKey = key
    onHostKey?.(key)
  })
  try {
    const at = dir ? baseOf(remote, dir) : remote.home
    const dirs = (await remote.list(at))
      .filter((entry) => entry.dir && entry.name !== '.' && entry.name !== '..')
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b))
    return { home: at, dirs, hostKey: hostKey ?? connection.hostKey }
  } finally {
    await remote.close().catch(() => null)
  }
}

async function readManifest(remote: Remote, base: string): Promise<Manifest | null> {
  const text = await remote.readText(posix.join(base, MANIFEST))
  if (!text) return null
  try {
    const manifest = JSON.parse(text) as Manifest
    return manifest && typeof manifest.files === 'object' ? manifest : null
  } catch {
    return null
  }
}

/**
 * What is on the server now, for the "published from somewhere else" check: the
 * manifest, or, when there is none, whether the folder already holds files.
 */
export async function liveServerState(
  connection: ServerConnection,
  site: SiteSettings,
  onHostKey?: (key: string) => void
): Promise<{ manifest: Manifest | null; occupied: boolean }> {
  const remote = await openRemote(connection, onHostKey)
  try {
    const base = baseOf(remote, site.deploy.remoteDir)
    const manifest = await readManifest(remote, base)
    if (manifest) return { manifest, occupied: true }
    const entries = await remote.list(base).catch(() => [])
    return {
      manifest: null,
      occupied: entries.some((entry) => !['.', '..', MANIFEST_DIR].includes(entry.name))
    }
  } finally {
    await remote.close().catch(() => null)
  }
}

/** The foreign-publish notice for a server, or null when this folder may publish over it. */
export function foreignOnServer(
  state: { manifest: Manifest | null; occupied: boolean },
  published: (id: string) => boolean
): ForeignDeploy | null {
  if (state.manifest)
    return published(state.manifest.id)
      ? null
      : {
          id: state.manifest.id,
          createdOn: state.manifest.at,
          source: `CraftPages on ${state.manifest.device}`,
          author: ''
        }
  return state.occupied
    ? {
        id: '',
        createdOn: '',
        source: 'files already in the server folder (not published with CraftPages)',
        author: ''
      }
    : null
}

/** Pages last, so a new page never links to an asset that isn't uploaded yet. */
const isPage = (path: string): boolean => /\.html?$/i.test(path)

export async function deployServer(
  root: string,
  site: SiteSettings,
  connection: ServerConnection,
  onProgress: (progress: DeployProgress) => void,
  onHostKey?: (key: string) => void
): Promise<DeployResult> {
  onProgress({ phase: 'scan', message: 'Hashing site files…' })
  // Apache reads redirects from .htaccess, not _redirects.
  await syncHtaccess(root)
  const files = await collect(root, site, { server: true })

  onProgress({ phase: 'check', message: `Connecting to ${connection.host}…` })
  const remote = await openRemote(connection, onHostKey)
  try {
    const base = baseOf(remote, site.deploy.remoteDir)
    const previous = (await readManifest(remote, base))?.files ?? {}
    const local = new Map(files.map((file) => [file.path, file.hash]))
    const changed: SiteFile[] = files
      .filter((file) => previous[file.path] !== file.hash)
      .sort((a, b) => Number(isPage(a.path)) - Number(isPage(b.path)))
    const removed = Object.keys(previous).filter((path) => !local.has(path))

    const total = changed.length + removed.length
    let done = 0
    const step = (message: string): void => onProgress({ phase: 'upload', message, done, total })
    step(`Uploading ${changed.length} changed files…`)

    const made = new Set<string>()
    for (const file of changed) {
      const target = posix.join(base, file.path)
      const dir = posix.dirname(target)
      if (!made.has(dir)) {
        await remote.ensureDir(dir)
        made.add(dir)
      }
      await remote.upload(join(root, file.path), target)
      done += 1
      step(`Uploaded ${done} of ${total}: ${file.path}`)
    }
    for (const path of removed) {
      await remote.remove(posix.join(base, path)).catch(() => null)
      done += 1
      step(`Removed ${path}`)
    }

    onProgress({ phase: 'deploy', message: 'Saving the publish record on the server…' })
    const manifest: Manifest = {
      version: 1,
      id: `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomBytes(3).toString('hex')}`,
      at: new Date().toISOString(),
      device: hostname(),
      files: Object.fromEntries(local)
    }
    await remote.ensureDir(posix.join(base, MANIFEST_DIR))
    // Written aside and renamed, so a cut connection never leaves half a manifest.
    const temp = posix.join(base, `${MANIFEST}.tmp`)
    await remote.writeText(temp, JSON.stringify(manifest, null, 2))
    await remote.rename(temp, posix.join(base, MANIFEST))

    const url = site.baseUrl || ''
    await saveState(root, files, { id: manifest.id, url, branch: 'production' })
    onProgress({
      phase: 'done',
      message: `Published to ${connection.host}${base}: ${changed.length} uploaded, ${removed.length} removed.`
    })
    return { id: manifest.id, url, uploaded: changed.length, total: files.length }
  } finally {
    await remote.close().catch(() => null)
  }
}

/** The publish on the server now, as the only entry the history can show for now. */
export function serverDeployments(manifest: Manifest | null, site: SiteSettings): Deployment[] {
  if (!manifest) return []
  return [
    {
      id: manifest.id,
      url: site.baseUrl,
      environment: 'production',
      branch: manifest.device,
      createdOn: manifest.at,
      status: 'success',
      aliases: []
    }
  ]
}
