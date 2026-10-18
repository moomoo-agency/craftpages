import { readFile } from 'fs/promises'
import { join } from 'path'
import { writeFiles, type FileWrite } from './history'
import { hasDraft } from './drafts'
import { FLAGS, defaultFlag } from './flags'
import {
  applyPatches,
  attr,
  children,
  escapeAttr,
  escapeText,
  parseWithLocations,
  walk,
  type Element,
  type Patch
} from './html/dom'
import { pageComponents } from './html/components'
import { follow, pathFrom, resolveLocator } from './html/locator'
import { getSiteSettings } from './settings'
import { listFiles } from './workspace'
import type {
  ElementLocator,
  IconPosition,
  SearchChange,
  SiteLanguage,
  SiteSettings,
  SwitcherLook,
  SwitcherState
} from '../shared/types'

/**
 * The site's language switcher: a plain <nav> of links, one per language. CraftPages writes
 * each page's links to that page's own versions (or a language's home page when it has none),
 * so it works without JavaScript and search engines follow it. Its look is kept on the
 * element itself (data-*), the labels and flags in the site's languages.
 *
 * Shared-part detection ignores what's inside (see components.ts), so a header with a
 * switcher stays one shared part per language even though each page's links differ.
 */

export const SWITCHER_ATTR = 'data-craftpages-languages'
export const SWITCHER_CLASS = 'craftpages-languages'
export const FLAG_DIR = 'assets/craftpages-flags'
export const DEFAULT_LOOK: SwitcherLook = { display: 'text', size: 0, gap: 10 }

/** "Language" in a few languages, for the switcher's accessible name. */
const WORD: Record<string, string> = {
  de: 'Sprache',
  en: 'Language',
  es: 'Idioma',
  fr: 'Langue',
  it: 'Lingua',
  nl: 'Taal',
  pl: 'Język',
  pt: 'Idioma',
  ru: 'Язык',
  uk: 'Мова'
}

export const labelOf = (language: SiteLanguage): string =>
  language.label?.trim() || language.code.toUpperCase()

export const flagOf = (language: SiteLanguage): string | null =>
  language.flag && FLAGS[language.flag] ? language.flag : defaultFlag(language.code)

const clamp = (value: number, min: number, max: number): number =>
  Math.round(Math.min(max, Math.max(min, Number(value) || 0)))

function cleanLook(look: Partial<SwitcherLook>): SwitcherLook {
  return {
    display: look.display === 'flag' || look.display === 'both' ? look.display : 'text',
    size: clamp(look.size ?? 0, 0, 64),
    gap: clamp(look.gap ?? DEFAULT_LOOK.gap, 0, 48)
  }
}

export function readLook(element: Element): SwitcherLook {
  return cleanLook({
    display: attr(element, SWITCHER_ATTR) as SwitcherLook['display'],
    size: Number(attr(element, 'data-size') ?? 0),
    gap: Number(attr(element, 'data-gap') ?? DEFAULT_LOOK.gap)
  })
}

/**
 * The switcher for one page. `links`: language code → address; languages without one are left
 * out. `inlineFlags` puts the flags in data: URLs (for a preview, before the files exist).
 */
export function switcherMarkup(
  site: SiteSettings,
  look: Partial<SwitcherLook>,
  current: string,
  links: Map<string, string>,
  inlineFlags = false
): string {
  const { display, size, gap } = cleanLook(look)
  const word = WORD[current.toLowerCase().split('-')[0]] ?? WORD.en
  const items = site.languages
    .filter((language) => links.has(language.code))
    .map((language) => {
      const flag = display === 'text' ? null : flagOf(language)
      const text = display === 'text' || display === 'both' || !flag
      const height = size || 14
      const image = flag
        ? `<img src="${
            inlineFlags
              ? `data:image/svg+xml;base64,${Buffer.from(FLAGS[flag].svg).toString('base64')}`
              : `/${FLAG_DIR}/${flag}.svg`
          }" alt="${text ? '' : escapeAttr(language.name)}" width="${Math.round(height * 1.5)}" height="${height}" style="display:block;border-radius:2px">`
        : ''
      const isCurrent = language.code === current
      const style = [
        'display:inline-flex',
        'align-items:center',
        `gap:${Math.round((size || 14) * 0.4)}px`,
        'color:inherit',
        'text-decoration:none',
        ...(size ? [`font-size:${size}px`] : []),
        isCurrent ? 'font-weight:600' : 'opacity:.7'
      ].join(';')
      return (
        `<a href="${escapeAttr(links.get(language.code)!)}" hreflang="${escapeAttr(language.code)}" lang="${escapeAttr(language.code)}"` +
        `${isCurrent ? ' aria-current="true"' : ''} title="${escapeAttr(language.name)}" style="${style}">` +
        `${image}${text ? `<span>${escapeText(labelOf(language))}</span>` : ''}</a>`
      )
    })
  return (
    `<nav class="${SWITCHER_CLASS}" ${SWITCHER_ATTR}="${display}" data-size="${size}" data-gap="${gap}"` +
    ` aria-label="${escapeAttr(word)}" style="display:inline-flex;align-items:center;flex-wrap:wrap;gap:${gap}px">` +
    `${items.join('')}</nav>`
  )
}

function switchers(document: ReturnType<typeof parseWithLocations>): Element[] {
  const found: Element[] = []
  walk(document, (element) => {
    if (attr(element, SWITCHER_ATTR) === undefined) return true
    found.push(element)
    return false
  })
  return found
}

/** Every switcher on a page rewritten for it (same look, this page's links). */
export function fillSwitchers(
  source: string,
  site: SiteSettings,
  current: string,
  links: Map<string, string>,
  look?: Partial<SwitcherLook>
): string {
  if (!source.includes(SWITCHER_ATTR)) return source
  const patches: Patch[] = []
  for (const element of switchers(parseWithLocations(source))) {
    const location = element.sourceCodeLocation
    if (!location) continue
    const text = switcherMarkup(site, look ?? readLook(element), current, links)
    if (source.slice(location.startOffset, location.endOffset) !== text)
      patches.push({ start: location.startOffset, end: location.endOffset, text })
  }
  return patches.length ? applyPatches(source, patches) : source
}

/**
 * Adds the flag files to a save that writes switchers: a language added after the switcher
 * (or a site copied without its flags folder) would otherwise show a broken image.
 */
export async function withFlags(
  root: string,
  site: SiteSettings,
  writes: FileWrite[]
): Promise<FileWrite[]> {
  const showsFlags = writes.some(
    (write) =>
      typeof write.content === 'string' &&
      write.content.includes(SWITCHER_ATTR) &&
      new RegExp(`${SWITCHER_ATTR}="(flag|both)"`).test(write.content)
  )
  if (!showsFlags) return writes
  const flags = (await flagWrites(root, site)).filter(
    (flag) => !writes.some((write) => write.path === flag.path)
  )
  return [...writes, ...flags]
}

/** The flag files the switchers show, written when missing or changed. */
export async function flagWrites(root: string, site: SiteSettings): Promise<FileWrite[]> {
  const writes: FileWrite[] = []
  for (const language of site.languages) {
    const flag = flagOf(language)
    if (!flag) continue
    const path = `${FLAG_DIR}/${flag}.svg`
    const current = await readFile(join(root, path), 'utf8').catch(() => null)
    if (current !== FLAGS[flag].svg && !writes.some((w) => w.path === path))
      writes.push({ path, content: FLAGS[flag].svg })
  }
  return writes
}

// ---------- Placing ----------

interface Page {
  path: string
  source: string
  document: ReturnType<typeof parseWithLocations>
}

/** Every page of the site, layout pages and blog pages included (the blog copies them). */
async function allPages(root: string): Promise<Page[]> {
  const files = (await listFiles(root)).filter((file) => /\.html?$/i.test(file.path))
  return Promise.all(
    files.map(async (file) => {
      const source = await readFile(join(root, file.path), 'utf8')
      return { path: file.path, source, document: parseWithLocations(source) }
    })
  )
}

function insertAt(element: Element, position: IconPosition): number | null {
  const location = element.sourceCodeLocation
  if (!location) return null
  if (position === 'before') return location.startOffset
  if (position === 'after') return location.endOffset
  if (!location.endTag || !location.startTag) return null
  return position === 'start' ? location.startTag.endOffset : location.endTag.startOffset
}

const holderOf = (target: Element, position: IconPosition): Element | null =>
  position === 'start' || position === 'end' ? target : (target.parentNode as Element)

/**
 * Puts a switcher at a spot on a page, and with scope "all" at the same spot of that shared
 * part on every page that has it (in every language: the part's place, not its text). Each
 * page gets its own links through `linksFor`. One revertable save, with the flag files.
 */
export async function placeSwitcher(
  root: string,
  path: string,
  locator: ElementLocator,
  position: IconPosition,
  scope: 'all' | 'page',
  look: Partial<SwitcherLook>,
  linksFor: (path: string) => { code: string; links: Map<string, string> }
): Promise<SearchChange> {
  const site = await getSiteSettings(root)
  if (site.languages.length < 2) throw new Error('Add a second language first.')
  const pages = await allPages(root)
  const home = pages.find((page) => page.path === path)
  if (!home) throw new Error(`${path} not found`)
  const target = resolveLocator(home.document, locator)
  if (!target) throw new Error('The picked element is no longer on the page. Pick it again.')

  let shared: { signature: string; path: number[] } | null = null
  if (scope === 'all') {
    const blocks = pageComponents(home.document)
    for (let node: Element | null = target; node && !shared; node = node.parentNode as Element) {
      if (!('tagName' in node)) break
      for (const [signature, element] of blocks) {
        if (element === node) {
          shared = { signature, path: pathFrom(element, target) ?? [] }
          break
        }
      }
    }
  }
  const targets: { page: Page; element: Element }[] = [{ page: home, element: target }]
  if (shared) {
    for (const page of pages) {
      if (page === home) continue
      const block = pageComponents(page.document).get(shared.signature)
      const element = block && follow(block, shared.path)
      if (element && element.tagName === target.tagName) targets.push({ page, element })
    }
  }

  const writes: FileWrite[] = []
  const skipped: SearchChange['skipped'] = []
  for (const { page, element } of targets) {
    const at = insertAt(element, position)
    const holder = holderOf(element, position)
    if (hasDraft(page.path)) {
      skipped.push({ path: page.path, reason: 'Unsaved edits: save or discard them first.' })
    } else if (at === null) {
      skipped.push({
        path: page.path,
        reason: 'Can’t put anything inside this element; pick before or after.'
      })
    } else if (holder && children(holder).some((e) => attr(e, SWITCHER_ATTR) !== undefined)) {
      skipped.push({ path: page.path, reason: 'Already has a language switcher there.' })
    } else {
      const { code, links } = linksFor(page.path)
      const markup = switcherMarkup(site, look, code, links)
      writes.push({
        path: page.path,
        content: applyPatches(page.source, [{ start: at, end: at, text: markup }])
      })
    }
  }
  writes.push(...(await flagWrites(root, site)))
  const historyId = writes.length
    ? await writeFiles(root, writes, 'Languages: switcher added')
    : null
  return {
    pages: writes.filter((w) => /\.html?$/.test(w.path)).map((w) => w.path),
    skipped,
    historyId
  }
}

/** Rewrites every switcher with this look (and the current labels and flags). */
export async function restyleSwitchers(
  root: string,
  look: Partial<SwitcherLook>,
  linksFor: (path: string) => { code: string; links: Map<string, string> }
): Promise<SearchChange> {
  const site = await getSiteSettings(root)
  const writes: FileWrite[] = []
  const skipped: SearchChange['skipped'] = []
  for (const page of await allPages(root)) {
    if (!page.source.includes(SWITCHER_ATTR)) continue
    if (hasDraft(page.path)) {
      skipped.push({ path: page.path, reason: 'Unsaved edits: save or discard them first.' })
      continue
    }
    const { code, links } = linksFor(page.path)
    const next = fillSwitchers(page.source, site, code, links, look)
    if (next !== page.source) writes.push({ path: page.path, content: next })
  }
  writes.push(...(await flagWrites(root, site)))
  const historyId = writes.length
    ? await writeFiles(root, writes, 'Languages: switcher look')
    : null
  return {
    pages: writes.filter((w) => /\.html?$/.test(w.path)).map((w) => w.path),
    skipped,
    historyId
  }
}

/** Takes every switcher off the site. */
export async function removeSwitchers(root: string): Promise<SearchChange> {
  const writes: FileWrite[] = []
  const skipped: SearchChange['skipped'] = []
  for (const page of await allPages(root)) {
    if (!page.source.includes(SWITCHER_ATTR)) continue
    if (hasDraft(page.path)) {
      skipped.push({ path: page.path, reason: 'Unsaved edits: save or discard them first.' })
      continue
    }
    const patches: Patch[] = switchers(page.document).flatMap((element) => {
      const location = element.sourceCodeLocation
      return location ? [{ start: location.startOffset, end: location.endOffset, text: '' }] : []
    })
    if (patches.length)
      writes.push({ path: page.path, content: applyPatches(page.source, patches) })
  }
  const historyId = writes.length
    ? await writeFiles(root, writes, 'Languages: switcher removed')
    : null
  return { pages: writes.map((w) => w.path), skipped, historyId }
}

export async function switcherState(root: string): Promise<SwitcherState> {
  const pages: string[] = []
  let look: SwitcherLook | null = null
  for (const file of (await listFiles(root)).filter((f) => /\.html?$/i.test(f.path))) {
    const source = await readFile(join(root, file.path), 'utf8')
    if (!source.includes(SWITCHER_ATTR)) continue
    pages.push(file.path)
    if (!look) {
      const first = switchers(parseWithLocations(source))[0]
      if (first) look = readLook(first)
    }
  }
  const site = await getSiteSettings(root)
  return {
    pages,
    look: look ?? { ...DEFAULT_LOOK },
    defaultFlags: Object.fromEntries(
      site.languages.flatMap((language) => {
        const flag = defaultFlag(language.code)
        return flag ? [[language.code, flag]] : []
      })
    ),
    flags: Object.entries(FLAGS)
      .map(([id, { name, svg }]) => ({ id, name, svg }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }
}
