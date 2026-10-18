import { createHash, randomBytes } from 'crypto'
import { createServer } from 'http'
import { hostname } from 'os'
import { BrowserWindow, app, shell } from 'electron'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import {
  APP_DIR,
  getAppSettings,
  getSiteSettings,
  saveAppSettings,
  saveSiteSettings,
  formsToken,
  setFormsToken
} from './settings'
import { registerSecret } from './redact'
import { log } from './log'
import { hasDraft, renderWithDrafts } from './drafts'
import { writeFiles } from './history'
import { listFiles } from './workspace'
import { getWorkspace } from './state'
import { isPublished } from './deploy/exclude'
import {
  applyPatches,
  attr,
  attrPatches,
  parseWithLocations,
  walk,
  type Document,
  type Element
} from './html/dom'
import { resolveLocator } from './html/locator'
import {
  EMBED_KEY,
  LOADER_SRC,
  embedDiv,
  embedSnippet,
  loaderTag,
  siteOfKey,
  storedDomain
} from '../shared/forms'
import type {
  ElementLocator,
  FormsAccount,
  FormsAccountInfo,
  FormsAccountView,
  FormsEmbed,
  FormsEmbedSettings,
  FormsEmbedSource,
  FormsEnsured,
  FormsList,
  FormsProject,
  IconPosition,
  SiteSettings
} from '../shared/types'

/**
 * CraftForms accounts (unfinished/CRAFTFORMS.md; the server side is
 * CRAFTPAGES_INTEGRATION.md in the saashosting repo).
 *
 * Connecting is OAuth for native apps (RFC 8252): the browser opens
 * my.craftforms.app/connect, the customer logs in or creates a free account and
 * presses Allow, and the browser comes back to a one-shot listener on
 * 127.0.0.1 with a code. The code and this side's PKCE verifier buy an API
 * token, kept in the keychain. CraftPages never sees the password.
 */

/** Overridable for local development of the CraftForms app. */
const SERVICE = (process.env.CRAFTPAGES_CRAFTFORMS_URL ?? 'https://my.craftforms.app').replace(
  /\/+$/,
  ''
)
const CLIENT_ID = 'craftpages'
/** How long the browser has to come back. */
const CONNECT_TIMEOUT = 5 * 60_000
const REQUEST_TIMEOUT = 15_000

const base64url = (buf: Buffer): string =>
  buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

/** "Vitaliis-MacBook-Pro.local", "Macmini.Home" → the first part: shown under Connected apps. */
const deviceName = (): string => hostname().split('.')[0].slice(0, 80)

interface ApiError {
  error?: { code?: string; message?: string } | string
}

async function call<T>(
  service: string,
  path: string,
  init: { method?: string; token?: string; body?: unknown } = {}
): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${service}/api/v1${path}`, {
      method: init.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(init.token ? { Authorization: `Bearer ${init.token}` } : {})
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT)
    })
  } catch {
    throw new Error(`Can’t reach ${new URL(service).host}. Check your internet connection.`)
  }
  if (response.status === 204) return undefined as T
  const data = (await response.json().catch(() => ({}))) as T & ApiError
  if (!response.ok) {
    const error = typeof data.error === 'string' ? { message: data.error } : data.error
    const failure = new Error(error?.message ?? `CraftForms answered ${response.status}.`)
    ;(failure as Error & { code?: string }).code =
      error?.code ?? (response.status === 401 ? 'invalid_token' : undefined)
    throw failure
  }
  return data
}

// ---------- Accounts ----------

export async function listFormsAccounts(): Promise<FormsAccountView[]> {
  const { formsAccounts } = await getAppSettings()
  return Promise.all(
    formsAccounts.map(async (account) => ({
      ...account,
      hasToken: Boolean(await formsToken(account.id))
    }))
  )
}

async function accountById(id: string): Promise<{ account: FormsAccount; token: string }> {
  const account = (await getAppSettings()).formsAccounts.find((a) => a.id === id)
  if (!account) throw new Error('That CraftForms account is no longer connected.')
  const token = await formsToken(id)
  if (!token) throw new Error(`Connect ${account.email} again: its sign-in is missing.`)
  return { account, token }
}

/** The account card, live. A refused token clears it, so the UI offers to connect again. */
export async function formsAccountInfo(id: string): Promise<FormsAccountInfo> {
  const { account, token } = await accountById(id)
  try {
    const info = await call<FormsAccountInfo>(account.service, '/me', { token })
    if (info.plan !== account.plan || info.email !== account.email || info.name !== account.name) {
      await updateAccount({ ...account, plan: info.plan, email: info.email, name: info.name })
    }
    return info
  } catch (error) {
    if ((error as { code?: string }).code === 'invalid_token') {
      await setFormsToken(id, null)
      throw new Error(`${account.email} was disconnected on craftforms.app. Connect it again.`)
    }
    throw error
  }
}

async function updateAccount(next: FormsAccount): Promise<void> {
  const { formsAccounts } = await getAppSettings()
  const others = formsAccounts.filter((a) => a.id !== next.id)
  await saveAppSettings({ formsAccounts: [...others, next] })
}

/** Removes the account here, and its token on craftforms.app when that can be reached. */
export async function disconnectFormsAccount(id: string): Promise<void> {
  const { formsAccounts } = await getAppSettings()
  const account = formsAccounts.find((a) => a.id === id)
  const token = await formsToken(id)
  if (account && token) {
    await call(account.service, '/connect/token', { method: 'DELETE', token }).catch((error) =>
      // Offline or already revoked: forgetting it here is what the user asked for.
      log.warn('craftforms', 'Could not revoke the token on the server', error)
    )
  }
  await setFormsToken(id, null)
  await saveAppSettings({ formsAccounts: formsAccounts.filter((a) => a.id !== id) })
}

// ---------- Connecting ----------

let pending: { cancel: (reason: string) => void } | null = null

/** Stops a connect in progress (the user closed the dialog). */
export function cancelFormsConnect(): void {
  pending?.cancel('cancelled')
}

const PAGE = (title: string, text: string): string =>
  `<!doctype html><meta charset="utf-8"><title>${title}</title><meta name="viewport" content="width=device-width,initial-scale=1">` +
  `<style>body{font:16px/1.5 system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#f4f5f7;color:#1d1d1f}` +
  `main{max-width:420px;padding:32px;background:#fff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,.08);text-align:center}h1{font-size:20px;margin:0 0 8px}p{margin:0;color:#555}</style>` +
  `<main><h1>${title}</h1><p>${text}</p></main>`

/**
 * Listens on 127.0.0.1 for the browser's way back. `onListening` gets the
 * redirect address once the port is known (that's when the browser can open).
 * Resolves with the code; rejects on Cancel in the browser, cancelFormsConnect,
 * a newer connect, or the timeout.
 */
function waitForCode(
  state: string,
  onListening: (redirectUri: string) => void
): Promise<{ code: string; redirectUri: string }> {
  pending?.cancel('replaced')
  return new Promise((resolve, reject) => {
    let settled = false
    let redirectUri = ''
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1')
      if (url.pathname !== '/cb') {
        res.writeHead(404).end()
        return
      }
      // Someone else's state is not ours: say so, and keep waiting for the real one.
      if (url.searchParams.get('state') !== state) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(PAGE('Something went wrong', 'Start connecting again from CraftPages.'))
        return
      }
      const error = url.searchParams.get('error')
      const code = url.searchParams.get('code') ?? ''
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store'
      })
      if (error || !code) {
        res.end(PAGE('Not connected', 'You can close this tab.'))
        finish(
          new Error(error === 'access_denied' ? 'cancelled' : 'The connection was not completed.')
        )
        return
      }
      registerSecret(code)
      res.end(PAGE('Connected', 'You can close this tab and go back to CraftPages.'))
      finish(null, code)
    })
    const timer = setTimeout(() => finish(new Error('timeout')), CONNECT_TIMEOUT)
    function finish(error: Error | null, code = ''): void {
      if (settled) return
      settled = true
      clearTimeout(timer)
      pending = null
      // Let the response reach the browser before the listener goes.
      setTimeout(() => server.close(), 1000)
      if (error) reject(error)
      else resolve({ code, redirectUri })
    }
    server.on('error', (error) => finish(error))
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      redirectUri = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}/cb`
      pending = { cancel: (reason) => finish(new Error(reason)) }
      onListening(redirectUri)
    })
  })
}

/**
 * Connect (or reconnect) an account: browser sign-in, then the token. The same
 * email on the same service replaces its old connection, revoking the old token.
 */
export async function connectFormsAccount(): Promise<FormsAccountView> {
  const verifier = base64url(randomBytes(32))
  registerSecret(verifier)
  const challenge = base64url(createHash('sha256').update(verifier).digest())
  const state = base64url(randomBytes(16))

  const openBrowser = (redirectUri: string): void => {
    const url = new URL(`${SERVICE}/connect`)
    url.search = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: redirectUri,
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      device: deviceName()
    }).toString()
    // CRAFTPAGES_NO_BROWSER: automated tests finish the sign-in themselves.
    if (process.env.CRAFTPAGES_NO_BROWSER) log.info('craftforms', `Connect URL: ${url}`)
    else void shell.openExternal(url.toString())
  }
  let code: string
  let redirectUri: string
  try {
    ;({ code, redirectUri } = await waitForCode(state, openBrowser))
  } catch (error) {
    const reason = (error as Error).message
    if (reason === 'cancelled' || reason === 'replaced')
      throw new Error('Connecting was cancelled.')
    if (reason === 'timeout')
      throw new Error('Nothing came back from the browser in 5 minutes. Try again.')
    throw error
  }
  focusApp()

  const { accessToken } = await call<{ accessToken: string }>(SERVICE, '/connect/token', {
    method: 'POST',
    body: { code, codeVerifier: verifier, redirectUri, clientId: CLIENT_ID }
  })
  registerSecret(accessToken)
  const info = await call<FormsAccountInfo>(SERVICE, '/me', { token: accessToken })

  const { formsAccounts } = await getAppSettings()
  const same = formsAccounts.find((a) => a.service === SERVICE && a.email === info.email)
  if (same) await disconnectFormsAccount(same.id)
  const account: FormsAccount = {
    id: same?.id ?? randomBytes(6).toString('hex'),
    service: SERVICE,
    email: info.email,
    name: info.name,
    plan: info.plan,
    connectedAt: new Date().toISOString()
  }
  await setFormsToken(account.id, accessToken)
  await saveAppSettings({
    formsAccounts: [
      ...(await getAppSettings()).formsAccounts.filter((a) => a.id !== account.id),
      account
    ]
  })
  return { ...account, hasToken: true }
}

/** Back to CraftPages after the browser, so the user sees the result. */
function focusApp(): void {
  const window = BrowserWindow.getAllWindows()[0]
  if (!window) return
  if (window.isMinimized()) window.restore()
  window.show()
  if (process.platform === 'darwin') app.focus({ steal: true })
  else window.focus()
}

// ---------- A project's forms ----------

/** Keys this computer has seen, so embeds on pages resolve to a form and a website offline. */
interface KeyCache {
  keys: Record<string, { formId: string; title: string; domain: string }>
  /** The account's embed.js, for preview pages. */
  loaderUrl?: string
  /** The account's forms site, to tell its embeds from others. */
  siteUrl?: string
}
const CACHE = `${APP_DIR}/craftforms.json`

async function readCache(root: string): Promise<KeyCache> {
  try {
    return JSON.parse(await readFile(join(root, CACHE), 'utf8')) as KeyCache
  } catch {
    return { keys: {} }
  }
}

async function writeCache(root: string, cache: KeyCache): Promise<void> {
  await mkdir(join(root, APP_DIR), { recursive: true })
  await writeFile(join(root, CACHE), JSON.stringify(cache, null, 2) + '\n')
}

/** The project's account; rebinds by email on a computer where the stored id is unknown. */
async function projectAccount(root: string): Promise<FormsAccount | null> {
  const site = await getSiteSettings(root)
  const { formsAccounts } = await getAppSettings()
  const byId = formsAccounts.find((a) => a.id === site.forms.account)
  if (byId) return byId
  const byHint = site.forms.accountHint
    ? formsAccounts.find((a) => a.email === site.forms.accountHint)
    : undefined
  if (byHint) await saveSiteSettings(root, { forms: { account: byHint.id } })
  return byHint ?? null
}

const siteDomainOf = (site: SiteSettings): string => {
  try {
    return site.baseUrl ? storedDomain(new URL(site.baseUrl).host) : ''
  } catch {
    return ''
  }
}

interface Page {
  path: string
  source: string
}

async function publishedPages(root: string): Promise<Page[]> {
  const site = await getSiteSettings(root)
  const files = (await listFiles(root)).filter(
    (file) => /\.html?$/.test(file.path) && isPublished(site, file.path)
  )
  return Promise.all(
    files.map(async (file) => ({
      path: file.path,
      source: await readFile(join(root, file.path), 'utf8')
    }))
  )
}

/** Pages the blog generates carry this; they are rebuilt from their posts. */
const GENERATED = /<meta\s+name="generator"\s+content="CraftPages"/i

const HOSTED = /\.forms\.craftforms\.(app|test)$/

const hostOf = (url: string | undefined): string => {
  try {
    return url ? new URL(url).hostname : ''
  } catch {
    return ''
  }
}

/** Where a key's form lives: the connected account's site, another hosted one, or self-hosted. */
function sourceOf(site: string, cache: KeyCache): FormsEmbedSource {
  const host = hostOf(site)
  if (!host) return 'unknown'
  if (host === hostOf(cache.siteUrl)) return 'account'
  return HOSTED.test(host) ? 'hosted' : 'self'
}

interface EmbedElement {
  element: Element
  key: string
}

/** The page's embeds in document order (an embed's index is its place in this list). */
function embedElements(source: string): { document: Document; embeds: EmbedElement[] } {
  const document = parseWithLocations(source)
  const embeds: EmbedElement[] = []
  walk(document, (element) => {
    const key = attr(element, 'data-craftforms-embed')
    if (key !== undefined) embeds.push({ element, key })
  })
  return { document, embeds }
}

const settingsOf = (element: Element): FormsEmbedSettings => ({
  lang: attr(element, 'data-lang') ?? '',
  resourceId: attr(element, 'data-resource-id') ?? '',
  resourceSig: attr(element, 'data-resource-sig') ?? '',
  spinner: attr(element, 'data-loader') !== 'off',
  loadingLabel: attr(element, 'data-loading-label') ?? ''
})

/** Every CraftForms embed on the site's pages, whoever put it there. */
async function embedsOnPages(root: string): Promise<FormsEmbed[]> {
  const cache = await readCache(root)
  const out: FormsEmbed[] = []
  for (const page of await publishedPages(root)) {
    if (!page.source.includes('data-craftforms-embed')) continue
    const hasLoader = new RegExp(LOADER_SRC.source, 'i').test(page.source)
    const inPost = GENERATED.test(page.source)
    embedElements(page.source).embeds.forEach(({ element, key }, index) => {
      const known = cache.keys[key]
      const site = siteOfKey(key)
      out.push({
        path: page.path,
        index,
        key,
        site,
        source: sourceOf(site, cache),
        formId: known?.formId ?? null,
        title: known?.title ?? null,
        domain: known?.domain ?? null,
        hasLoader,
        inPost,
        settings: settingsOf(element)
      })
    })
  }
  return out
}

export async function formsProject(root: string): Promise<FormsProject> {
  const site = await getSiteSettings(root)
  const account = await projectAccount(root)
  const siteDomain = siteDomainOf(site)
  return {
    accounts: await listFormsAccounts(),
    account: account?.id ?? '',
    siteDomain,
    domain: storedDomain(site.forms.domain) || siteDomain,
    embeds: await embedsOnPages(root)
  }
}

export async function setFormsProject(
  root: string,
  patch: { account?: string; domain?: string; siteAddress?: boolean }
): Promise<FormsProject> {
  const forms: Partial<SiteSettings['forms']> = {}
  if (patch.account !== undefined) {
    const account = (await getAppSettings()).formsAccounts.find((a) => a.id === patch.account)
    if (patch.account && !account)
      throw new Error('That CraftForms account is no longer connected.')
    forms.account = account?.id ?? ''
    forms.accountHint = account?.email ?? ''
  }
  let baseUrl: string | undefined
  if (patch.domain !== undefined) {
    const domain = patch.domain.trim() ? storedDomain(patch.domain) : ''
    if (patch.domain.trim() && !domain)
      throw new Error('Enter a website address, e.g. example.com.')
    const site = await getSiteSettings(root)
    // The site address's own website needs no separate choice.
    forms.domain = domain === siteDomainOf(site) ? '' : domain
    if (patch.siteAddress && domain) {
      baseUrl = `https://${domain}`
      forms.domain = ''
    }
  }
  await saveSiteSettings(root, { forms, ...(baseUrl ? { baseUrl } : {}) })
  return formsProject(root)
}

/** The live list for the project's account; refreshes the key cache. */
export async function formsList(root: string, domain?: string): Promise<FormsList> {
  const account = await projectAccount(root)
  if (!account) throw new Error('Choose a CraftForms account for this project first.')
  const token = await formsToken(account.id)
  if (!token) throw new Error(`Connect ${account.email} again: its sign-in is missing.`)
  const query = domain ? `?domain=${encodeURIComponent(domain)}` : ''
  const list = await call<FormsList>(account.service, `/forms${query}`, { token }).catch(
    async (error) => {
      if ((error as { code?: string }).code === 'invalid_token')
        await setFormsToken(account.id, null)
      throw error
    }
  )
  const titles = new Map(list.forms.map((form) => [form.id, form.title]))
  const cache = await readCache(root)
  cache.loaderUrl = list.loaderUrl
  cache.siteUrl = list.siteUrl
  trustLoader(list.loaderUrl)
  for (const website of list.websites) {
    for (const key of website.keys) {
      cache.keys[key.key] = {
        formId: key.formId,
        title: titles.get(key.formId) ?? '',
        domain: key.domain
      }
    }
  }
  await writeCache(root, cache)
  return list
}

async function withToken(root: string): Promise<{ account: FormsAccount; token: string }> {
  const account = await projectAccount(root)
  if (!account) throw new Error('Choose a CraftForms account for this project first.')
  return accountById(account.id)
}

/** The key for this form on this website, created if needed (it may use a website slot). */
export async function ensureFormEmbed(
  root: string,
  formId: string,
  domain: string
): Promise<FormsEnsured> {
  const { account, token } = await withToken(root)
  const wanted = storedDomain(domain)
  if (!wanted) throw new Error('Enter a website address, e.g. example.com.')
  const result = await call<{ key: string; domain: string; created: boolean }>(
    account.service,
    `/forms/${encodeURIComponent(formId)}/embeds/${encodeURIComponent(wanted)}`,
    { method: 'PUT', token }
  )
  const list = await formsList(root)
  const title = list.forms.find((form) => form.id === formId)?.title ?? ''
  const cache = await readCache(root)
  cache.keys[result.key] = { formId, title, domain: result.domain }
  await writeCache(root, cache)
  return { ...result, snippet: embedSnippet(result.key, list.loaderUrl) }
}

export async function releaseFormEmbed(
  root: string,
  formId: string,
  domain: string
): Promise<{ released: number; domain: string }> {
  const { account, token } = await withToken(root)
  const result = await call<{ released: number; domain: string }>(
    account.service,
    `/forms/${encodeURIComponent(formId)}/embeds/${encodeURIComponent(storedDomain(domain))}`,
    { method: 'DELETE', token }
  )
  const cache = await readCache(root)
  for (const [key, entry] of Object.entries(cache.keys)) {
    if (entry.formId === formId && entry.domain === result.domain) delete cache.keys[key]
  }
  await writeCache(root, cache)
  return result
}

function insertOffset(element: Element, position: IconPosition): number | null {
  const location = element.sourceCodeLocation
  if (!location) return null
  if (position === 'before') return location.startOffset
  if (position === 'after') return location.endOffset
  if (!location.endTag || !location.startTag) return null // void element: no inside
  return position === 'start' ? location.startTag.endOffset : location.endTag.startOffset
}

/**
 * Puts the form at a picked spot: the dashboard's own snippet. The loader goes
 * with it unless the page already loads it (from any CraftForms site's URL
 * that matches), so a page never loads it twice.
 */
export async function insertForm(
  root: string,
  path: string,
  locator: ElementLocator,
  position: IconPosition,
  formId: string,
  domain: string
): Promise<{ path: string; key: string; historyId: string }> {
  if (hasDraft(path)) throw new Error('This page has unsaved edits: save or discard them first.')
  const source = await readFile(join(root, path), 'utf8')
  const target = resolveLocator(parseWithLocations(source), locator)
  if (!target) throw new Error('The picked element is no longer on the page. Pick it again.')
  const at = insertOffset(target, position)
  if (at === null) throw new Error('Can’t put anything inside this element; pick before or after.')

  const { key } = await ensureFormEmbed(root, formId, domain)
  const { loaderUrl } = await formsList(root)
  const loaded = [...source.matchAll(LOADER_SRC)].some((match) => match[1] === loaderUrl)
  const snippet = loaded ? embedDiv(key) : embedSnippet(key, loaderUrl)
  // On lines of its own, so removing it later gives back the page as it was.
  const lineStart = source.lastIndexOf('\n', at - 1) + 1
  const patch = /^[ \t]*$/.test(source.slice(lineStart, at))
    ? { start: lineStart, end: lineStart, text: `${snippet}\n` }
    : { start: at, end: at, text: `\n${snippet}${source[at] === '\n' ? '' : '\n'}` }
  const content = applyPatches(source, [patch])
  const historyId = await writeFiles(root, [{ path, content }], 'Forms: form inserted')
  return { path, key, historyId }
}

// ---------- Editing embeds (any source) ----------

/** The page's source and its nth embed, refusing pages with unsaved edits. */
async function embedAt(
  root: string,
  path: string,
  index: number
): Promise<{ source: string; embed: EmbedElement; count: number }> {
  if (hasDraft(path)) throw new Error('This page has unsaved edits: save or discard them first.')
  const source = await readFile(join(root, path), 'utf8')
  if (GENERATED.test(source)) {
    throw new Error(
      'This form is in a blog post: change it in the post’s Form block, or the next publish undoes it.'
    )
  }
  const { embeds } = embedElements(source)
  const embed = embeds[index]
  if (!embed) throw new Error('That form is no longer on the page. Refresh and try again.')
  return { source, embed, count: embeds.length }
}

const KEY_SHAPE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/

/**
 * Sets an embed's key and data-* settings, leaving every other byte of its tag
 * as it was. Works on any embed, connected account or not: the snippet is the
 * same whoever made it.
 */
export async function updateFormEmbed(
  root: string,
  path: string,
  index: number,
  patch: Partial<FormsEmbedSettings> & { key?: string }
): Promise<{ historyId: string }> {
  const { source, embed } = await embedAt(root, path, index)
  const values: Record<string, string | null> = {}
  if (patch.key !== undefined) {
    const key = patch.key.trim()
    if (!KEY_SHAPE.test(key))
      throw new Error('An embed key looks like “aHR0cHM6Ly9…Lmw4”: two parts joined by a dot.')
    values['data-craftforms-embed'] = key
  }
  const optional = (
    name: string,
    value: string | undefined,
    shape: RegExp,
    message: string
  ): void => {
    if (value === undefined) return
    const trimmed = value.trim()
    if (trimmed && !shape.test(trimmed)) throw new Error(message)
    values[name] = trimmed || null
  }
  optional(
    'data-lang',
    patch.lang,
    /^[A-Za-z]{2,3}([_-][A-Za-z0-9]{2,8})*$/,
    'A language looks like “en”, “de-DE” or “pt_BR”.'
  )
  optional('data-resource-id', patch.resourceId, /^\d{1,12}$/, 'A catalog item is a number.')
  optional(
    'data-resource-sig',
    patch.resourceSig,
    /^[A-Za-z0-9._:=+/-]{4,200}$/,
    'That signature has unexpected characters.'
  )
  optional(
    'data-loading-label',
    patch.loadingLabel,
    /^[^<>"]{1,120}$/,
    'Keep the loading label short, without < > or quotes.'
  )
  if (patch.spinner !== undefined) values['data-loader'] = patch.spinner ? null : 'off'
  if (Object.keys(values).length === 0) throw new Error('Nothing to change.')
  const content = applyPatches(source, attrPatches(source, embed.element, values))
  return { historyId: await writeFiles(root, [{ path, content }], 'Forms: form settings changed') }
}

/** Removes an embed; with it the page's last, also the loader script(s). */
/**
 * What to cut when taking out markup: its whole line when it stands alone on it (indent and
 * line break too), else just the markup and a line break right after it.
 */
function removalSpan(source: string, start: number, end: number): { start: number; end: number } {
  const lineStart = source.lastIndexOf('\n', start - 1) + 1
  const lineEnd = source.indexOf('\n', end)
  const after = lineEnd === -1 ? source.slice(end) : source.slice(end, lineEnd)
  if (/^[ \t]*$/.test(source.slice(lineStart, start)) && /^[ \t]*$/.test(after))
    return { start: lineStart, end: lineEnd === -1 ? source.length : lineEnd + 1 }
  return { start, end: source[end] === '\n' ? end + 1 : end }
}

export async function removeFormEmbed(
  root: string,
  path: string,
  index: number
): Promise<{ historyId: string }> {
  const { source, embed, count } = await embedAt(root, path, index)
  const location = embed.element.sourceCodeLocation!
  const patches = [{ ...removalSpan(source, location.startOffset, location.endOffset), text: '' }]
  if (count === 1) {
    for (const match of source.matchAll(
      new RegExp(`${LOADER_SRC.source}[^>]*>\\s*</script>`, 'gi')
    )) {
      patches.push({
        ...removalSpan(source, match.index!, match.index! + match[0].length),
        text: ''
      })
    }
  }
  const content = applyPatches(source, patches)
  return { historyId: await writeFiles(root, [{ path, content }], 'Forms: form removed') }
}

/** Adds the loader script before </body> of a page whose form has none. */
export async function addFormLoader(
  root: string,
  path: string,
  loaderUrl: string
): Promise<{ historyId: string }> {
  if (!/^https?:\/\/[^\s"<>]+\/embed\.js(\?[^\s"<>]*)?$/.test(loaderUrl.trim())) {
    throw new Error(
      'The loader is the embed.js address of your CraftForms site, ending in /embed.js.'
    )
  }
  if (hasDraft(path)) throw new Error('This page has unsaved edits: save or discard them first.')
  const source = await readFile(join(root, path), 'utf8')
  const at = source.search(/<\/body>/i)
  if (at === -1) throw new Error('This page has no </body> to put the script before.')
  const content = applyPatches(source, [
    { start: at, end: at, text: `${loaderTag(loaderUrl.trim())}\n` }
  ])
  return { historyId: await writeFiles(root, [{ path, content }], 'Forms: loader added') }
}

/** Connected account: the embed shows another form, on the website it is for. */
export async function changeEmbedForm(
  root: string,
  path: string,
  index: number,
  formId: string
): Promise<{ historyId: string }> {
  const { embed } = await embedAt(root, path, index)
  const cache = await readCache(root)
  const domain = cache.keys[embed.key]?.domain || (await formsProject(root)).domain
  if (!domain) throw new Error('Choose the website for this project’s forms first.')
  const { key } = await ensureFormEmbed(root, formId, domain)
  return updateFormEmbed(root, path, index, { key })
}

/**
 * Connected account: the same form, made for another website. Says whether the
 * old website's key is still used anywhere on the site, so the slot can be freed.
 */
export async function changeEmbedWebsite(
  root: string,
  path: string,
  index: number,
  domain: string
): Promise<{ historyId: string; oldDomain: string | null; oldStillUsed: boolean }> {
  const { embed } = await embedAt(root, path, index)
  const cache = await readCache(root)
  const known = cache.keys[embed.key]
  if (!known)
    throw new Error(
      'This form isn’t from the connected account (or isn’t listed yet). Refresh Forms first.'
    )
  const { key } = await ensureFormEmbed(root, known.formId, domain)
  const result = await updateFormEmbed(root, path, index, { key })
  const oldStillUsed = (await embedsOnPages(root)).some((e) => e.key === embed.key)
  return { ...result, oldDomain: known.domain, oldStillUsed }
}

/** Frees a website slot: removes every key the account has for that website. */
export async function releaseFormsWebsite(
  root: string,
  domain: string
): Promise<{ released: number }> {
  const wanted = storedDomain(domain)
  const list = await formsList(root)
  const website = list.websites.find((w) => w.domain === wanted)
  if (!website) return { released: 0 }
  let released = 0
  for (const formId of new Set(website.keys.map((k) => k.formId))) {
    released += (await releaseFormEmbed(root, formId, wanted)).released
  }
  await formsList(root)
  return { released }
}

// ---------- Previews ----------

/**
 * Hosts of CraftForms sites whose forms are being previewed. Previews otherwise run
 * no remote scripts (preview/capture.ts); a form needs its own (custom elements,
 * validation), so its forms site is let through, and only that.
 */
const formsHosts = new Set<string>()

export const isFormsHost = (host: string): boolean => formsHosts.has(host)

function trustLoader(loaderUrl: string | undefined): void {
  try {
    if (loaderUrl) formsHosts.add(new URL(loaderUrl).hostname)
  } catch {
    // Not a URL: nothing to trust.
  }
}

/**
 * Forms are previewed through the real embed.js, in the real page, with the
 * site's CSS. The page is served with each embed's key swapped for a preview
 * key whose first part decodes to this app's preview server, so embed.js asks
 * us (PREVIEW_PATH) instead of the forms site; we answer with what the forms
 * site renders for the form (GET /api/v1/forms/{id}/render): no key, no website
 * slot. Submissions from a preview are refused by CraftForms (unknown origin).
 */
const PREVIEW_PATH = '/__craftforms'
const RENDER_TTL = 60_000

interface RenderPayload {
  html: string
  assets: { type: string; url?: string; code?: string }[]
  craftformsData?: Record<string, unknown>
}

const renders = new Map<string, { at: number; data: Promise<RenderPayload> }>()

export async function renderFormPreview(
  root: string,
  formId: string,
  lang = ''
): Promise<RenderPayload> {
  const id = `${root}|${formId}|${lang}`
  const cached = renders.get(id)
  if (cached && Date.now() - cached.at < RENDER_TTL) return cached.data
  const data = (async () => {
    const { account, token } = await withToken(root)
    const query = lang ? `?lang=${encodeURIComponent(lang)}` : ''
    return call<RenderPayload>(
      account.service,
      `/forms/${encodeURIComponent(formId)}/render${query}`,
      {
        token
      }
    )
  })()
  renders.set(id, { at: Date.now(), data })
  data.catch(() => renders.delete(id))
  return data
}

const fromBase64url = (text: string): string =>
  Buffer.from(text.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')

/** What a preview key stands for: a form of the connected account, and/or a real embed key. */
interface PreviewTarget {
  /** The real embed key (any site, hosted or self-hosted). */
  k?: string
  /** The connected account's form id: rendered through the account, no key needed. */
  f?: string
}

/** A key embed.js resolves to this preview server: base64url(origin + PREVIEW_PATH).base64url(target). */
export const previewKey = (origin: string, target: PreviewTarget): string =>
  `${base64url(Buffer.from(origin + PREVIEW_PATH))}.${base64url(Buffer.from(JSON.stringify(target)))}`

function readPreviewKey(key: string): PreviewTarget {
  try {
    const target = JSON.parse(fromBase64url(key.split('.')[1] ?? '')) as PreviewTarget
    return {
      ...(typeof target.k === 'string' && KEY_SHAPE.test(target.k) ? { k: target.k } : {}),
      ...(typeof target.f === 'string' && target.f ? { f: target.f } : {})
    }
  } catch {
    return {}
  }
}

/**
 * Runs first in preview pages: CraftForms requests other than loading a form
 * (submitting, payments) answer "submissions are off" without leaving the page.
 * craftforms.app refuses them anyway; a self-hosted site would not.
 */
const SUBMIT_GUARD =
  '<script data-craftpages-preview>(function(){' +
  'var MSG="Preview: submissions are off here.";' +
  'var hit=function(u,m){u=String(u||"");return String(m||"GET").toUpperCase()!=="GET"&&/craftforms(\\/|%2F)v1(\\/|%2F)/i.test(u)&&!/craftforms(\\/|%2F)v1(\\/|%2F)embed/i.test(u)};' +
  'var body=JSON.stringify({success:false,message:MSG,data:{errorMsg:MSG},error:{message:MSG}});' +
  'var f=window.fetch;window.fetch=function(i,o){var u=typeof i==="string"?i:i&&i.url,m=(o&&o.method)||(i&&i.method);' +
  'if(hit(u,m))return Promise.resolve(new Response(body,{status:403,headers:{"Content-Type":"application/json"}}));return f.apply(this,arguments)};' +
  'var X=XMLHttpRequest.prototype,op=X.open,sd=X.send;X.open=function(m,u){this.__cpBlock=hit(u,m);return op.apply(this,arguments)};' +
  'X.send=function(){if(!this.__cpBlock)return sd.apply(this,arguments);var x=this;' +
  '["status","readyState","responseText","response"].forEach(function(p,n){Object.defineProperty(x,p,{value:[403,4,body,body][n]})});' +
  'setTimeout(function(){x.dispatchEvent(new Event("readystatechange"));x.dispatchEvent(new Event("load"));x.dispatchEvent(new Event("loadend"))})}' +
  '})();</script>'

function withSubmitGuard(html: string): string {
  const head = html.search(/<head\b[^>]*>/i)
  if (head === -1) return SUBMIT_GUARD + html
  const end = html.indexOf('>', head) + 1
  return html.slice(0, end) + SUBMIT_GUARD + html.slice(end)
}

/**
 * Swaps every embed's key for a preview key (its real key, and the connected
 * account's form id when known), so the forms load in the app; adds the submit
 * guard. Trusts the scripts of each key's own CraftForms site.
 */
export async function withPreviewKeys(root: string, html: string, origin: string): Promise<string> {
  if (!html.includes('data-craftforms-embed')) return html
  const cache = await readCache(root)
  trustLoader(cache.loaderUrl)
  const swapped = html.replace(EMBED_KEY, (match, key: string) => {
    const site = siteOfKey(key)
    if (site) trustLoader(site)
    const known = cache.keys[key]
    return match.replace(key, previewKey(origin, { k: key, ...(known ? { f: known.formId } : {}) }))
  })
  return withSubmitGuard(swapped)
}

/** What any CraftForms site's embed endpoint answers for a key, fetched with no Origin. */
async function renderByKey(key: string, lang: string): Promise<RenderPayload> {
  const site = siteOfKey(key)
  if (!site) throw new Error('This embed key doesn’t name a CraftForms site.')
  const query = `rest_route=/craftforms/v1/embed/${encodeURIComponent(key)}${lang ? `&lang=${encodeURIComponent(lang)}` : ''}`
  let response: Response
  try {
    response = await fetch(`${site}/index.php?${query}`, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT)
    })
  } catch {
    throw new Error(`Can’t reach ${hostOf(site)}.`)
  }
  const body = (await response.json().catch(() => ({}))) as {
    data?: RenderPayload
    error?: { message?: string }
  }
  if (!response.ok || !body.data?.html) {
    throw new Error(body.error?.message ?? `${hostOf(site)} didn’t return the form.`)
  }
  const notice =
    '<p style="margin:0 0 .75em;padding:.4em .75em;border-radius:6px;background:rgba(127,127,127,.15);font:13px/1.4 system-ui,sans-serif;">Preview: submissions are off here.</p>'
  return { ...body.data, html: `<div data-craftforms-preview="1">${notice}${body.data.html}</div>` }
}

const escapeAttr = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

/** The stylesheets of a page: its <link rel=stylesheet> and <style> elements, as written. */
function stylesOf(source: string): string[] {
  const document = parseWithLocations(source)
  const out: string[] = []
  const walk = (node: { childNodes?: unknown[] }): void => {
    for (const child of (node.childNodes ?? []) as Element[]) {
      const tag = (child as Element).tagName
      const location = (child as Element).sourceCodeLocation
      const rel = (child.attrs ?? []).find((a) => a.name === 'rel')?.value ?? ''
      if (location && (tag === 'style' || (tag === 'link' && /\bstylesheet\b/i.test(rel)))) {
        out.push(source.slice(location.startOffset, location.endOffset))
      } else if (tag !== 'script' && tag !== 'template') walk(child as never)
    }
  }
  walk(document as never)
  return out
}

/** The preview server's routes: embed.js's request, and the Forms screen's preview page. */
export async function previewRoute(
  url: URL,
  origin: string
): Promise<{ status: number; type: string; body: string } | null> {
  if (!url.pathname.startsWith(`${PREVIEW_PATH}/`)) return null
  const root = getWorkspace()?.root
  if (!root) return { status: 404, type: 'text/plain', body: 'No site open' }

  if (url.pathname === `${PREVIEW_PATH}/index.php`) {
    const route = url.searchParams.get('rest_route') ?? ''
    const target = readPreviewKey(
      decodeURIComponent(route.replace(/^\/craftforms\/v1\/embed\//, ''))
    )
    const lang = url.searchParams.get('lang') ?? ''
    const json = (value: unknown): { status: number; type: string; body: string } => ({
      status: 200,
      type: 'application/json; charset=utf-8',
      body: JSON.stringify(value)
    })
    if (!target.f && !target.k) return json({ success: false, error: { message: 'Unknown form.' } })
    try {
      // The connected account's forms render through the account (no key needed);
      // any other embed straight from its own site, by its key.
      const account = target.f ? await projectAccount(root) : null
      const data =
        target.f && account && (await formsToken(account.id))
          ? await renderFormPreview(root, target.f, lang)
          : await renderByKey(target.k!, lang)
      return json({ success: true, data })
    } catch (error) {
      return json({ success: false, error: { message: (error as Error).message } })
    }
  }

  if (url.pathname === `${PREVIEW_PATH}/preview`) {
    const formId = url.searchParams.get('form') ?? ''
    const key = url.searchParams.get('key') ?? ''
    const page = url.searchParams.get('page') ?? ''
    const siteStyles = url.searchParams.get('styles') !== 'form'
    const cache = await readCache(root)
    trustLoader(cache.loaderUrl)
    let source = ''
    if (page && /\.html?$/.test(page)) {
      source =
        (await renderWithDrafts(page)) ?? (await readFile(join(root, page), 'utf8').catch(() => ''))
    }
    const lang = source.match(/<html\b[^>]*\blang\s*=\s*["']([^"']+)/i)?.[1] ?? ''
    const base = page.includes('/') ? `/${page.slice(0, page.lastIndexOf('/') + 1)}` : '/'
    const styles = siteStyles && source ? stylesOf(source).join('\n') : ''
    // The account's loader, else the key's own site's (the hosted path; self-hosted sites
    // use the same plugin layout).
    const keySite = key ? siteOfKey(key) : ''
    if (keySite) trustLoader(keySite)
    const loaderUrl =
      cache.loaderUrl ||
      (keySite ? `${keySite}/wp-content/plugins/craftforms/build/webcomponents/embed.js` : '')
    const loader = loaderUrl ? `<script src="${escapeAttr(loaderUrl)}" defer></script>` : ''
    const body =
      `<!doctype html><html${lang ? ` lang="${escapeAttr(lang)}"` : ''}><head><meta charset="utf-8">` +
      `<meta name="viewport" content="width=device-width,initial-scale=1"><base href="${escapeAttr(base)}">` +
      SUBMIT_GUARD +
      `${styles}</head><body><main style="max-width:760px;margin:32px auto;padding:0 20px">` +
      `<div data-craftforms-embed="${escapeAttr(previewKey(origin, { ...(key ? { k: key } : {}), ...(formId ? { f: formId } : {}) }))}"></div></main>${loader}</body></html>`
    return { status: 200, type: 'text/html; charset=utf-8', body }
  }
  return { status: 404, type: 'text/plain', body: 'Not found' }
}

/** Static markup of a form (its stylesheets and rendered HTML, no scripts), for placing it. */
export async function formPreviewMarkup(root: string, formId: string): Promise<string> {
  const data = await renderFormPreview(root, formId)
  const styles = data.assets
    .map((asset) =>
      asset.type === 'style' && asset.url
        ? `<link rel="stylesheet" href="${escapeAttr(asset.url)}">`
        : asset.type === 'inline-style' && asset.code
          ? `<style>${asset.code}</style>`
          : ''
    )
    .join('')
  // No scripts run where this is shown, so the form never becomes "defined"; its own
  // CSS hides it until then.
  const visible =
    '<style>craftforms-form:not(:defined),craftforms-form[data-craftforms-pending]{visibility:visible!important}</style>'
  // One element: the pointer inserts only the first element of what it's given.
  return `<div data-craftforms-static>${styles}${visible}${data.html}</div>`
}
