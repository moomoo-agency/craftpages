import { createHash } from 'crypto'
import { mkdir, readFile, stat, writeFile } from 'fs/promises'
import { join, posix } from 'path'
import { parse } from 'parse5'
import { hasDraft } from './drafts'
import { writeFiles, type FileWrite } from './history'
import {
  applyPatches,
  attr,
  attrPatches,
  children,
  find,
  parseWithLocations,
  textContent,
  walk,
  type Element,
  type Patch
} from './html/dom'
import { analyze, needsUpdate, switcherLinks, updatedPage, type Analysis } from './languages'
import { SWITCHER_ATTR, fillSwitchers, withFlags } from './language-switcher'
import { APP_DIR, getSiteSettings } from './settings'
import { fileFor, resolveLink, urlOfPage } from './site-paths'
import { getWorkspace } from './state'
import { languageOfPath, rootLanguage } from '../shared/languages'
import type {
  LanguagesCopy,
  PageLanguage,
  SiteSettings,
  TextChange,
  TranslationRow,
  TranslationStatus
} from '../shared/types'

/**
 * Translations of pages: copying pages into a language, and keeping track of which copies
 * still need translating and which went out of date because their source page changed.
 *
 * What a translation is linked to lives in the pages (hreflang, see languages.ts). Only the
 * workflow lives in `.sitecms/translations.json`: per translated page, a fingerprint of its
 * source page's text when it was last brought in line. Losing it loses only the "outdated"
 * marks: every translation then counts as up to date from that moment.
 */

interface TranslationRecord {
  /** The page it translates. */
  source: string
  /** The source page's text fingerprint when this one was last brought in line. */
  hash: string
  translated: boolean
  /**
   * The source page's text blocks at that moment (see `textBlocks`), to show what changed
   * once it's outdated. Missing on records from before 1.2: then only "outdated" is known.
   */
  texts?: Record<string, string>
}

interface Store {
  version: 1
  pages: Record<string, TranslationRecord>
}

const STORE = join(APP_DIR, 'translations.json')

async function readStore(root: string): Promise<Store> {
  try {
    const store = JSON.parse(await readFile(join(root, STORE), 'utf8')) as Store
    if (store.version === 1 && store.pages) return store
  } catch {
    // None yet.
  }
  return { version: 1, pages: {} }
}

async function writeStore(root: string, store: Store): Promise<void> {
  await mkdir(join(root, APP_DIR), { recursive: true })
  await writeFile(join(root, STORE), JSON.stringify(store, null, 1))
}

// ---------- Text fingerprints ----------

const fingerprints = new Map<string, { mtimeMs: number; size: number; hash: string }>()

/**
 * What a reader sees of a page: its text, title, description and the text in attributes
 * (alt, title, placeholder, aria-label). Markup-only changes (a class, a link's address,
 * hreflang lines) don't change it. Regular expressions, not a parser: it runs on every page.
 */
export function pageText(html: string): string {
  const clean = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|template)\b[\s\S]*?<\/\1\s*>/gi, ' ')
  const attributes = [
    ...clean.matchAll(/\s(?:alt|title|placeholder|aria-label)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)
  ].map((match) => match[1] ?? match[2])
  const description =
    clean
      .match(/<meta\b[^>]*\bname\s*=\s*["']description["'][^>]*>/i)?.[0]
      .match(/\bcontent\s*=\s*(?:"([^"]*)"|'([^']*)')/i)
      ?.slice(1)
      .find((value) => value !== undefined) ?? ''
  return [clean.replace(/<[^>]+>/g, ' '), ...attributes, description]
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function textHash(root: string, path: string): Promise<string> {
  const full = join(root, path)
  const info = await stat(full)
  const key = `${root}\0${path}`
  const cached = fingerprints.get(key)
  if (cached && cached.mtimeMs === info.mtimeMs && cached.size === info.size) return cached.hash
  const hash = createHash('sha1')
    .update(pageText(await readFile(full, 'utf8')))
    .digest('hex')
    .slice(0, 16)
  fingerprints.set(key, { mtimeMs: info.mtimeMs, size: info.size, hash })
  return hash
}

// ---------- Text blocks ----------

const SKIP_TAGS = new Set(['script', 'style', 'template', 'noscript', 'svg'])
const MAX_BLOCK = 500

const hasOwnText = (element: Element): boolean =>
  element.childNodes.some(
    (node) => node.nodeName === '#text' && /\S/.test((node as { value: string }).value)
  )

const clip = (text: string): string => {
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length > MAX_BLOCK ? clean.slice(0, MAX_BLOCK - 1) + '…' : clean
}

/**
 * What a reader reads on a page, block by block: each outermost element holding text of its
 * own (a paragraph, a heading, a menu link), keyed by its editor selector
 * (`body > main:nth-of-type(1) > p:nth-of-type(2)`), plus image alt text (`…@alt`) and the
 * title and description (`@title`, `@description`). The language switcher is left out: it
 * differs per language by design.
 */
export function textBlocks(html: string): Record<string, string> {
  const blocks: Record<string, string> = {}
  const document = parse(html)
  const htmlTag = find(document, (e) => e.tagName === 'html')
  if (!htmlTag) return blocks
  const head = children(htmlTag).find((e) => e.tagName === 'head')
  const title = head && find(head, (e) => e.tagName === 'title')
  if (title && clip(textContent(title))) blocks['@title'] = clip(textContent(title))
  const description =
    head &&
    find(
      head,
      (e) => e.tagName === 'meta' && (attr(e, 'name') ?? '').toLowerCase() === 'description'
    )
  if (description && clip(attr(description, 'content') ?? ''))
    blocks['@description'] = clip(attr(description, 'content') ?? '')

  const visit = (element: Element, selector: string, inText: boolean): void => {
    if (SKIP_TAGS.has(element.tagName) || attr(element, SWITCHER_ATTR) !== undefined) return
    const own = hasOwnText(element)
    if (own && !inText) {
      const text = clip(textContent(element))
      if (text) blocks[selector] = text
    }
    const alt = element.tagName === 'img' ? clip(attr(element, 'alt') ?? '') : ''
    if (alt && !inText) blocks[`${selector}@alt`] = alt
    const counts = new Map<string, number>()
    for (const child of children(element)) {
      const n = (counts.get(child.tagName) ?? 0) + 1
      counts.set(child.tagName, n)
      visit(child, `${selector} > ${child.tagName}:nth-of-type(${n})`, inText || own)
    }
  }
  const body = children(htmlTag).find((e) => e.tagName === 'body')
  if (body) visit(body, 'body', false)
  return blocks
}

async function sourceBlocks(root: string, source: string): Promise<Record<string, string>> {
  return textBlocks(await readFile(join(root, source), 'utf8'))
}

/** A record of a translation brought in line with its source page as it is now. */
async function inLine(
  root: string,
  source: string,
  translated: boolean
): Promise<TranslationRecord> {
  return {
    source,
    hash: await textHash(root, source),
    translated,
    texts: await sourceBlocks(root, source)
  }
}

// ---------- Status ----------

/** The page a translation is measured against: its group's root-language page. */
function sourceOf(analysis: Analysis, path: string): string | null {
  const root = rootLanguage(analysis.languages)
  if (!root || analysis.codeOf.get(path) === root.code) return null
  return analysis.groupOf.get(path)?.pages[root.code] ?? null
}

async function statusOf(
  root: string,
  analysis: Analysis,
  store: Store,
  path: string
): Promise<{ status: TranslationStatus; changed: boolean }> {
  const source = sourceOf(analysis, path)
  if (analysis.codeOf.get(path) === rootLanguage(analysis.languages)?.code)
    return { status: 'source', changed: false }
  if (!source) return { status: 'translated', changed: false }
  const hash = await textHash(root, source)
  const record = store.pages[path]
  if (!record || record.source !== source) {
    // Not tracked yet (a translation from before, or linked to another page now): it counts
    // as up to date from here on, so later changes to its source show.
    store.pages[path] = {
      source,
      hash,
      translated: record?.translated ?? true,
      texts: await sourceBlocks(root, source)
    }
    return { status: store.pages[path].translated ? 'translated' : 'needs', changed: true }
  }
  if (!record.translated) return { status: 'needs', changed: false }
  return { status: record.hash === hash ? 'translated' : 'outdated', changed: false }
}

export async function pageLanguage(root: string, path: string): Promise<PageLanguage | null> {
  const site = await getSiteSettings(root)
  if (site.languages.length < 2) return null
  const analysis = await analyze(root, site)
  if (!analysis.codeOf.has(path)) return null
  const store = await readStore(root)
  const { status, changed } = await statusOf(root, analysis, store, path)
  if (changed) await writeStore(root, store)
  return {
    code: analysis.codeOf.get(path)!,
    status,
    source: sourceOf(analysis, path),
    pages: analysis.groupOf.get(path)?.pages ?? { [analysis.codeOf.get(path)!]: path },
    languages: site.languages
  }
}

/** Every page of the root language with its versions, then pages that translate nothing. */
export async function translationsGrid(root: string): Promise<TranslationRow[]> {
  const site = await getSiteSettings(root)
  if (site.languages.length < 2) return []
  const analysis = await analyze(root, site)
  const store = await readStore(root)
  const titles = new Map(getWorkspace()?.pages.map((page) => [page.path, page.title]) ?? [])
  const rootCode = rootLanguage(site.languages)!.code
  const rows: TranslationRow[] = []
  const seen = new Set<object>()
  let changed = false
  const ordered = [...analysis.pages].sort((a, b) => {
    // The root language first, its home page first of all.
    const rank = (path: string): number =>
      (analysis.codeOf.get(path) === rootCode ? 0 : 2) + (/^index\.html?$/i.test(path) ? 0 : 1)
    return rank(a) - rank(b) || a.localeCompare(b)
  })
  for (const path of ordered) {
    const group = analysis.groupOf.get(path)!
    if (seen.has(group)) continue
    seen.add(group)
    const row: TranslationRow = { title: titles.get(path) || path, pages: {} }
    for (const [code, page] of Object.entries(group.pages)) {
      const result = await statusOf(root, analysis, store, page)
      changed ||= result.changed
      row.pages[code] = { path: page, status: result.status }
    }
    rows.push(row)
  }
  if (changed) await writeStore(root, store)
  return rows
}

/** Marks translations as translated, and up to date with their source pages as they are now. */
export async function markTranslated(root: string, paths: string[]): Promise<void> {
  const site = await getSiteSettings(root)
  const analysis = await analyze(root, site)
  const store = await readStore(root)
  for (const path of paths) {
    const source = sourceOf(analysis, path)
    if (source) store.pages[path] = await inLine(root, source, true)
  }
  await writeStore(root, store)
}

/**
 * What changed in an outdated translation's source page since the translation was brought in
 * line: each text block before and now (`before` null: new; `now` null: gone), in page order.
 * Null when that isn't known (no snapshot, from before 1.2) or the page isn't a translation.
 */
export async function sourceChanges(root: string, path: string): Promise<TextChange[] | null> {
  const site = await getSiteSettings(root)
  if (site.languages.length < 2) return null
  const source = sourceOf(await analyze(root, site), path)
  const record = (await readStore(root)).pages[path]
  if (!source || !record?.texts || record.source !== source) return null
  const before = record.texts
  const now = await sourceBlocks(root, source)
  const changes: TextChange[] = []
  for (const [key, text] of Object.entries(now)) {
    if (before[key] !== text) changes.push({ key, before: before[key] ?? null, now: text })
  }
  for (const [key, text] of Object.entries(before)) {
    if (!(key in now)) changes.push({ key, before: text, now: null })
  }
  return changes
}

// ---------- The original text ----------

/** The element at an editor selector (`body > main > p:nth-of-type(2)`, `#intro > h2`). */
export function elementAt(html: string, selector: string): Element | null {
  const document = parse(html)
  const parts = selector.split(' > ').map((part) => part.trim())
  let current: Element | null = null
  let index = 0
  if (parts[0]?.startsWith('#')) {
    const id = parts[0].slice(1).replace(/\\(.)/g, '$1')
    current = find(document, (e) => attr(e, 'id') === id)
    index = 1
  } else {
    current = find(document, (e) => e.tagName === 'html')
  }
  for (; current && index < parts.length; index++) {
    const match = parts[index].match(/^([a-z][a-z0-9-]*)(?::nth-of-type\((\d+)\))?$/i)
    if (!match) return null
    const same: Element[] = children(current).filter((e) => e.tagName === match[1].toLowerCase())
    current = same[Number(match[2] ?? 1) - 1] ?? null
  }
  return current
}

/** In a translation: the text of the same element in the page it translates. */
export async function originalText(
  root: string,
  path: string,
  selector: string
): Promise<string | null> {
  const site = await getSiteSettings(root)
  if (site.languages.length < 2) return null
  const source = sourceOf(await analyze(root, site), path)
  if (!source) return null
  const [mine, theirs] = await Promise.all([
    readFile(join(root, path), 'utf8'),
    readFile(join(root, source), 'utf8')
  ])
  const here = elementAt(mine, selector)
  const there = elementAt(theirs, selector)
  // The same place in both pages, or nothing (rather than the wrong text).
  if (!here || !there || here.tagName !== there.tagName) return null
  const text = textContent(there).replace(/\s+/g, ' ').trim()
  return text ? text.slice(0, 500) : null
}

// ---------- Copying pages into a language ----------

const URL_ATTRS = ['href', 'src', 'poster', 'action', 'data-src']
const SKIP_URL = /^(#|[a-z][a-z0-9+.-]*:|\/\/)/i

/**
 * A page's copy for another folder: links to pages that have a version in the target
 * language go there; relative addresses are adjusted to the new depth; the canonical
 * address and og:url become the copy's own.
 */
function copyPage(
  site: SiteSettings,
  source: string,
  from: string,
  to: string,
  counterpart: (file: string) => string | null,
  pageSet: Set<string>
): string {
  const document = parseWithLocations(source)
  const patches: Patch[] = []
  const fromDir = posix.dirname('/' + from)
  const toDir = posix.dirname('/' + to)
  const ownUrl = urlOfPage(to)

  const rewrite = (value: string): string => {
    const trimmed = value.trim()
    const absolute = Boolean(site.baseUrl) && trimmed.startsWith(site.baseUrl + '/')
    if (!trimmed || (!absolute && SKIP_URL.test(trimmed))) return value
    const [, pathPart = '', tail = ''] = trimmed.match(/^([^?#]*)(.*)$/) ?? []
    if (!pathPart && !absolute) return value
    const link = resolveLink(trimmed, from, site)
    if (!link) return value
    const page = fileFor(link.path, pageSet)
    const other = page && counterpart(page)
    let target: string
    if (other) {
      // Same style as the link had: "contatti.html" stays a file, "/chi-siamo/" an address.
      target = /\.html?$/i.test(pathPart) ? '/' + other : urlOfPage(other)
    } else {
      const resolved = absolute
        ? trimmed.slice(site.baseUrl.length).replace(/[?#].*$/, '')
        : posix.normalize(pathPart.startsWith('/') ? pathPart : posix.join(fromDir, pathPart))
      target = resolved.startsWith('/') ? resolved : '/' + resolved
      if (pathPart.endsWith('/') && !target.endsWith('/')) target += '/'
    }
    if (absolute) return site.baseUrl + target + tail
    if (pathPart.startsWith('/')) return target + tail
    // Relative stays relative, from the copy's folder.
    let relative = posix.relative(toDir, target) || '.'
    if (target.endsWith('/') && !relative.endsWith('/')) relative += '/'
    return relative + tail
  }

  walk(document, (element) => {
    if (!element.sourceCodeLocation) return true
    const changes: Record<string, string> = {}
    const rel = (attr(element, 'rel') ?? '').toLowerCase()
    const property = attr(element, 'property')
    if (element.tagName === 'link' && rel.split(/\s+/).includes('canonical')) {
      changes.href = (/^https?:/i.test(attr(element, 'href') ?? '') ? site.baseUrl : '') + ownUrl
    } else if (element.tagName === 'meta' && property === 'og:url') {
      changes.content = (site.baseUrl || '') + ownUrl
    } else if (!(element.tagName === 'link' && attr(element, 'hreflang'))) {
      for (const name of URL_ATTRS) {
        const value = attr(element, name)
        if (value === undefined) continue
        const next = rewrite(value)
        if (next !== value) changes[name] = next
      }
      const srcset = attr(element, 'srcset')
      if (srcset) {
        const next = srcset
          .split(',')
          .map((candidate) =>
            candidate.replace(/^(\s*)(\S+)/, (_, space, url) => space + rewrite(url))
          )
          .join(',')
        if (next !== srcset) changes.srcset = next
      }
    }
    for (const [name, value] of Object.entries(changes))
      if (attr(element, name) === value) delete changes[name]
    if (Object.keys(changes).length) patches.push(...attrPatches(source, element, changes))
    return true
  })
  return applyPatches(source, patches)
}

/** Copies pages into a language: one revertable save with the copies and every hreflang change. */
export async function copyToLanguage(
  root: string,
  code: string,
  paths: string[]
): Promise<LanguagesCopy> {
  const site = await getSiteSettings(root)
  const target = site.languages.find((language) => language.code === code)
  if (!target || site.languages.length < 2)
    throw new Error(`“${code}” isn’t one of the site’s languages.`)
  const analysis = await analyze(root, site)
  const pageSet = new Set(analysis.pages)

  // Where each copy goes: the same place inside the target language's folder.
  const planned = new Map<string, string>()
  const skipped: string[] = []
  for (const path of [...new Set(paths)]) {
    if (!pageSet.has(path)) continue
    const own = languageOfPath(path, site.languages)!
    const to = target.path + path.slice(own.path.length)
    if (own === target || analysis.groupOf.get(path)?.pages[code] || pageSet.has(to)) {
      skipped.push(path)
      continue
    }
    planned.set(path, to)
  }
  if (!planned.size) return { created: [], skipped, historyId: null }

  const counterpart = (file: string): string | null =>
    planned.get(file) ?? analysis.groupOf.get(file)?.pages[code] ?? null
  const overlay = new Map<string, string>()
  for (const [from, to] of planned) {
    const source = await readFile(join(root, from), 'utf8')
    overlay.set(to, copyPage(site, source, from, to, counterpart, pageSet))
  }
  // A copy sits at its source's path, so it's paired with it; hreflang then follows for the
  // copies and every page of their groups.
  const after = await analyze(root, site, undefined, overlay)
  const writes: FileWrite[] = []
  for (const path of after.pages) {
    const update = needsUpdate(after, path)
    const isCopy = overlay.has(path)
    // A new version (or a language's new home page) changes other pages' switchers too.
    const switcher =
      !isCopy &&
      (await readFile(join(root, path), 'utf8').then(
        (text) =>
          text.includes(SWITCHER_ATTR) &&
          fillSwitchers(text, site, after.codeOf.get(path)!, switcherLinks(after, path)) !== text,
        () => false
      ))
    if (!isCopy && !update.lang && !update.links && !switcher) continue
    if (!isCopy && hasDraft(path)) continue
    const source = isCopy ? overlay.get(path)! : await readFile(join(root, path), 'utf8')
    const next = updatedPage(after, path, source)
    if (isCopy || next !== source) writes.push({ path, content: next })
  }
  const historyId = await writeFiles(
    root,
    await withFlags(root, site, writes),
    `Languages: ${planned.size} page${planned.size === 1 ? '' : 's'} copied to ${target.name}`
  )
  const store = await readStore(root)
  for (const to of planned.values()) {
    const source = sourceOf(after, to)
    if (source) store.pages[to] = await inLine(root, source, false)
  }
  await writeStore(root, store)
  return { created: [...planned.values()], skipped, historyId }
}
