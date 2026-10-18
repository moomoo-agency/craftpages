import { app, safeStorage } from 'electron'
import { randomBytes } from 'crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'fs/promises'
import { basename, join } from 'path'
import {
  DEFAULT_LIST_PATH,
  DEFAULT_PERMALINK,
  normalizePath,
  normalizePermalink
} from '../shared/blog-urls'
import { LANGUAGE_CODE, LANGUAGE_FOLDER, languageName, normalizeFolder } from '../shared/languages'
import type {
  AppSettings,
  ConnectionInput,
  ConnectionsView,
  DeepPartial,
  DeployConnection,
  DeployConnectionView,
  SiteLanguage,
  SiteSettings
} from '../shared/types'
import { isServerConnection } from '../shared/types'
import { log } from './log'
import { registerSecrets } from './redact'

export const DEFAULT_MCP_PORT = 7424

const DEFAULT_APP: AppSettings = {
  mcp: { enabled: true, port: DEFAULT_MCP_PORT },
  lastWorkspace: null,
  recentProjects: [],
  connections: [],
  formsAccounts: [],
  background: { keepRunning: true, openAtLogin: false }
}

const MAX_RECENT = 30

function merge<T>(base: T, patch: DeepPartial<T> | undefined): T {
  if (!patch) return base
  const out = { ...base } as Record<string, unknown>
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue
    const current = out[key]
    out[key] =
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      current &&
      typeof current === 'object'
        ? merge(current, value as DeepPartial<typeof current>)
        : value
  }
  return out as T
}

async function readJson<T>(file: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T
  } catch {
    return undefined
  }
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await mkdir(join(file, '..'), { recursive: true })
  await writeFile(file, JSON.stringify(value, null, 2) + '\n')
}

// ---------- App settings ----------

const appFile = (): string => join(app.getPath('userData'), 'settings.json')
let appSettings: AppSettings | null = null

export async function getAppSettings(): Promise<AppSettings> {
  if (!appSettings) {
    const stored = await readJson<AppSettings & { cloudflare?: unknown }>(appFile())
    // Cloudflare credentials used to be app-wide; they're per project now.
    delete stored?.cloudflare
    appSettings = merge(DEFAULT_APP, stored)
  }
  return appSettings
}

export async function saveAppSettings(patch: DeepPartial<AppSettings>): Promise<AppSettings> {
  const next = merge(await getAppSettings(), patch)
  const port = Number(next.mcp.port)
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error('Port must be a whole number between 1024 and 65535.')
  }
  next.mcp.port = port
  appSettings = next
  await writeJson(appFile(), next)
  return next
}

export async function getAppSettingsView(): Promise<AppSettings> {
  return getAppSettings()
}

/** Puts a project at the top of the recent list. */
export async function rememberProject(root: string): Promise<void> {
  const { recentProjects } = await getAppSettings()
  const entry = { path: root, name: basename(root), openedAt: new Date().toISOString() }
  const rest = recentProjects.filter((project) => project.path !== root)
  await saveAppSettings({
    lastWorkspace: root,
    recentProjects: [entry, ...rest].slice(0, MAX_RECENT)
  })
}

export async function forgetProject(root: string): Promise<void> {
  const { recentProjects, lastWorkspace } = await getAppSettings()
  await saveAppSettings({
    recentProjects: recentProjects.filter((project) => project.path !== root),
    lastWorkspace: lastWorkspace === root ? null : lastWorkspace
  })
}

// ---------- Secrets (OS keychain via safeStorage) ----------

interface Secrets {
  /** Deploy connection tokens by connection id. */
  connectionTokens?: Record<string, string>
  /** CraftForms API tokens by account id. */
  formsTokens?: Record<string, string>
  /** Before connections: Cloudflare tokens by project id. Moved on first open. */
  cloudflareTokens?: Record<string, string>
  mcpToken?: string
  /** This computer's id for sync stores (its Worker secret is KEY_<id>). */
  syncDevice?: string
  /** Sync secrets: a device key per Cloudflare account, a passphrase per project on servers. */
  syncSecrets?: Record<string, string>
}

const secretsFile = (): string => join(app.getPath('userData'), 'secrets.bin')

/**
 * Whether secrets can be encrypted with a key the OS protects (Keychain,
 * DPAPI, a Linux keyring). On Linux without a keyring Electron falls back to
 * "basic_text", a hardcoded key: that's obfuscation, so it counts as none.
 */
function keychainAvailable(): boolean {
  if (!safeStorage.isEncryptionAvailable()) return false
  if (process.platform !== 'linux') return true
  const backend = safeStorage.getSelectedStorageBackend()
  return backend !== 'basic_text' && backend !== 'unknown'
}
// The secrets as one shared load: callers at launch (MCP, sync, deploy) wait for the same
// read instead of a second caller seeing an empty set and saving it over every token.
let secrets: Promise<Secrets> | null = null

function readSecrets(): Promise<Secrets> {
  return (secrets ??= loadSecrets())
}

async function loadSecrets(): Promise<Secrets> {
  let loaded: Secrets = {}
  if (!keychainAvailable()) {
    // A file written with the weak fallback key doesn't stay around to be read.
    if (safeStorage.isEncryptionAvailable()) await rm(secretsFile(), { force: true })
    return loaded
  }
  let data: Buffer
  try {
    data = await readFile(secretsFile())
  } catch {
    return loaded
  }
  try {
    loaded = JSON.parse(safeStorage.decryptString(data)) as Secrets
    registerSecrets(loaded)
  } catch (error) {
    // Unreadable (e.g. the keychain refused or was reset): start empty, but move the file
    // aside first, so the next write can't destroy tokens a working keychain could still read.
    const aside = `${secretsFile()}.unreadable-${new Date().toISOString().replace(/[:.]/g, '-')}`
    await rename(secretsFile(), aside).catch(() => null)
    log.warn('settings', 'Saved tokens could not be read; starting without them', {
      kept: basename(aside),
      error: (error as Error).message
    })
  }
  return loaded
}

// Changes run one at a time, each on the result of the last, so two at once can't drop either.
let writes: Promise<unknown> = Promise.resolve()

/** Changes the secrets: `change` gets the current ones and returns the next, or null to keep them. */
function updateSecrets<T = void>(
  change: (current: Secrets) => { next: Secrets | null; result?: T }
): Promise<T> {
  const run = writes.then(async () => {
    const { next, result } = change(await readSecrets())
    if (next) await writeSecrets(next)
    return result as T
  })
  writes = run.catch(() => null)
  return run
}

async function writeSecrets(next: Secrets): Promise<void> {
  secrets = Promise.resolve(next)
  registerSecrets(next)
  // Without a keychain the values stay in memory only, never on disk in plain text.
  if (!keychainAvailable()) return
  await mkdir(app.getPath('userData'), { recursive: true })
  await writeFile(secretsFile(), safeStorage.encryptString(JSON.stringify(next)))
}

// ---------- CraftForms accounts (app-wide, several) ----------

export async function formsToken(id: string): Promise<string> {
  return (await readSecrets()).formsTokens?.[id] ?? ''
}

export async function setFormsToken(id: string, token: string | null): Promise<void> {
  await updateSecrets((current) => {
    const tokens = { ...current.formsTokens }
    if (token) tokens[id] = token
    else delete tokens[id]
    return { next: { ...current, formsTokens: tokens } }
  })
}

// ---------- Deploy connections (app-wide, several) ----------

async function setConnectionToken(id: string, token: string | null): Promise<void> {
  await updateSecrets((current) => {
    const tokens = { ...current.connectionTokens }
    if (token) tokens[id] = token
    else delete tokens[id]
    return { next: { ...current, connectionTokens: tokens } }
  })
}

export async function listConnections(): Promise<ConnectionsView> {
  const { connections, recentProjects } = await getAppSettings()
  const tokens = (await readSecrets()).connectionTokens ?? {}
  const uses = await Promise.all(
    recentProjects.map(async (project) => {
      const stored = await readJson<SiteSettings>(siteFile(project.path))
      return { name: project.name, connection: stored?.deploy?.connection }
    })
  )
  return {
    connections: connections.map((connection): DeployConnectionView => ({
      ...connection,
      hasToken: Boolean(tokens[connection.id]),
      usedBy: uses.filter((use) => use.connection === connection.id).map((use) => use.name)
    })),
    keychainAvailable: keychainAvailable()
  }
}

/** The server fields of a connection, checked; throws with what's missing. */
export function serverFields(
  input: ConnectionInput
): Pick<DeployConnection, 'host' | 'port' | 'username' | 'secure' | 'keyPath'> {
  const host = (input.host ?? '')
    .trim()
    .replace(/^(s?ftps?|ssh):\/\//i, '')
    .replace(/\/.*$/, '')
  if (!host) throw new Error('Enter the server address, e.g. ftp.example.com.')
  const username = (input.username ?? '').trim()
  if (!username) throw new Error('Enter the user name for the server.')
  const fallback = input.type === 'sftp' ? 22 : 21
  const port = Number(input.port) || fallback
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('The port is a number between 1 and 65535.')
  return {
    host,
    port,
    username,
    ...(input.type === 'ftp' ? { secure: Boolean(input.secure) } : {}),
    ...(input.type === 'sftp' && input.keyPath?.trim() ? { keyPath: input.keyPath.trim() } : {})
  }
}

export async function saveConnection(input: ConnectionInput): Promise<DeployConnectionView> {
  const { connections } = await getAppSettings()
  const name = input.name.trim()
  const server = isServerConnection(input.type)
  const accountId = server ? '' : input.accountId.trim()
  if (!name)
    throw new Error(
      server
        ? 'Give the connection a name, e.g. “My hosting”.'
        : 'Give the connection a name, e.g. “My Cloudflare”.'
    )
  if (!server && !/^[0-9a-f]{32}$/i.test(accountId)) {
    throw new Error('The account ID is 32 letters and digits (Cloudflare → Workers & Pages).')
  }
  const existing = input.id ? connections.find((c) => c.id === input.id) : undefined
  if (input.id && !existing) throw new Error('That connection no longer exists.')
  const fields = server ? serverFields(input) : {}
  const connection: DeployConnection = {
    id: existing?.id ?? randomBytes(6).toString('hex'),
    type: input.type,
    name,
    accountId,
    ...fields,
    // A host key stays trusted only while the server it belongs to stays the same.
    ...(existing?.hostKey && existing.host === fields.host && existing.port === fields.port
      ? { hostKey: existing.hostKey }
      : {})
  }
  if (input.token !== undefined) await setConnectionToken(connection.id, input.token.trim() || null)
  else if (!existing && !(input.type === 'sftp' && connection.keyPath))
    throw new Error(server ? 'Enter the password.' : 'Paste the API token.')
  await saveAppSettings({
    connections: existing
      ? connections.map((c) => (c.id === connection.id ? connection : c))
      : [...connections, connection]
  })
  return (await listConnections()).connections.find((c) => c.id === connection.id)!
}

export async function deleteConnection(id: string): Promise<void> {
  const { connections } = await getAppSettings()
  await saveAppSettings({ connections: connections.filter((c) => c.id !== id) })
  await setConnectionToken(id, null)
}

/** A connection with its token, for making API calls. */
export async function connectionById(id: string): Promise<DeployConnection & { token: string }> {
  const connection = (await getAppSettings()).connections.find((c) => c.id === id)
  if (!connection) throw new Error('Choose a deploy connection in Project settings → Deploy first.')
  const token = (await readSecrets()).connectionTokens?.[id] ?? ''
  // An SFTP key without a passphrase needs no secret.
  if (!token && !(connection.type === 'sftp' && connection.keyPath))
    throw new Error(
      `“${connection.name}” has no ${isServerConnection(connection.type) ? 'password' : 'API token'}. Add it in Settings.`
    )
  return { ...connection, token }
}

/** The stored secret of a connection ('' when none), e.g. to test edits before saving. */
export async function connectionSecret(id: string): Promise<string> {
  return (await readSecrets()).connectionTokens?.[id] ?? ''
}

/** Remembers the SFTP server key a connection trusts from now on. */
export async function trustHostKey(id: string, hostKey: string): Promise<void> {
  const { connections } = await getAppSettings()
  if (!connections.some((c) => c.id === id)) return
  await saveAppSettings({
    connections: connections.map((c) => (c.id === id ? { ...c, hostKey } : c))
  })
}

/**
 * Projects used to keep their own Cloudflare account ID (site.json) and token
 * (keychain). Turns that into an app connection, reusing one with the same
 * account and token, and points the project at it.
 */
export async function migrateDeploy(root: string): Promise<void> {
  const stored = await readJson<SiteSettings & { deploy?: { accountId?: string } }>(siteFile(root))
  const accountId = stored?.deploy?.accountId?.trim()
  if (!stored || stored.deploy?.connection || accountId === undefined) return
  const current = await readSecrets()
  const token = current.cloudflareTokens?.[stored.id]
  let connection = ''
  if (accountId) {
    const tokens = current.connectionTokens ?? {}
    const { connections } = await getAppSettings()
    const same = connections.find(
      (c) => c.accountId === accountId && (!token || tokens[c.id] === token)
    )
    connection =
      same?.id ??
      (
        await saveConnection({
          type: 'cloudflare-pages',
          name: `Cloudflare · ${stored.siteName || basename(root)}`,
          accountId,
          token: token ?? ''
        }).catch(() => null)
      )?.id ??
      ''
    // An account ID the connection check refuses stays where it is, for the user to fix.
    if (!connection) return
  }
  if (token) {
    await updateSecrets((current) => {
      const tokens = { ...current.cloudflareTokens }
      delete tokens[stored.id]
      return { next: { ...current, cloudflareTokens: tokens } }
    })
  }
  delete stored.deploy.accountId
  stored.deploy.connection = connection
  await writeJson(siteFile(root), stored)
}

/** This computer's stable sync id: 12 uppercase hex characters. */
export async function syncDeviceId(): Promise<string> {
  return updateSecrets((current) => {
    if (current.syncDevice) return { next: null, result: current.syncDevice }
    const id = randomBytes(6).toString('hex').toUpperCase()
    return { next: { ...current, syncDevice: id }, result: id }
  })
}

export async function getSyncSecret(name: string): Promise<string | null> {
  return (await readSecrets()).syncSecrets?.[name] ?? null
}

export async function setSyncSecret(name: string, value: string | null): Promise<void> {
  await updateSecrets((current) => {
    const next = { ...current.syncSecrets }
    if (value) next[name] = value
    else delete next[name]
    return { next: { ...current, syncSecrets: next } }
  })
}

/** Bearer token AI clients must send. Kept across launches so the client config keeps working. */
export async function getMcpToken(): Promise<string> {
  return updateSecrets((current) => {
    if (current.mcpToken) return { next: null, result: current.mcpToken }
    const token = randomBytes(24).toString('base64url')
    return { next: { ...current, mcpToken: token }, result: token }
  })
}

export async function regenerateMcpToken(): Promise<string> {
  return updateSecrets((current) => {
    const token = randomBytes(24).toString('base64url')
    return { next: { ...current, mcpToken: token }, result: token }
  })
}

// ---------- Site settings (.sitecms/site.json) ----------

export const APP_DIR = '.sitecms'

function defaultSite(root: string): SiteSettings {
  return {
    id: randomBytes(8).toString('hex'),
    siteName: basename(root),
    baseUrl: '',
    locale: 'en',
    languages: [],
    deploy: {
      connection: '',
      target: 'workers',
      projectName: '',
      workerName: '',
      productionBranch: 'main',
      previewBranch: 'preview',
      remoteDir: '',
      exclude: ['.DS_Store', 'Thumbs.db', '*.bak*']
    },
    images: { maxWidth: 2400, quality: 80, pngToJpeg: true, dir: 'assets/img' },
    editing: { codeEditor: false },
    forms: { account: '', accountHint: '', domain: '' },
    seo: {
      titlePattern: '%title% · %site%',
      defaultImage: '',
      sitemapAuto: false,
      sitemapExclude: []
    },
    blog: {
      permalink: DEFAULT_PERMALINK,
      listPath: DEFAULT_LIST_PATH,
      postsPerPage: 10,
      title: 'Blog',
      scheduleDeploy: false,
      emptyText: 'No posts yet.'
    }
  }
}

const siteFile = (root: string): string => join(root, APP_DIR, 'site.json')

/** Best guess of the live origin from the home page's canonical or og:url. */
async function inferBaseUrl(root: string): Promise<string> {
  try {
    const html = await readFile(join(root, 'index.html'), 'utf8')
    const match =
      html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i) ??
      html.match(/<meta[^>]+property=["']og:url["'][^>]*content=["']([^"']+)["']/i)
    return match ? new URL(match[1]).origin : ''
  } catch {
    return ''
  }
}

/** What a connection points at, the same on every computer. */
export const connectionHint = (connection: DeployConnection): string =>
  isServerConnection(connection.type)
    ? `${connection.type}:${connection.username}@${connection.host}:${connection.port ?? ''}`
    : `cloudflare:${connection.accountId}`

/** This computer's connection matching a hint from another computer, if any. */
export async function connectionForHint(hint: string | undefined): Promise<string | null> {
  if (!hint) return null
  const found = (await getAppSettings()).connections.find((c) => connectionHint(c) === hint)
  return found?.id ?? null
}

/** A server folder as /path/without/trailing/slash ('' = where the login starts). */
export function normalizeRemoteDir(dir: string): string {
  const clean = dir.trim().replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '')
  if (clean.split('/').includes('..')) throw new Error('The server folder can’t contain “..”.')
  return clean
}

export const WORKER_NAME = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/

/** Whether a project has somewhere to publish to. */
export const deployTarget = (site: SiteSettings): string =>
  site.deploy.target === 'server'
    ? site.deploy.connection
      ? site.deploy.remoteDir || '/'
      : ''
    : site.deploy.target === 'pages'
      ? site.deploy.projectName
      : site.deploy.workerName

export async function getSiteSettings(root: string): Promise<SiteSettings> {
  const stored = await readJson<SiteSettings>(siteFile(root))
  const settings = merge(defaultSite(root), stored)
  if (!stored) {
    settings.baseUrl = await inferBaseUrl(root)
    // Kept from the first read on: the project id must stay the same (keychain, sync).
    await writeJson(siteFile(root), settings).catch(() => null)
  }
  // Set up before the code editor became an option: keeps it, as it always had it.
  if (stored && stored.editing?.codeEditor === undefined) settings.editing.codeEditor = true
  // Set up before Workers were supported: keeps publishing to its Pages project.
  if (stored?.deploy && !stored.deploy.target && stored.deploy.projectName)
    settings.deploy.target = 'pages'
  return settings
}

/** Validates a site's languages: one at the root, distinct codes and folders. */
export function checkLanguages(languages: SiteLanguage[]): SiteLanguage[] {
  if (!languages.length) return []
  const out = languages.map((language) => ({
    code: language.code.trim(),
    name: language.name.trim() || languageName(language.code.trim()),
    path: normalizeFolder(language.path),
    ...(language.blogTitle?.trim() ? { blogTitle: language.blogTitle.trim() } : {}),
    ...(language.label?.trim() ? { label: language.label.trim().slice(0, 40) } : {}),
    ...(language.flag?.trim() ? { flag: language.flag.trim() } : {})
  }))
  for (const language of out) {
    if (!LANGUAGE_CODE.test(language.code))
      throw new Error(`“${language.code}” isn’t a language code (e.g. it, en, pt-BR).`)
    if (language.path && !LANGUAGE_FOLDER.test(language.path))
      throw new Error(
        `“${language.path}” can’t be a language folder: use letters, digits and dashes.`
      )
  }
  const roots = out.filter((language) => !language.path)
  if (roots.length !== 1)
    throw new Error('One language lives at the root of the site: it’s the default language.')
  const seen = (key: (language: SiteLanguage) => string, what: string): void => {
    const keys = out.map(key)
    const twice = keys.find((value, index) => keys.indexOf(value) !== index)
    if (twice !== undefined) throw new Error(`Two languages use the same ${what}: “${twice}”.`)
  }
  seen((language) => language.code.toLowerCase(), 'code')
  seen((language) => language.path.toLowerCase(), 'folder')
  // A folder inside another language's folder would make its pages belong to both.
  for (const a of out)
    for (const b of out)
      if (a !== b && a.path && b.path && b.path.startsWith(a.path))
        throw new Error(`The folder “${b.path}” is inside “${a.path}”.`)
  // The root first, then as given.
  return [roots[0], ...out.filter((language) => language.path)]
}

export async function saveSiteSettings(
  root: string,
  patch: DeepPartial<SiteSettings>
): Promise<SiteSettings> {
  const next = merge(await getSiteSettings(root), patch)
  next.baseUrl = next.baseUrl.trim().replace(/\/+$/, '')
  if (next.baseUrl && !/^https?:\/\//.test(next.baseUrl)) {
    throw new Error('Base URL must start with https:// (or http://).')
  }
  next.deploy.projectName = next.deploy.projectName.trim()
  next.deploy.workerName = next.deploy.workerName.trim().toLowerCase()
  if (next.deploy.workerName && !WORKER_NAME.test(next.deploy.workerName))
    throw new Error('Worker names use lowercase letters, digits and dashes (up to 63 characters).')
  next.blog.permalink = normalizePermalink(next.blog.permalink)
  next.blog.listPath = normalizePath(next.blog.listPath || DEFAULT_LIST_PATH)
  if (next.blog.listPath === '/')
    throw new Error('The post list needs its own address, e.g. /blog/.')
  next.blog.postsPerPage = Math.max(1, Math.round(Number(next.blog.postsPerPage) || 10))
  next.blog.title = next.blog.title.trim() || 'Blog'
  next.seo.titlePattern = next.seo.titlePattern.trim() || '%title%'
  next.seo.defaultImage = next.seo.defaultImage.trim()
  next.seo.sitemapExclude = next.seo.sitemapExclude.map((p) => p.trim()).filter(Boolean)
  next.deploy.exclude = next.deploy.exclude.map((pattern) => pattern.trim()).filter(Boolean)
  next.deploy.remoteDir = normalizeRemoteDir(next.deploy.remoteDir)
  const connection = (await getAppSettings()).connections.find(
    (c) => c.id === next.deploy.connection
  )
  if (connection) next.deploy.connectionHint = connectionHint(connection)
  next.images.dir = next.images.dir.trim().replace(/^\/+|\/+$/g, '') || 'assets/img'
  next.languages = checkLanguages(next.languages)
  // The root language is the site's language: blog dates and the like follow it.
  const root_ = next.languages.find((language) => !language.path)
  if (root_) next.locale = root_.code
  await writeJson(siteFile(root), next)
  return next
}
