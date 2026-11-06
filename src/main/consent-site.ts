import { readFile } from 'fs/promises'
import { join } from 'path'
import { hasDraft } from './drafts'
import { writeFiles, type FileWrite } from './history'
import {
  applyPatches,
  attr,
  attrPatches,
  escapeAttr,
  find,
  parseWithLocations,
  walk,
  type Element,
  type Patch
} from './html/dom'
import { getSiteSettings } from './settings'
import { listFiles, resolveInWorkspace } from './workspace'
import { matchInline, matchSource, type Signature } from './consent/signatures'
import { languageOfPath } from '../shared/languages'
import consentJs from './consent/craftpages-consent.js?raw'
import { trackingProvider, type TrackingKind } from '../shared/tracking'
import type {
  ConsentBanner,
  ConsentCategory,
  ConsentItem,
  ConsentState,
  ConsentTexts,
  SiteChange,
  SiteSettings
} from '../shared/types'

/**
 * Cookie consent, kept in the site's own files:
 * - scripts that need consent are made inert where they stand: `type="text/plain"` and
 *   `data-craftpages-consent="analytics"` (the original type, if any, in
 *   `data-craftpages-type`); embeds keep their address in `data-craftpages-src`; tracking
 *   pixels in <noscript> become a <template> with the same mark;
 * - the consent script on every page shows the banner, remembers the visitor's choice
 *   and brings back what the visitor allowed, in page order;
 * - a script the site needs carries `data-craftpages-consent="necessary"` and runs as is,
 *   so a choice made here is recorded in the page itself;
 * - turning consent off puts every tag back the way it was.
 */

export const CONSENT_JS = 'assets/craftpages-consent.js'
const LOADER_SRC = /(^|\/)craftpages-consent\.js([?#]|$)/
const MARK = 'data-craftpages-consent'
const OPTIONAL: ConsentCategory[] = ['analytics', 'marketing', 'embeds']
const CATEGORIES = new Set<ConsentCategory>(['necessary', ...OPTIONAL])

const EMPTY_TEXTS: ConsentTexts = {
  title: '',
  message: '',
  accept: '',
  reject: '',
  choose: '',
  save: '',
  privacyText: '',
  privacyUrl: ''
}

/** The banner's text fields and their data-* names on the script tag. */
const TEXT_ATTRS: Record<keyof ConsentTexts, string> = {
  title: 'data-title',
  message: 'data-message',
  accept: 'data-accept',
  reject: 'data-reject',
  choose: 'data-choose',
  save: 'data-save',
  privacyText: 'data-privacy-text',
  privacyUrl: 'data-privacy'
}

// ---------- Reading ----------

interface Page {
  path: string
  source: string
  head: Element | null
  found: Found[]
  loader: Element | null
}

/** One script, embed or pixel on a page. */
interface Found {
  element: Element
  kind: 'script' | 'iframe' | 'noscript'
  key: string
  name: string
  suggested: Signature['category'] | null
  /** The mark in the file, if any. */
  category: ConsentCategory | null
  held: boolean
}

function hostOf(url: string): string | null {
  try {
    return new URL(url, 'https://site.invalid/').host || null
  } catch {
    return null
  }
}

const inner = (source: string, element: Element): string => {
  const location = element.sourceCodeLocation
  if (!location?.startTag || !location.endTag) return ''
  return source.slice(location.startTag.endOffset, location.endTag.startOffset)
}

function readMark(element: Element): ConsentCategory | null {
  const value = attr(element, MARK) as ConsentCategory | undefined
  return value && CATEGORIES.has(value) ? value : null
}

/** What a script, iframe or noscript is, by its address or code; null for the site's own. */
function identify(
  element: Element,
  source: string,
  siteHost: string | null
): Omit<Found, 'element' | 'category' | 'held'> | null {
  const tag = element.tagName
  if (tag === 'script') {
    if (LOADER_SRC.test(attr(element, 'src') ?? '')) return null
    // Tags added on the Tracking & consent screen say what they are.
    const tracking = attr(element, 'data-craftpages-tracking')
    if (tracking) {
      const provider = trackingProvider(tracking.split(':')[0] as TrackingKind)
      if (provider)
        return {
          kind: 'script',
          key: provider.kind === 'custom' ? tracking : provider.kind,
          name:
            provider.kind === 'custom'
              ? (attr(element, 'data-craftpages-name') ?? provider.name)
              : provider.name,
          suggested: provider.category === 'chosen' ? null : provider.category
        }
    }
    const type = (
      attr(element, 'data-craftpages-type') ??
      attr(element, 'type') ??
      ''
    ).toLowerCase()
    // Data blocks (JSON-LD, templates) never run.
    if (type && !/^(text\/plain|module|text\/javascript|application\/javascript)$/.test(type))
      return null
    const src = attr(element, 'src')
    if (src) return fromAddress(src, 'script', siteHost)
    const signature = matchInline(inner(source, element))
    return (
      signature && {
        kind: 'script',
        key: signature.id,
        name: signature.name,
        suggested: signature.category
      }
    )
  }
  if (tag === 'iframe') {
    const src = attr(element, 'src') ?? attr(element, 'data-craftpages-src')
    return src ? fromAddress(src, 'iframe', siteHost) : null
  }
  if (
    tag === 'noscript' ||
    (tag === 'template' && attr(element, 'data-craftpages-noscript') !== undefined)
  ) {
    const signature = matchInline(inner(source, element)) ?? matchSourceIn(inner(source, element))
    if (!signature || signature.category === 'necessary' || signature.category === 'cookieless')
      return null
    return {
      kind: 'noscript',
      key: signature.id,
      name: signature.name,
      suggested: signature.category
    }
  }
  return null
}

/** A pixel inside <noscript>: the address of its img or iframe. */
function matchSourceIn(html: string): Signature | null {
  for (const match of html.matchAll(/\bsrc=["']([^"']+)["']/gi)) {
    const signature = matchSource(match[1])
    if (signature) return signature
  }
  return null
}

function fromAddress(
  src: string,
  kind: 'script' | 'iframe',
  siteHost: string | null
): Omit<Found, 'element' | 'category' | 'held'> | null {
  const signature = matchSource(src)
  if (signature)
    return { kind, key: signature.id, name: signature.name, suggested: signature.category }
  // The site's own files run as part of the site.
  if (!/^([a-z][a-z0-9+.-]*:)?\/\//i.test(src.trim())) return null
  const host = hostOf(src.trim())
  if (!host || host === siteHost || host === `www.${siteHost}` || `www.${host}` === siteHost)
    return null
  return { kind, key: `host:${host}`, name: host, suggested: kind === 'iframe' ? 'embeds' : null }
}

function isHeld(element: Element, kind: Found['kind']): boolean {
  if (kind === 'script')
    return (
      (attr(element, 'type') ?? '').toLowerCase() === 'text/plain' && Boolean(readMark(element))
    )
  if (kind === 'iframe')
    return attr(element, 'data-craftpages-src') !== undefined && attr(element, 'src') === undefined
  return element.tagName === 'template'
}

async function readPages(
  root: string,
  site: SiteSettings,
  overrides?: Map<string, string>
): Promise<Page[]> {
  const siteHost = site.baseUrl ? hostOf(site.baseUrl) : null
  const files = (await listFiles(root)).filter((file) => /\.html?$/i.test(file.path))
  return Promise.all(
    files.map(async (file) => {
      const source = overrides?.get(file.path) ?? (await readFile(join(root, file.path), 'utf8'))
      const document = parseWithLocations(source)
      const found: Found[] = []
      let loader: Element | null = null
      walk(document, (element) => {
        if (element.tagName === 'script' && LOADER_SRC.test(attr(element, 'src') ?? '')) {
          loader = element
          return false
        }
        const what = identify(element, source, siteHost)
        if (what) {
          found.push({
            ...what,
            element,
            category: readMark(element),
            held: isHeld(element, what.kind)
          })
          return false
        }
        return true
      })
      return {
        path: file.path,
        source,
        head: find(document, (e) => e.tagName === 'head'),
        found,
        loader
      }
    })
  )
}

/** The category a place is held under, or would be once consent is on. */
function effective(found: Found): ConsentCategory | null {
  if (found.category) return found.category
  if (found.suggested === 'cookieless' || found.suggested === null) return null
  return found.suggested
}

/** The category to hold a place under; what the site needs (or isn't known) is left alone. */
function holdable(found: Found): ConsentCategory | undefined {
  const category = effective(found)
  return category && category !== 'necessary' ? category : undefined
}

function items(pages: Page[]): ConsentItem[] {
  const byKey = new Map<string, ConsentItem>()
  for (const page of pages)
    for (const found of page.found) {
      const item = byKey.get(found.key) ?? {
        key: found.key,
        name: found.name,
        category: null,
        suggested: found.suggested,
        held: 0,
        open: 0,
        pages: []
      }
      item.category = item.category ?? found.category
      if (found.held) item.held++
      else if (found.category !== 'necessary') item.open++
      if (!item.pages.includes(page.path)) item.pages.push(page.path)
      byKey.set(found.key, item)
    }
  const order = (item: ConsentItem): number =>
    item.suggested === null && !item.category
      ? 0
      : item.open
        ? 1
        : item.suggested === 'cookieless'
          ? 3
          : 2
  return [...byKey.values()].sort((a, b) => order(a) - order(b) || a.name.localeCompare(b.name))
}

// ---------- The banner's settings, read back from the script tags ----------

function readTexts(loader: Element): ConsentTexts {
  const texts = { ...EMPTY_TEXTS }
  for (const [field, name] of Object.entries(TEXT_ATTRS) as [keyof ConsentTexts, string][])
    texts[field] = attr(loader, name) ?? ''
  return texts
}

function readBanner(pages: Page[], site: SiteSettings): ConsentBanner {
  const banner: ConsentBanner = { position: 'bar', button: true, texts: {} }
  const withLoader = pages.filter((page) => page.loader)
  const first = withLoader.find((page) => page.path === 'index.html') ?? withLoader[0]
  if (first?.loader) {
    banner.position = attr(first.loader, 'data-position') === 'box' ? 'box' : 'bar'
    banner.button = attr(first.loader, 'data-button') !== 'off'
  }
  for (const page of withLoader) {
    const code = languageOfPath(page.path, site.languages)?.code ?? ''
    if (!(code in banner.texts)) banner.texts[code] = readTexts(page.loader!)
  }
  return banner
}

export async function consentState(root: string): Promise<ConsentState> {
  const site = await getSiteSettings(root)
  const pages = await readPages(root, site)
  const enabled = (await readFile(resolveInWorkspace(root, CONSENT_JS)).catch(() => null)) !== null
  return {
    enabled,
    pages: pages.length,
    withScript: pages.filter((page) => page.loader).length,
    items: items(pages),
    banner: readBanner(pages, site)
  }
}

// ---------- Changes ----------

function loaderTag(
  banner: ConsentBanner,
  texts: ConsentTexts,
  categories: ConsentCategory[]
): string {
  const attrs = [
    `data-categories="${categories.join(' ')}"`,
    `data-position="${banner.position}"`,
    `data-button="${banner.button ? 'on' : 'off'}"`,
    ...(Object.entries(TEXT_ATTRS) as [keyof ConsentTexts, string][])
      .filter(([field]) => texts[field].trim())
      .map(([field, name]) => `${name}="${escapeAttr(texts[field].trim())}"`)
  ]
  return `<script src="/${CONSENT_JS}" ${attrs.join(' ')} defer></script>`
}

/** Patches that hold a place until consent for `category`. */
function holdPatches(source: string, found: Found, category: ConsentCategory): Patch[] {
  const element = found.element
  if (found.kind === 'script') {
    const type = attr(element, 'type')
    const original = found.held ? attr(element, 'data-craftpages-type') : type
    return attrPatches(source, element, {
      type: 'text/plain',
      'data-craftpages-type': original && original.toLowerCase() !== 'text/plain' ? original : null,
      [MARK]: category
    })
  }
  if (found.kind === 'iframe') {
    const src = attr(element, 'src') ?? attr(element, 'data-craftpages-src') ?? ''
    return attrPatches(source, element, { src: null, 'data-craftpages-src': src, [MARK]: category })
  }
  const location = element.sourceCodeLocation!
  return [
    {
      start: location.startTag!.startOffset,
      end: location.startTag!.endOffset,
      text: `<template ${MARK}="${category}" data-craftpages-noscript>`
    },
    { start: location.endTag!.startOffset, end: location.endTag!.endOffset, text: '</template>' }
  ]
}

/** Patches that let a place run as written; `mark` records "necessary" in the tag. */
function releasePatches(source: string, found: Found, mark: 'necessary' | null): Patch[] {
  const element = found.element
  if (found.kind === 'script') {
    const original = attr(element, 'data-craftpages-type')
    // A tag from the Tracking screen keeps its category for when consent comes back on.
    const keep =
      mark ?? (attr(element, 'data-craftpages-tracking') !== undefined ? found.category : null)
    return attrPatches(source, element, {
      type: found.held ? (original ?? null) : (attr(element, 'type') ?? null),
      'data-craftpages-type': null,
      [MARK]: keep
    })
  }
  if (found.kind === 'iframe') {
    const src = attr(element, 'data-craftpages-src')
    return attrPatches(source, element, {
      ...(src !== undefined ? { src, 'data-craftpages-src': null } : {}),
      [MARK]: mark
    })
  }
  const location = element.sourceCodeLocation!
  if (element.tagName !== 'template') return attrPatches(source, element, { [MARK]: mark })
  return [
    {
      start: location.startTag!.startOffset,
      end: location.startTag!.endOffset,
      text: mark ? `<noscript ${MARK}="${mark}">` : '<noscript>'
    },
    { start: location.endTag!.startOffset, end: location.endTag!.endOffset, text: '</noscript>' }
  ]
}

/** The patch that adds the consent script (or brings it up to date); null when it's right. */
function loaderPatch(page: Page, tag: string): Patch | null {
  const location = (page.loader as Element | null)?.sourceCodeLocation
  if (location) {
    if (page.source.slice(location.startOffset, location.endOffset) === tag) return null
    return { start: location.startOffset, end: location.endOffset, text: tag }
  }
  // At the end of <head>, like the search script; deferred, so it runs once the page is read.
  const head = page.head?.sourceCodeLocation
  if (!head?.startTag || !head.endTag) return null
  return { start: head.endTag.startOffset, end: head.endTag.startOffset, text: `  ${tag}\n` }
}

function removeLoaderPatch(page: Page): Patch | null {
  const location = (page.loader as Element | null)?.sourceCodeLocation
  if (!location) return null
  let start = location.startOffset
  while (start > 0 && /[ \t]/.test(page.source[start - 1])) start--
  const end =
    page.source[location.endOffset] === '\n' && page.source[start - 1] === '\n'
      ? location.endOffset + 1
      : location.endOffset
  return { start, end, text: '' }
}

/** Categories in use anywhere on the site: a visitor's choice covers them all. */
function categoriesAfter(
  pages: Page[],
  decide: (found: Found) => ConsentCategory | null
): ConsentCategory[] {
  const used = new Set<ConsentCategory>()
  for (const page of pages)
    for (const found of page.found) {
      const category = decide(found)
      if (category && category !== 'necessary') used.add(category)
    }
  return OPTIONAL.filter((category) => used.has(category))
}

/**
 * Writes the pages: each place gets what `decide` says (a category to hold it under,
 * 'release' to let it run, or undefined to leave it), and the consent script is added,
 * updated or (with banner null) removed.
 */
type Decide = (found: Found) => ConsentCategory | 'release' | 'release-necessary' | undefined

async function rewrite(
  root: string,
  pages: Page[],
  site: SiteSettings,
  decide: Decide,
  banner: ConsentBanner | null,
  label: string
): Promise<SiteChange> {
  const { writes, skipped, pageCount } = await plan(root, pages, site, decide, banner)
  const historyId = writes.length ? await writeFiles(root, writes, label) : null
  return { pages: writes.slice(0, pageCount).map((write) => write.path), skipped, historyId }
}

/** The files `rewrite` would write, without writing them. */
async function plan(
  root: string,
  pages: Page[],
  site: SiteSettings,
  decide: Decide,
  banner: ConsentBanner | null
): Promise<{ writes: FileWrite[]; skipped: SiteChange['skipped']; pageCount: number }> {
  const categories = categoriesAfter(pages, (found) => {
    const next = decide(found)
    if (next === 'release' || next === 'release-necessary') return null
    if (next) return next
    return found.held ? found.category : null
  })
  const writes: FileWrite[] = []
  const skipped: SiteChange['skipped'] = []
  for (const page of pages) {
    const patches: Patch[] = []
    for (const found of page.found) {
      const next = decide(found)
      if (next === undefined) continue
      if (next === 'release' || next === 'release-necessary') {
        const mark = next === 'release-necessary' ? 'necessary' : null
        if (found.held || found.category !== mark)
          patches.push(...releasePatches(page.source, found, mark))
      } else if (!found.held || found.category !== next) {
        patches.push(...holdPatches(page.source, found, next))
      }
    }
    if (banner) {
      const code = languageOfPath(page.path, site.languages)?.code ?? ''
      const texts =
        banner.texts[code] ?? banner.texts[''] ?? Object.values(banner.texts)[0] ?? EMPTY_TEXTS
      const patch = loaderPatch(page, loaderTag(banner, { ...EMPTY_TEXTS, ...texts }, categories))
      if (patch) patches.push(patch)
    } else {
      const patch = removeLoaderPatch(page)
      if (patch) patches.push(patch)
    }
    if (!patches.length) continue
    if (hasDraft(page.path)) {
      skipped.push({ path: page.path, reason: 'Unsaved edits: save or discard them first.' })
      continue
    }
    writes.push({ path: page.path, content: applyPatches(page.source, patches) })
  }
  const pageCount = writes.length
  const current = await readFile(resolveInWorkspace(root, CONSENT_JS), 'utf8').catch(() => null)
  if (banner && current !== consentJs) writes.push({ path: CONSENT_JS, content: consentJs })
  if (!banner && current !== null) writes.push({ path: CONSENT_JS, content: null })
  return { writes, skipped, pageCount }
}

/** Holds every recognised script and embed that needs consent, and adds the banner. */
export async function enableConsent(root: string, banner: ConsentBanner): Promise<SiteChange> {
  const site = await getSiteSettings(root)
  const pages = await readPages(root, site)
  return rewrite(root, pages, site, (found) => holdable(found), banner, 'Cookie consent: turned on')
}

/** Every place of one script or embed: held under a category, or marked as needed. */
export async function setConsentCategory(
  root: string,
  key: string,
  category: ConsentCategory
): Promise<SiteChange> {
  if (!CATEGORIES.has(category)) throw new Error(`Unknown category: ${category}`)
  const site = await getSiteSettings(root)
  const pages = await readPages(root, site)
  const banner = readBanner(pages, site)
  return rewrite(
    root,
    pages,
    site,
    (found) =>
      found.key !== key ? undefined : category === 'necessary' ? 'release-necessary' : category,
    banner,
    'Cookie consent: category'
  )
}

/** The banner's look and words, on every page. */
export async function saveConsentBanner(root: string, banner: ConsentBanner): Promise<SiteChange> {
  const site = await getSiteSettings(root)
  return rewrite(
    root,
    await readPages(root, site),
    site,
    () => undefined,
    banner,
    'Cookie consent: banner'
  )
}

/** Everything back as it was: tags run again, the script and its file go. */
export async function disableConsent(root: string): Promise<SiteChange> {
  const site = await getSiteSettings(root)
  return rewrite(
    root,
    await readPages(root, site),
    site,
    () => 'release',
    null,
    'Cookie consent: turned off'
  )
}

/**
 * Before publishing, with consent on: recognised scripts added since (by hand, by the AI,
 * in a new page) are held too, and new pages get the consent script.
 */
export async function refreshConsent(root: string): Promise<void> {
  if (!(await consentEnabled(root))) return
  const site = await getSiteSettings(root)
  const pages = await readPages(root, site)
  const banner = readBanner(pages, site)
  const pending = pages.some(
    (page) =>
      !page.loader || page.found.some((found) => !found.held && !found.category && effective(found))
  )
  if (!pending) return
  await rewrite(
    root,
    pages,
    site,
    (found) => (!found.held && !found.category ? holdable(found) : undefined),
    banner,
    'Cookie consent: new scripts held'
  )
}

export async function consentEnabled(root: string): Promise<boolean> {
  return (await readFile(resolveInWorkspace(root, CONSENT_JS)).catch(() => null)) !== null
}

/**
 * Pages about to be written by another screen (`contents`, by path), brought in line with
 * consent when it's on: what needs consent is held, and the banner's categories follow.
 * Returns the writes to make together, or the contents as given when consent is off.
 */
export async function withConsent(
  root: string,
  contents: Map<string, string>
): Promise<FileWrite[]> {
  const given = [...contents].map(([path, content]) => ({ path, content }))
  if (!(await consentEnabled(root))) return given
  const site = await getSiteSettings(root)
  const pages = await readPages(root, site, contents)
  const { writes } = await plan(
    root,
    pages,
    site,
    (found) => (!found.held && !found.category ? holdable(found) : undefined),
    readBanner(pages, site)
  )
  const planned = new Set(writes.map((write) => write.path))
  return [...writes, ...given.filter((write) => !planned.has(write.path))]
}
