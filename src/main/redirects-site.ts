import { readFile } from 'fs/promises'
import { writeFiles, type FileWrite } from './history'
import { getSiteSettings } from './settings'
import { fileFor, resolveLink } from './site-paths'
import { listFiles, resolveInWorkspace } from './workspace'
import type { RedirectsState, SiteRedirect, SiteSettings } from '../shared/types'

/**
 * Redirects the user keeps by hand (old address → new address), written where the host
 * reads them: a managed block of `_redirects` (Cloudflare) and, for a server, of
 * `.htaccess` (Apache). The files are the record: the list is read back from the block.
 * The same `.htaccess` block carries `ErrorDocument 404` once the site has a 404 page,
 * since Apache, unlike Cloudflare, doesn't serve 404.html by itself.
 *
 * The blog's own redirects (moved and deleted posts) live in a block of their own,
 * written by the blog generator; this module never touches it.
 */

const START = '# craftpages:redirects start (managed by CraftPages, edits here are replaced)'
const END = '# craftpages:redirects end'
const REDIRECTS = '_redirects'
const HTACCESS = '.htaccess'
const BLOG_START = '# craftpages:blog start'
const BLOG_END = '# craftpages:blog end'
export const NOT_FOUND_PAGE = '404.html'

async function readSite(root: string, path: string): Promise<string | null> {
  return readFile(resolveInWorkspace(root, path), 'utf8').catch(() => null)
}

/** The text between a block's markers, or null when there's no such block. */
function blockBody(text: string | null, start: string, end: string): string | null {
  if (!text) return null
  const from = text.indexOf(start)
  const to = text.indexOf(end, from)
  if (from < 0 || to < from) return null
  return text.slice(text.indexOf('\n', from) + 1, to)
}

/** Replaces (or, when absent, puts first) a managed block; an empty block is removed. */
function withBlock(current: string | null, start: string, end: string, lines: string[]): string {
  const text = current ?? ''
  const block = lines.length ? `${start}\n${lines.join('\n')}\n${end}\n` : ''
  const from = text.indexOf(start)
  const to = text.indexOf(end, from)
  if (from >= 0 && to > from) {
    const after = text.slice(to + end.length).replace(block ? /^\n/ : /^\n+/, '')
    return text.slice(0, from) + block + after
  }
  if (!block) return text
  // First: Cloudflare and Apache both act on the first rule that matches.
  return block + (text ? '\n' + text : '')
}

function parseRules(body: string | null): SiteRedirect[] {
  const rules: SiteRedirect[] = []
  for (const line of (body ?? '').split('\n')) {
    const [from, to, code] = line.trim().split(/\s+/)
    if (!from?.startsWith('/') || !to) continue
    rules.push({ from, to, status: code === '302' ? 302 : 301 })
  }
  return rules
}

/** Rules of `_redirects` outside any CraftPages block (the site's own). */
function otherRules(text: string | null): number {
  if (!text) return 0
  let inside = false
  let count = 0
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (line.startsWith('# craftpages:') && line.includes(' start')) inside = true
    else if (line.startsWith('# craftpages:') && line.endsWith(' end')) inside = false
    else if (!inside && line && !line.startsWith('#')) count++
  }
  return count
}

const escapeRegex = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** A rule as Apache writes it: RedirectMatch, anchored, so /a doesn't also catch /a-b. */
function apacheRule(rule: SiteRedirect): string {
  let pattern: string
  let to = rule.to
  if (rule.from.endsWith('/*')) {
    pattern = `${escapeRegex(rule.from.slice(0, -2))}/(.*)`
    to = to.replace(':splat', '$1')
  } else if (rule.from.endsWith('/') && rule.from !== '/') {
    // A folder address also matches its index.html.
    pattern = `${escapeRegex(rule.from.slice(0, -1))}(/|/index\\.html)?`
  } else {
    pattern = escapeRegex(rule.from)
  }
  return `  RedirectMatch ${rule.status} ^${pattern}$ ${to}`
}

/** What the `.htaccess` block holds: the redirects and, with a 404 page, the error page. */
function apacheLines(rules: SiteRedirect[], notFound: boolean): string[] {
  const lines: string[] = []
  if (rules.length) lines.push('<IfModule mod_alias.c>', ...rules.map(apacheRule), '</IfModule>')
  if (notFound) lines.push(`ErrorDocument 404 /${NOT_FOUND_PAGE}`)
  return lines
}

/** Whether `.htaccess` is kept in step: publishing to a server, or the block is there already. */
async function writesHtaccess(root: string, site: SiteSettings): Promise<boolean> {
  return (
    site.deploy.target === 'server' || Boolean((await readSite(root, HTACCESS))?.includes(START))
  )
}

async function htaccessWrite(
  root: string,
  site: SiteSettings,
  rules: SiteRedirect[]
): Promise<FileWrite | null> {
  if (!(await writesHtaccess(root, site))) return null
  const current = await readSite(root, HTACCESS)
  const notFound = (await readSite(root, NOT_FOUND_PAGE)) !== null
  const next = withBlock(current, START, END, apacheLines(rules, notFound))
  if (next === (current ?? '')) return null
  return { path: HTACCESS, content: next || null }
}

export async function readRedirects(root: string): Promise<SiteRedirect[]> {
  return parseRules(blockBody(await readSite(root, REDIRECTS), START, END))
}

export async function redirectsState(root: string): Promise<RedirectsState> {
  const site = await getSiteSettings(root)
  const text = await readSite(root, REDIRECTS)
  const rules = parseRules(blockBody(text, START, END))
  const blog = parseRules(blockBody(text, BLOG_START, BLOG_END)).length
  const files = new Set((await listFiles(root)).map((file) => file.path))
  const froms = new Set(rules.map((rule) => rule.from))
  const warnings: RedirectsState['warnings'] = []
  rules.forEach((rule, index) => {
    if (!rule.from.includes('*')) {
      const page = fileFor(rule.from.replace(/^\/+/, ''), files)
      if (page) warnings.push({ index, code: 'page-exists', detail: page })
    }
    const target = resolveLink(rule.to, 'index.html', site)
    if (target && !rule.to.includes(':splat')) {
      if (!fileFor(target.path, files) && !files.has(target.path))
        warnings.push({ index, code: 'target-missing' })
    }
    const toPath = rule.to.startsWith(site.baseUrl || '\0')
      ? rule.to.slice(site.baseUrl.length) || '/'
      : rule.to
    if (froms.has(toPath)) warnings.push({ index, code: 'chain', detail: toPath })
  })
  return {
    rules,
    blog,
    other: otherRules(text),
    target: site.deploy.target,
    htaccess: await writesHtaccess(root, site),
    warnings
  }
}

const FROM = /^\/[^\s#?]*$/
const TO = /^(\/[^\s]*|https?:\/\/[^\s]+)$/

/** Checks a list the way the hosts would read it; throws with the first problem found. */
export function validateRedirects(rules: SiteRedirect[]): void {
  const seen = new Set<string>()
  for (const rule of rules) {
    if (!FROM.test(rule.from))
      throw new Error(`“${rule.from}”: an old address starts with / and has no spaces.`)
    if (rule.from.includes('*') && !rule.from.endsWith('/*'))
      throw new Error(`“${rule.from}”: * works only at the end, after a slash (/old/*).`)
    if (!TO.test(rule.to))
      throw new Error(`“${rule.to}”: a new address starts with / or https://, with no spaces.`)
    if (rule.from === rule.to) throw new Error(`“${rule.from}” redirects to itself.`)
    if (seen.has(rule.from)) throw new Error(`“${rule.from}” is listed twice.`)
    if (rule.status !== 301 && rule.status !== 302) throw new Error('Status must be 301 or 302.')
    seen.add(rule.from)
  }
}

export async function saveRedirects(root: string, rules: SiteRedirect[]): Promise<string | null> {
  const clean = rules.map((rule) => ({
    from: rule.from.trim(),
    to: rule.to.trim(),
    status: rule.status
  }))
  validateRedirects(clean)
  const site = await getSiteSettings(root)
  const writes: FileWrite[] = []
  const current = await readSite(root, REDIRECTS)
  const lines = clean.map((rule) => `${rule.from} ${rule.to} ${rule.status}`)
  const next = withBlock(current, START, END, lines)
  if (next !== (current ?? '')) writes.push({ path: REDIRECTS, content: next || null })
  const apache = await htaccessWrite(root, site, clean)
  if (apache) writes.push(apache)
  return writes.length ? writeFiles(root, writes, 'Redirects') : null
}

/**
 * Before a server publish, and after the 404 page comes or goes: `.htaccess` gets the
 * redirects already in `_redirects` and the error page line.
 */
export async function syncServerRules(root: string): Promise<string | null> {
  const write = await htaccessWrite(root, await getSiteSettings(root), await readRedirects(root))
  return write ? writeFiles(root, [write], 'Redirects and 404 page for the server') : null
}
