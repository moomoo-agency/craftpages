import { readFile, writeFile } from 'fs/promises'
import { join, posix } from 'path'
import { parseFragment, serializeOuter } from 'parse5'
import { hasDraft } from './drafts'
import { writeFiles, type FileWrite } from './history'
import {
  applyPatches,
  attr,
  children,
  escapeAttr,
  find,
  isElement,
  parseWithLocations,
  textContent,
  walk,
  type Document,
  type Element,
  type Patch
} from './html/dom'
import { pageComponents } from './html/components'
import { follow, pathFrom, resolveLocator } from './html/locator'
import { POST_META } from './posts'
import { urlOfPage } from './seo-site'
import { getSiteSettings } from './settings'
import { listFiles } from './workspace'
import { SEARCH_ICONS } from './search/icons'
import loaderJs from './search/craftpages-search.js?raw'
import boxJs from './search/craftpages-search-box.js?raw'
import boxCss from './search/craftpages-search.css?raw'
import type {
  ElementLocator,
  IconPosition,
  SearchBoxOptions,
  SearchChange,
  SearchIconOptions,
  SearchPageState,
  SearchState
} from '../shared/types'

/**
 * Site search, kept in the site's own files:
 * - the loader <script> on every page carries the box options as data-*;
 * - any element with data-craftpages-search opens the box; the icon buttons
 *   CraftPages inserts carry their look in their own markup;
 * - search-index.json is rebuilt from the pages (on save, publish, deploy);
 * - a page opts out with <meta name="craftpages:search" content="exclude">,
 *   a block with the data-craftpages-search-ignore attribute.
 */

export const LOADER = 'assets/craftpages-search.js'
export const ASSETS: Record<string, string> = {
  [LOADER]: loaderJs,
  'assets/craftpages-search-box.js': boxJs,
  'assets/craftpages-search.css': boxCss
}
export const INDEX = 'search-index.json'
const TRIGGER_ATTR = 'data-craftpages-search'
const ICON_CLASS = 'craftpages-search-icon'
const EXCLUDE_META = 'craftpages:search'
const LOADER_SRC = /(^|\/)craftpages-search\.js([?#]|$)/
const MAX_TEXT = 60_000

export const DEFAULT_BOX: SearchBoxOptions = {
  accent: '',
  theme: 'auto',
  placeholder: '',
  empty: '',
  suggest: [],
  shortcut: true
}

export const DEFAULT_ICON: SearchIconOptions = {
  icon: 'search',
  svg: '',
  size: 20,
  stroke: 2,
  color: 'currentColor',
  background: 'transparent',
  radius: 8,
  padding: 6,
  label: 'Search'
}

// ---------- Reading pages ----------

interface Page {
  path: string
  source: string
  document: Document
}

async function htmlPages(root: string): Promise<Page[]> {
  const files = (await listFiles(root)).filter((file) => /\.html?$/.test(file.path))
  return Promise.all(
    files.map(async (file) => {
      const source = await readFile(join(root, file.path), 'utf8')
      return { path: file.path, source, document: parseWithLocations(source) }
    })
  )
}

const headOf = (document: Document): Element | null => find(document, (e) => e.tagName === 'head')

function meta(document: Document, key: 'name' | 'property', value: string): Element | null {
  const head = headOf(document)
  return (
    head && find(head, (e) => e.tagName === 'meta' && (attr(e, key) ?? '').toLowerCase() === value)
  )
}

const metaContent = (document: Document, key: 'name' | 'property', value: string): string =>
  (meta(document, key, value) && attr(meta(document, key, value)!, 'content')) ?? ''

function loaderScript(document: Document): Element | null {
  return find(document, (e) => e.tagName === 'script' && LOADER_SRC.test(attr(e, 'src') ?? ''))
}

function exclusion(page: Page): SearchPageState['excluded'] {
  if (/^404\.html?$/.test(page.path)) return '404'
  if (/noindex/i.test(metaContent(page.document, 'name', 'robots'))) return 'noindex'
  if (/exclude/i.test(metaContent(page.document, 'name', EXCLUDE_META))) return 'meta'
  return ''
}

// ---------- Index ----------

const SKIP = new Set([
  'script', 'style', 'noscript', 'template', 'svg', 'iframe', 'canvas', 'video', 'audio',
  'object', 'select', 'button', 'form', 'dialog', 'craftpages-search'
]) // prettier-ignore
const LANDMARKS = new Set(['header', 'nav', 'footer', 'aside'])
const BLOCK = new Set([
  'p', 'div', 'li', 'ul', 'ol', 'section', 'article', 'main', 'header', 'footer', 'aside', 'h1',
  'h2', 'h3', 'h4', 'h5', 'h6', 'br', 'td', 'th', 'tr', 'table', 'blockquote', 'figure',
  'figcaption', 'dd', 'dt', 'dl', 'pre', 'hr', 'summary', 'details', 'label'
]) // prettier-ignore
const HEADING = /^h[1-4]$/

type Section = [id: string, heading: string, text: string]

interface IndexPage {
  u: string
  t: string
  d: string
  c: string
  s: Section[]
}

const clean = (text: string): string => text.replace(/\s+/g, ' ').trim()

/** Text with a space wherever a line break or block would separate words. */
function spacedText(element: Element): string {
  let out = ''
  for (const child of element.childNodes) {
    if (isElement(child)) {
      if (SKIP.has(child.tagName)) continue
      const gap = child.tagName === 'br' || BLOCK.has(child.tagName) ? ' ' : ''
      out += gap + spacedText(child) + gap
    } else if (child.nodeName === '#text') {
      out += (child as { value: string }).value
    }
  }
  return out
}

function titleOf(page: Page, siteName: string): string {
  const { document, source } = page
  const og = metaContent(document, 'property', 'og:title')
  if (source.includes(POST_META) && og) return clean(og)
  const tag = find(document, (e) => e.tagName === 'title')
  let title = tag ? clean(textContent(tag)) : ''
  if (siteName && title !== siteName) {
    const escaped = siteName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    title = title.replace(new RegExp(`\\s*[·|–—-]\\s*${escaped}$`), '') || title
  }
  if (title) return title
  const h1 = find(document, (e) => e.tagName === 'h1')
  return (h1 && clean(textContent(h1))) || og || page.path
}

/** The page's text split at its headings, each section linkable by an id when there is one. */
function sectionsOf(document: Document): Section[] {
  const body = find(document, (e) => e.tagName === 'body')
  if (!body) return []
  const main =
    find(body, (e) => e.tagName === 'main') ?? find(body, (e) => attr(e, 'role') === 'main')
  const sections: { id: string; heading: string; text: string[] }[] = [
    { id: '', heading: '', text: [] }
  ]
  let size = 0

  const visit = (node: Element, anchor: string): void => {
    for (const child of node.childNodes) {
      if (size > MAX_TEXT) return
      if (!isElement(child)) {
        if (child.nodeName === '#text') {
          const value = (child as { value: string }).value
          sections[sections.length - 1].text.push(value)
          size += value.length
        }
        continue
      }
      const tag = child.tagName
      if (SKIP.has(tag) || tag === 'nav') continue
      if (!main && LANDMARKS.has(tag)) continue
      if (
        attr(child, 'hidden') !== undefined ||
        attr(child, 'aria-hidden') === 'true' ||
        attr(child, 'data-craftpages-search-ignore') !== undefined ||
        attr(child, TRIGGER_ATTR) !== undefined
      ) {
        continue
      }
      const id = attr(child, 'id') ?? ''
      if (HEADING.test(tag)) {
        sections.push({ id: id || anchor, heading: clean(spacedText(child)), text: [] })
        continue
      }
      const block = BLOCK.has(tag)
      if (block) sections[sections.length - 1].text.push(' ')
      visit(child, (tag === 'section' || tag === 'article') && id ? id : anchor)
      if (block) sections[sections.length - 1].text.push(' ')
    }
  }
  visit(main ?? body, '')

  return sections
    .map((section): Section => [section.id, section.heading, clean(section.text.join(''))])
    .filter(([, heading, text]) => heading || text)
}

export async function buildIndex(root: string): Promise<{ json: string; pages: number }> {
  const site = await getSiteSettings(root)
  const pages = (await htmlPages(root)).filter((page) => !exclusion(page))
  const entries: IndexPage[] = pages.map((page) => ({
    u: urlOfPage(page.path),
    t: titleOf(page, site.siteName),
    d: clean(metaContent(page.document, 'name', 'description')),
    c: '',
    s: sectionsOf(page.document)
  }))
  // Where a page sits: the titles of its parent pages, e.g. "Blog".
  const byUrl = new Map(entries.map((entry) => [entry.u, entry.t]))
  for (const entry of entries) {
    const parts = entry.u.split('/').filter(Boolean)
    const crumbs: string[] = []
    for (let i = 1; i < parts.length; i++) {
      const title = byUrl.get(`/${parts.slice(0, i).join('/')}/`)
      if (title) crumbs.push(title)
    }
    entry.c = crumbs.join(' › ')
  }
  entries.sort((a, b) => a.u.localeCompare(b.u))
  return { json: JSON.stringify({ v: 1, pages: entries }), pages: entries.length }
}

async function readText(root: string, path: string): Promise<string | null> {
  return readFile(join(root, path), 'utf8').catch(() => null)
}

/**
 * Rebuilds the index and refreshes the bundled scripts when search is on.
 * Generated files, so they're written directly (not through history).
 */
export async function refreshSearch(
  root: string
): Promise<{ pages: number; bytes: number } | null> {
  if ((await readText(root, LOADER)) === null) return null
  for (const [path, content] of Object.entries(ASSETS)) {
    if ((await readText(root, path)) !== content) await writeFile(join(root, path), content)
  }
  const { json, pages } = await buildIndex(root)
  if ((await readText(root, INDEX)) !== json) await writeFile(join(root, INDEX), json)
  return { pages, bytes: Buffer.byteLength(json) }
}

// ---------- Script tag ----------

function readBox(script: Element | null): SearchBoxOptions {
  if (!script) return { ...DEFAULT_BOX }
  const theme = attr(script, 'data-theme')
  return {
    accent: attr(script, 'data-accent') ?? '',
    theme: theme === 'light' || theme === 'dark' ? theme : 'auto',
    placeholder: attr(script, 'data-placeholder') ?? '',
    empty: attr(script, 'data-empty') ?? '',
    suggest: (attr(script, 'data-suggest') ?? '')
      .split(',')
      .map((url) => url.trim())
      .filter(Boolean),
    shortcut: attr(script, 'data-shortcut') !== 'off'
  }
}

const SAFE_CSS = /^[-#\w\s(),.%]*$/

function cssValue(value: string, name: string): string {
  const v = value.trim()
  if (!SAFE_CSS.test(v) || /url\s*\(|expression/i.test(v)) {
    throw new Error(`${name}: use a plain CSS color, e.g. #1f2937, rgb(…) or var(--brand).`)
  }
  return v
}

export function scriptTag(box: SearchBoxOptions): string {
  const attrs: string[] = []
  if (box.accent.trim()) attrs.push(`data-accent="${escapeAttr(cssValue(box.accent, 'Accent'))}"`)
  if (box.theme !== 'auto') attrs.push(`data-theme="${box.theme}"`)
  if (box.placeholder.trim()) attrs.push(`data-placeholder="${escapeAttr(box.placeholder.trim())}"`)
  if (box.empty.trim()) attrs.push(`data-empty="${escapeAttr(box.empty.trim())}"`)
  const suggest = box.suggest.map((url) => url.trim()).filter(Boolean)
  if (suggest.length) attrs.push(`data-suggest="${escapeAttr(suggest.join(','))}"`)
  if (!box.shortcut) attrs.push('data-shortcut="off"')
  return `<script src="/${LOADER}"${attrs.map((a) => ' ' + a).join('')} defer></script>`
}

// ---------- Icon ----------

const SVG_TAGS = new Set([
  'svg', 'g', 'path', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'rect', 'defs',
  'lineargradient', 'radialgradient', 'stop', 'clippath', 'mask'
]) // prettier-ignore

/** A pasted SVG, reduced to drawing: no scripts, links, event handlers or foreign content. */
export function sanitizeSvg(input: string): string {
  const fragment = parseFragment(input.trim())
  const svg = (function first(nodes: typeof fragment.childNodes): Element | null {
    for (const node of nodes) {
      if (!isElement(node)) continue
      if (node.tagName === 'svg') return node
      const inner = first(node.childNodes)
      if (inner) return inner
    }
    return null
  })(fragment.childNodes)
  if (!svg) throw new Error('That isn’t an SVG. Paste the whole <svg>…</svg> markup.')
  const scrub = (element: Element): void => {
    element.attrs = element.attrs.filter(
      (a) =>
        !/^on/i.test(a.name) &&
        !/href$/i.test(a.name) &&
        !(a.name === 'style' && /url\s*\(|expression|@import/i.test(a.value)) &&
        !/javascript:/i.test(a.value)
    )
    element.childNodes = element.childNodes.filter(
      (child) => !isElement(child) || SVG_TAGS.has(child.tagName.toLowerCase())
    )
    children(element).forEach(scrub)
  }
  scrub(svg)
  return serializeOuter(svg)
}

function setAttr(element: Element, name: string, value: string): void {
  const found = element.attrs.find((a) => a.name === name)
  if (found) found.value = value
  else element.attrs.push({ name, value })
}

function iconSvg(icon: SearchIconOptions): string {
  const size = Math.round(Math.min(96, Math.max(8, Number(icon.size) || DEFAULT_ICON.size)))
  if (icon.icon === 'custom') {
    const svg = parseFragment(sanitizeSvg(icon.svg)).childNodes.find(isElement)!
    if (!attr(svg, 'viewBox') && attr(svg, 'width') && attr(svg, 'height')) {
      setAttr(
        svg,
        'viewBox',
        `0 0 ${parseFloat(attr(svg, 'width')!)} ${parseFloat(attr(svg, 'height')!)}`
      )
    }
    setAttr(svg, 'width', String(size))
    setAttr(svg, 'height', String(size))
    setAttr(svg, 'aria-hidden', 'true')
    setAttr(svg, 'focusable', 'false')
    setAttr(svg, 'data-icon', 'custom')
    setAttr(svg, 'style', 'display:block')
    return serializeOuter(svg)
  }
  const known = SEARCH_ICONS[icon.icon] ?? SEARCH_ICONS.search
  const stroke = Math.min(4, Math.max(0.5, Number(icon.stroke) || 2))
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" data-icon="${SEARCH_ICONS[icon.icon] ? icon.icon : 'search'}" style="display:block">` +
    known.body +
    '</svg>'
  )
}

/**
 * The trigger button. Its look is inline so it needs no stylesheet; `display`
 * is left alone so the site's own classes and @media rules can hide or show it.
 */
export function iconMarkup(icon: SearchIconOptions): string {
  const px = (value: number, max: number): number =>
    Math.round(Math.min(max, Math.max(0, Number(value) || 0)))
  const style = [
    'appearance:none',
    '-webkit-appearance:none',
    'margin:0',
    'border:0',
    `padding:${px(icon.padding, 48)}px`,
    `border-radius:${px(icon.radius, 999)}px`,
    `color:${cssValue(icon.color || 'currentColor', 'Icon color')}`,
    `background:${cssValue(icon.background || 'transparent', 'Background')}`,
    'line-height:0',
    'vertical-align:middle',
    'cursor:pointer'
  ].join(';')
  const label = escapeAttr(icon.label.trim() || 'Search')
  return `<button type="button" class="${ICON_CLASS}" ${TRIGGER_ATTR} aria-label="${label}" title="${label}" style="${style}">${iconSvg(icon)}</button>`
}

/** The look of an icon CraftPages inserted, read back from its markup. */
function readIcon(button: Element): SearchIconOptions {
  const style = attr(button, 'style') ?? ''
  const prop = (name: string): string =>
    style.match(new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]+)`))?.[1]?.trim() ?? ''
  const svg = children(button).find((e) => e.tagName === 'svg')
  const kind = (svg && attr(svg, 'data-icon')) || 'search'
  return {
    icon: kind === 'custom' || SEARCH_ICONS[kind] ? kind : 'search',
    svg: kind === 'custom' && svg ? serializeOuter(svg) : '',
    size: Number(svg && attr(svg, 'width')) || DEFAULT_ICON.size,
    stroke: Number(svg && attr(svg, 'stroke-width')) || DEFAULT_ICON.stroke,
    color: prop('color') || DEFAULT_ICON.color,
    background: prop('background') || DEFAULT_ICON.background,
    radius: parseFloat(prop('border-radius')) || 0,
    padding: parseFloat(prop('padding')) || 0,
    label: attr(button, 'aria-label') || DEFAULT_ICON.label
  }
}

const isOurIcon = (e: Element): boolean =>
  (attr(e, 'class') ?? '').split(/\s+/).includes(ICON_CLASS) && attr(e, TRIGGER_ATTR) !== undefined

// ---------- State ----------

export async function searchState(root: string): Promise<SearchState> {
  const site = await getSiteSettings(root)
  const pages = await htmlPages(root)
  const withScript = pages.find((page) => loaderScript(page.document))
  let icon: SearchIconOptions | null = null
  const states = pages.map((page): SearchPageState => {
    let triggers = 0
    walk(page.document, (e) => {
      if (attr(e, TRIGGER_ATTR) !== undefined) {
        triggers++
        if (!icon && isOurIcon(e)) icon = readIcon(e)
      }
      return true
    })
    return {
      path: page.path,
      url: urlOfPage(page.path),
      title: titleOf(page, site.siteName),
      script: Boolean(loaderScript(page.document)),
      excluded: exclusion(page),
      triggers
    }
  })
  const index = await readText(root, INDEX)
  let indexed = 0
  try {
    indexed = index ? (JSON.parse(index) as { pages: unknown[] }).pages.length : 0
  } catch {
    // Unreadable: rebuilt on the next save.
  }
  return {
    enabled: Boolean(withScript),
    box: readBox(withScript ? loaderScript(withScript.document) : null),
    icon: icon ?? { ...DEFAULT_ICON },
    icons: Object.entries(SEARCH_ICONS).map(([id, { label }]) => ({
      id,
      label,
      svg: iconSvg({ ...DEFAULT_ICON, icon: id, size: 22 })
    })),
    pages: states.sort((a, b) => a.url.localeCompare(b.url)),
    index: index === null ? null : { pages: indexed, bytes: Buffer.byteLength(index) }
  }
}

// ---------- Changes ----------

function blocked(path: string): string | null {
  return hasDraft(path) ? 'Unsaved edits: save or discard them first.' : null
}

async function commit(
  root: string,
  writes: FileWrite[],
  skipped: SearchChange['skipped'],
  label: string
): Promise<SearchChange> {
  const historyId = writes.length ? await writeFiles(root, writes, label) : null
  await refreshSearch(root)
  return {
    pages: writes.filter((w) => /\.html?$/.test(w.path)).map((w) => w.path),
    skipped,
    historyId
  }
}

/** Puts the loader on every page (or updates its options) and writes the assets. */
/** The patch that adds (or updates) the loader on a page; null when it's already right. */
function scriptPatch(page: Page, tag: string): Patch | null | { skip: string } {
  const existing = loaderScript(page.document)
  const location = existing?.sourceCodeLocation
  if (existing && location) {
    if (page.source.slice(location.startOffset, location.endOffset) === tag) return null
    return { start: location.startOffset, end: location.endOffset, text: tag }
  }
  const headEnd = headOf(page.document)?.sourceCodeLocation?.endTag?.startOffset
  if (headEnd === undefined) return { skip: 'No </head> to put the script in.' }
  return { start: headEnd, end: headEnd, text: `  ${tag}\n` }
}

async function assetWrites(root: string): Promise<FileWrite[]> {
  const writes: FileWrite[] = []
  for (const [path, content] of Object.entries(ASSETS)) {
    if ((await readText(root, path)) !== content) writes.push({ path, content })
  }
  return writes
}

/** Page writes from patches per page, skipping pages with unsaved edits. */
function pageWrites(
  pages: Page[],
  patches: Map<string, Patch[]>,
  skipped: SearchChange['skipped']
): FileWrite[] {
  const writes: FileWrite[] = []
  for (const page of pages) {
    const list = patches.get(page.path)
    if (!list?.length) continue
    const reason = blocked(page.path)
    if (reason) {
      skipped.push({ path: page.path, reason })
      continue
    }
    writes.push({ path: page.path, content: applyPatches(page.source, list) })
  }
  return writes
}

function addPatch(patches: Map<string, Patch[]>, path: string, patch: Patch): void {
  patches.set(path, [...(patches.get(path) ?? []), patch])
}

/** Puts the loader on every page (or updates its options) and writes the assets. */
export async function enableSearch(root: string, box: SearchBoxOptions): Promise<SearchChange> {
  const tag = scriptTag(box)
  const pages = await htmlPages(root)
  const patches = new Map<string, Patch[]>()
  const skipped: SearchChange['skipped'] = []
  for (const page of pages) {
    const patch = scriptPatch(page, tag)
    if (patch && 'skip' in patch) skipped.push({ path: page.path, reason: patch.skip })
    else if (patch) addPatch(patches, page.path, patch)
  }
  const writes = [...pageWrites(pages, patches, skipped), ...(await assetWrites(root))]
  return commit(root, writes, skipped, 'Search: turned on')
}

/** Removes the loader, the icons CraftPages inserted, the assets and the index. */
export async function disableSearch(root: string): Promise<SearchChange> {
  const writes: FileWrite[] = []
  const skipped: SearchChange['skipped'] = []
  for (const page of await htmlPages(root)) {
    const patches: Patch[] = []
    walk(page.document, (e) => {
      const location = e.sourceCodeLocation
      if (
        location &&
        (isOurIcon(e) || (e.tagName === 'script' && LOADER_SRC.test(attr(e, 'src') ?? '')))
      ) {
        let start = location.startOffset
        // Take the line's indentation along.
        while (start > 0 && /[ \t]/.test(page.source[start - 1])) start--
        const end =
          page.source[location.endOffset] === '\n' && page.source[start - 1] === '\n'
            ? location.endOffset + 1
            : location.endOffset
        patches.push({ start, end, text: '' })
        return false
      }
      return true
    })
    if (!patches.length) continue
    const reason = blocked(page.path)
    if (reason) {
      skipped.push({ path: page.path, reason })
      continue
    }
    writes.push({ path: page.path, content: applyPatches(page.source, patches) })
  }
  for (const path of [...Object.keys(ASSETS), INDEX]) {
    if ((await readText(root, path)) !== null) writes.push({ path, content: null })
  }
  const historyId = writes.length ? await writeFiles(root, writes, 'Search: turned off') : null
  return {
    pages: writes.filter((w) => /\.html?$/.test(w.path)).map((w) => w.path),
    skipped,
    historyId
  }
}

function insertAt(element: Element, position: IconPosition): number | null {
  const location = element.sourceCodeLocation
  if (!location) return null
  if (position === 'before') return location.startOffset
  if (position === 'after') return location.endOffset
  if (!location.endTag || !location.startTag) return null // void element: no inside
  return position === 'start' ? location.startTag.endOffset : location.endTag.startOffset
}

/** Where the icon goes relative to `target`: the parent that will hold it. */
const holderOf = (target: Element, position: IconPosition): Element | null =>
  position === 'start' || position === 'end' ? target : (target.parentNode as Element)

function hasIconIn(holder: Element | null): boolean {
  return Boolean(holder && children(holder).some((e) => attr(e, TRIGGER_ATTR) !== undefined))
}

/**
 * Inserts the icon at a picked element. With scope 'all' and the element inside
 * a shared block (header, nav…), it lands at the same spot on every page with
 * that block.
 */
export async function placeIcon(
  root: string,
  path: string,
  locator: ElementLocator,
  position: IconPosition,
  scope: 'all' | 'page',
  icon: SearchIconOptions,
  /** When search is still off: turn it on in the same undoable step, with these options. */
  enableWith?: SearchBoxOptions | null
): Promise<SearchChange> {
  const markup = iconMarkup(icon)
  const pages = await htmlPages(root)
  const enable = Boolean(enableWith) && (await readText(root, LOADER)) === null
  const home = pages.find((page) => page.path === path)
  if (!home) throw new Error(`${path} not found`)
  const target = resolveLocator(home.document, locator)
  if (!target) throw new Error('The picked element is no longer on the page. Pick it again.')

  // The shared block the element sits in, and the way down to it.
  let shared: { signature: string; path: number[] } | null = null
  if (scope === 'all') {
    const blocks = pageComponents(home.document)
    for (
      let node: Element | null = target;
      node && !shared;
      node = node.parentNode as Element | null
    ) {
      if (!('tagName' in (node ?? {}))) break
      for (const [signature, element] of blocks) {
        if (element === node) {
          shared = { signature, path: pathFrom(element, target) ?? [] }
          break
        }
      }
    }
  }

  const patches = new Map<string, Patch[]>()
  const skipped: SearchChange['skipped'] = []
  const targets: { page: Page; element: Element }[] = [{ page: home, element: target }]
  if (shared) {
    for (const page of pages) {
      if (page === home) continue
      const block = pageComponents(page.document).get(shared.signature)
      const element = block && follow(block, shared.path)
      if (element && element.tagName === target.tagName) targets.push({ page, element })
    }
  }
  for (const { page, element } of targets) {
    const at = insertAt(element, position)
    if (at === null) {
      skipped.push({
        path: page.path,
        reason: 'Can’t put anything inside this element; pick before or after.'
      })
    } else if (hasIconIn(holderOf(element, position))) {
      skipped.push({ path: page.path, reason: 'Already has a search icon there.' })
    } else {
      addPatch(patches, page.path, { start: at, end: at, text: markup })
    }
  }
  if (enable) {
    const tag = scriptTag(enableWith!)
    for (const page of pages) {
      const patch = scriptPatch(page, tag)
      if (patch && 'skip' in patch) skipped.push({ path: page.path, reason: patch.skip })
      else if (patch) addPatch(patches, page.path, patch)
    }
  }
  const writes = [
    ...pageWrites(pages, patches, skipped),
    ...(enable ? await assetWrites(root) : [])
  ]
  return commit(root, writes, skipped, enable ? 'Search: added' : 'Search: icon placed')
}

/** Gives every icon CraftPages inserted the new look. */
export async function updateIcons(root: string, icon: SearchIconOptions): Promise<SearchChange> {
  const markup = iconMarkup(icon)
  const writes: FileWrite[] = []
  const skipped: SearchChange['skipped'] = []
  for (const page of await htmlPages(root)) {
    const patches: Patch[] = []
    walk(page.document, (e) => {
      const location = e.sourceCodeLocation
      if (location && isOurIcon(e)) {
        if (page.source.slice(location.startOffset, location.endOffset) !== markup) {
          patches.push({ start: location.startOffset, end: location.endOffset, text: markup })
        }
        return false
      }
      return true
    })
    if (!patches.length) continue
    const reason = blocked(page.path)
    if (reason) {
      skipped.push({ path: page.path, reason })
      continue
    }
    writes.push({ path: page.path, content: applyPatches(page.source, patches) })
  }
  return commit(root, writes, skipped, 'Search: icons restyled')
}

/** Leaves a page out of the index (or back in) with a meta tag in the page itself. */
export async function setExcluded(
  root: string,
  path: string,
  excluded: boolean
): Promise<SearchChange> {
  const page = (await htmlPages(root)).find((p) => p.path === path)
  if (!page) throw new Error(`${path} not found`)
  const reason = blocked(path)
  if (reason) return { pages: [], skipped: [{ path, reason }], historyId: null }
  const existing = meta(page.document, 'name', EXCLUDE_META)
  let patch: Patch | null = null
  if (excluded && !existing) {
    const headEnd = headOf(page.document)?.sourceCodeLocation?.endTag?.startOffset
    if (headEnd === undefined) throw new Error(`${path} has no </head>`)
    patch = {
      start: headEnd,
      end: headEnd,
      text: `  <meta name="${EXCLUDE_META}" content="exclude">\n`
    }
  } else if (!excluded && existing?.sourceCodeLocation) {
    let start = existing.sourceCodeLocation.startOffset
    while (start > 0 && /[ \t]/.test(page.source[start - 1])) start--
    const end = existing.sourceCodeLocation.endOffset
    patch = { start, end: page.source[end] === '\n' ? end + 1 : end, text: '' }
  }
  if (!patch) return { pages: [], skipped: [], historyId: null }
  return commit(
    root,
    [{ path, content: applyPatches(page.source, [patch]) }],
    [],
    excluded ? `Search: ${path} left out` : `Search: ${path} included`
  )
}

/** Site path of the index, for docs and the guide. */
export const INDEX_URL = posix.join('/', INDEX)
