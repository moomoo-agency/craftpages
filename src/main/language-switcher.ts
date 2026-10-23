import { readFile } from 'fs/promises'
import { join } from 'path'
import { writeFiles, type FileWrite } from './history'
import { hasDraft } from './drafts'
import { FLAGS, defaultFlag } from './flags'
import { defaultLabel } from '../shared/languages'
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
  SwitcherLinks,
  SwitcherLook,
  SwitcherState
} from '../shared/types'

/**
 * The site's language switcher: a plain <nav> of links, one per language, in a row or as a
 * dropdown (the current language, opening a list of the others). CraftPages writes each
 * page's links to that page's own versions, leaving out the languages it has none in (or,
 * when the look says so, linking to that language's home page), so it works without
 * JavaScript and search engines follow it. Its look is kept on the element itself (data-*),
 * the labels and flags in the site's languages.
 *
 * Shared-part detection ignores what's inside (see components.ts), so a header with a
 * switcher stays one shared part per language even though each page's links differ.
 */

export const SWITCHER_ATTR = 'data-craftpages-languages'
export const SWITCHER_CLASS = 'craftpages-languages'
export const FLAG_DIR = 'assets/craftpages-flags'
export const DEFAULT_LOOK: SwitcherLook = {
  display: 'text',
  layout: 'row',
  missing: 'hide',
  size: 0,
  gap: 10
}

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

export const labelOf = (language: SiteLanguage, languages: SiteLanguage[]): string =>
  language.label?.trim() || defaultLabel(language, languages)

export const flagOf = (language: SiteLanguage): string | null =>
  language.flag && FLAGS[language.flag] ? language.flag : defaultFlag(language.code)

const clamp = (value: number, min: number, max: number): number =>
  Math.round(Math.min(max, Math.max(min, Number(value) || 0)))

function cleanLook(look: Partial<SwitcherLook>): SwitcherLook {
  return {
    display: look.display === 'flag' || look.display === 'both' ? look.display : 'text',
    layout: look.layout === 'dropdown' ? 'dropdown' : 'row',
    missing: look.missing === 'home' ? 'home' : 'hide',
    size: clamp(look.size ?? 0, 0, 64),
    gap: clamp(look.gap ?? DEFAULT_LOOK.gap, 0, 48)
  }
}

export function readLook(element: Element): SwitcherLook {
  return cleanLook({
    display: attr(element, SWITCHER_ATTR) as SwitcherLook['display'],
    layout: attr(element, 'data-layout') as SwitcherLook['layout'],
    // Switchers from before the choice have no data-missing: they linked to the home page.
    missing: (attr(element, 'data-missing') ?? 'home') as SwitcherLook['missing'],
    size: Number(attr(element, 'data-size') ?? 0),
    gap: Number(attr(element, 'data-gap') ?? DEFAULT_LOOK.gap)
  })
}

/**
 * The dropdown's extras, the same on every switcher: the browser's marker and any icons the
 * site's own CSS draws on every <summary> (accordion frameworks do) hidden, a hover, and
 * a small script (once per page, however many switchers it has) that closes an open list on a
 * click elsewhere or Escape, and opens it towards the middle of the screen (from the button's
 * left edge in a phone menu, its right edge in a header). Without the script the list
 * still opens and closes on its button.
 */
const DROPDOWN_STYLE =
  `<style>.${SWITCHER_CLASS} summary::-webkit-details-marker{display:none}` +
  `.${SWITCHER_CLASS} summary::before,.${SWITCHER_CLASS} summary::after{content:none!important;display:none!important}` +
  `.${SWITCHER_CLASS} li a:hover,.${SWITCHER_CLASS} li a:focus-visible{background:rgba(127,127,127,.14)}</style>`
const DROPDOWN_SCRIPT =
  `<script>(function(){if(window.craftpagesLanguages)return;window.craftpagesLanguages=1;` +
  `function close(e){document.querySelectorAll('.${SWITCHER_CLASS} details[open]').forEach(function(d){` +
  `if(e.type==='keydown'?e.key==='Escape':!d.contains(e.target)){d.open=false;` +
  `if(e.type==='keydown')d.querySelector('summary').focus()}})}` +
  `function place(e){var d=e.target;if(!d.matches||!d.matches('.${SWITCHER_CLASS} details')||!d.open)return;` +
  `var r=d.getBoundingClientRect(),u=d.querySelector('ul'),start=r.left+r.width/2<innerWidth/2;` +
  `u.style.insetInlineStart=start?'0':'auto';u.style.insetInlineEnd=start?'auto':'0'}` +
  `document.addEventListener('click',close);document.addEventListener('keydown',close);` +
  `document.addEventListener('toggle',place,true)})()</script>`
const CHEVRON =
  '<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" style="display:block;opacity:.6">' +
  '<path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'

/**
 * The switcher for one page. `links`: language code → address; languages without one are left
 * out, and so are stand-ins (a language's home page) unless the look links to them.
 * `inlineFlags` puts the flags in data: URLs (for a preview, before the files exist).
 */
export function switcherMarkup(
  site: SiteSettings,
  look: Partial<SwitcherLook>,
  current: string,
  links: SwitcherLinks,
  inlineFlags = false
): string {
  const clean = cleanLook(look)
  const { display, layout, missing, size, gap } = clean
  const word = WORD[current.toLowerCase().split('-')[0]] ?? WORD.en
  const shown = site.languages.filter((language) => {
    const link = links.get(language.code)
    return link && (link.exact || missing === 'home' || language.code === current)
  })
  const height = size || 14
  const inner = (language: SiteLanguage): string => {
    const flag = display === 'text' ? null : flagOf(language)
    const text = display === 'text' || display === 'both' || !flag
    const image = flag
      ? `<img src="${
          inlineFlags
            ? `data:image/svg+xml;base64,${Buffer.from(FLAGS[flag].svg).toString('base64')}`
            : `/${FLAG_DIR}/${flag}.svg`
        }" alt="${text ? '' : escapeAttr(language.name)}" width="${Math.round(height * 1.5)}" height="${height}" style="display:block;border-radius:2px">`
      : ''
    return `${image}${text ? `<span>${escapeText(labelOf(language, site.languages))}</span>` : ''}`
  }
  const anchor = (language: SiteLanguage, style: string[]): string => {
    const isCurrent = language.code === current
    return (
      `<a href="${escapeAttr(links.get(language.code)!.url)}" hreflang="${escapeAttr(language.code)}" lang="${escapeAttr(language.code)}"` +
      `${isCurrent ? ' aria-current="true"' : ''} title="${escapeAttr(language.name)}" style="${style.join(';')}">` +
      `${inner(language)}</a>`
    )
  }
  const itemStyle = [
    'display:inline-flex',
    'align-items:center',
    `gap:${Math.round(height * 0.4)}px`,
    'color:inherit',
    'text-decoration:none',
    ...(size ? [`font-size:${size}px`] : [])
  ]
  // Nothing to switch to: kept on the page (it fills in once a translation exists), not shown.
  // The setup's preview (inline flags) still shows it, or there'd be nothing to look at.
  const alone = !inlineFlags && !shown.some((language) => language.code !== current)
  const attrs =
    `class="${SWITCHER_CLASS}" ${SWITCHER_ATTR}="${display}" data-layout="${layout}" data-missing="${missing}"` +
    ` data-size="${size}" data-gap="${gap}" aria-label="${escapeAttr(word)}"`

  if (layout === 'row') {
    const items = shown.map((language) =>
      anchor(language, [...itemStyle, language.code === current ? 'font-weight:600' : 'opacity:.7'])
    )
    const style = alone
      ? 'display:none'
      : `display:inline-flex;align-items:center;flex-wrap:wrap;gap:${gap}px`
    return `<nav ${attrs} style="${style}">${items.join('')}</nav>`
  }

  const own = site.languages.find((language) => language.code === current)
  const others = shown.filter((language) => language.code !== current)
  const summary =
    `<summary aria-label="${escapeAttr(`${word}: ${own?.name ?? current}`)}" title="${escapeAttr(own?.name ?? current)}"` +
    // The site's CSS may style every <details>/<summary> as an accordion: inline styles undo it.
    ` style="${[...itemStyle, 'width:auto', 'margin:0', 'padding:0', 'border:0', 'background:none', 'cursor:pointer', 'list-style:none', 'font-weight:600'].join(';')}">` +
    `${own ? inner(own) : `<span>${escapeText(current.toUpperCase())}</span>`}${CHEVRON}</summary>`
  const list =
    `<ul style="position:absolute;top:100%;inset-inline-end:0;z-index:1000;margin:6px 0 0;padding:4px;list-style:none;` +
    `min-width:max-content;display:grid;gap:2px;background:var(--craftpages-languages-bg,#fff);` +
    `color:var(--craftpages-languages-fg,#1d1d1f);border-radius:8px;` +
    `box-shadow:0 8px 24px rgba(0,0,0,.14),0 0 0 1px rgba(0,0,0,.08)">` +
    others
      .map(
        (language) =>
          `<li style="margin:0;padding:0">${anchor(language, [...itemStyle.filter((s) => !s.startsWith('display')), 'display:flex', 'padding:6px 10px', 'border-radius:6px'])}</li>`
      )
      .join('') +
    `</ul>`
  return (
    `<nav ${attrs} style="${alone ? 'display:none' : 'display:inline-block;position:relative'}">` +
    `<details style="display:inline-block;position:relative;margin:0;padding:0;border:0;border-radius:0;background:none;color:inherit">${summary}${list}</details>${DROPDOWN_STYLE}${DROPDOWN_SCRIPT}</nav>`
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
  links: SwitcherLinks,
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
  linksFor: (path: string) => { code: string; links: SwitcherLinks }
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
  linksFor: (path: string) => { code: string; links: SwitcherLinks }
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
