import { open, readFile, stat } from 'fs/promises'
import { SWITCHER_ATTR, fillSwitchers, withFlags } from './language-switcher'
import { join } from 'path'
import { parse } from 'parse5'
import { hasDraft } from './drafts'
import { isPublished } from './deploy/exclude'
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
import { headInsertPatch, indentAt } from './html/seo'
import { getSiteSettings } from './settings'
import { fileFor, resolveLink, urlOfPage } from './site-paths'
import { listFiles } from './workspace'
import {
  LANGUAGE_CODE,
  languageName,
  languageOfPath,
  rootLanguage,
  sameLanguage
} from '../shared/languages'
import type {
  LanguagesState,
  LanguagesUpdate,
  SeoIssue,
  SiteLanguage,
  SiteSettings,
  TranslationGroup
} from '../shared/types'

/**
 * A site's languages live in the pages themselves: `<html lang>` says a page's language, and
 * `<link rel="alternate" hreflang>` in its head links it to its translations. Those links are
 * how translations are grouped, so a site that already has them is read as it is, and the
 * groups survive deleting `.sitecms`. Pages without such links are paired by path
 * (`about/` ↔ `en/about/`) until the links are written.
 */

interface Alternate {
  hreflang: string
  href: string
}

interface HeadInfo {
  lang: string
  alternates: Alternate[]
  /** Made by the blog generator (handled with the blog). */
  generated: boolean
}

// ---------- Reading heads ----------

const HEAD_BYTES = 64 * 1024
const heads = new Map<string, { mtimeMs: number; size: number; info: HeadInfo }>()

/** The file up to `</head>`: usually one small read. */
async function headText(full: string): Promise<string> {
  const handle = await open(full, 'r')
  try {
    const buffer = Buffer.alloc(HEAD_BYTES)
    const { bytesRead } = await handle.read(buffer, 0, HEAD_BYTES, 0)
    const text = buffer.subarray(0, bytesRead).toString('utf8')
    const end = text.search(/<\/head\s*>/i)
    if (end >= 0) return text.slice(0, end)
    if (bytesRead < HEAD_BYTES) return text
  } finally {
    await handle.close()
  }
  return readFile(full, 'utf8')
}

async function headInfo(root: string, path: string): Promise<HeadInfo> {
  const full = join(root, path)
  const info = await stat(full)
  const key = `${root}\0${path}`
  const cached = heads.get(key)
  if (cached && cached.mtimeMs === info.mtimeMs && cached.size === info.size) return cached.info
  const result = readHeadInfo(await headText(full))
  heads.set(key, { mtimeMs: info.mtimeMs, size: info.size, info: result })
  return result
}

function readHeadInfo(text: string): HeadInfo {
  const document = parse(text)
  const html = find(document, (e) => e.tagName === 'html')
  const result: HeadInfo = {
    lang: (html && attr(html, 'lang')) ?? '',
    alternates: [],
    generated: false
  }
  walk(document, (element) => {
    if (element.tagName === 'link' && isAlternate(element)) {
      result.alternates.push({ hreflang: attr(element, 'hreflang')!, href: attr(element, 'href')! })
    } else if (
      element.tagName === 'meta' &&
      attr(element, 'name') === 'generator' &&
      attr(element, 'content') === 'CraftPages'
    ) {
      result.generated = true
    }
  })
  return result
}

const isAlternate = (element: Element): boolean =>
  (attr(element, 'rel') ?? '').toLowerCase().split(/\s+/).includes('alternate') &&
  Boolean(attr(element, 'hreflang')) &&
  attr(element, 'href') !== undefined

// ---------- Grouping ----------

export interface Analysis {
  site: SiteSettings
  languages: SiteLanguage[]
  /** Pages whose language is managed: published, not made by the blog. */
  pages: string[]
  /**
   * Pages in the folder of a language the site doesn't list (`de/` with `<html lang="de">`,
   * after German was removed here, or before it's added): left as they are.
   */
  unmanaged: string[]
  codeOf: Map<string, string>
  infos: Map<string, HeadInfo>
  groupOf: Map<string, TranslationGroup>
  groups: TranslationGroup[]
  conflicts: { language: string; pages: string[] }[]
}

/** The address an hreflang link should use for a page: absolute when the site's address is set. */
export const alternateHref = (site: SiteSettings, path: string): string =>
  (site.baseUrl || '') + urlOfPage(path)

export async function htmlPages(root: string, site: SiteSettings): Promise<string[]> {
  return (await listFiles(root))
    .map((file) => file.path)
    .filter((path) => /\.html?$/i.test(path) && isPublished(site, path))
}

/**
 * Groups the site's pages into translations. `overlay` holds pages as they're about to be
 * written (new copies), read instead of the files.
 */
/** A page in a folder named after its own language, which isn't one of the site's. */
function inOtherLanguage(path: string, info: HeadInfo, languages: SiteLanguage[]): boolean {
  const slash = path.indexOf('/')
  if (slash < 0 || !info.lang || languageOfPath(path, languages)?.path) return false
  if (languages.some((language) => sameLanguage(info.lang, language.code))) return false
  return sameLanguage(info.lang, path.slice(0, slash))
}

export async function analyze(
  root: string,
  site: SiteSettings,
  all?: string[],
  overlay?: Map<string, string>,
  /** Blog pages too (grouped by the hreflang the blog writes, never by path): for the sitemap. */
  withGenerated = false
): Promise<Analysis> {
  const { languages } = site
  const listed = all ?? (await htmlPages(root, site))
  const candidates = overlay ? [...new Set([...listed, ...overlay.keys()])].sort() : listed
  const read = await Promise.all(
    candidates.map(
      async (path) =>
        [
          path,
          overlay?.has(path)
            ? readHeadInfo(overlay.get(path)!)
            : await headInfo(root, path).catch(() => null)
        ] as const
    )
  )
  const infos = new Map<string, HeadInfo>()
  for (const [path, info] of read)
    if (info && (withGenerated || !info.generated)) infos.set(path, info)
  const unmanaged = candidates.filter(
    (path) =>
      infos.has(path) && languages.length > 0 && inOtherLanguage(path, infos.get(path)!, languages)
  )
  const pages = candidates.filter((path) => infos.has(path) && !unmanaged.includes(path))
  const pageSet = new Set(pages)
  const codeOf = new Map(pages.map((path) => [path, languageOfPath(path, languages)?.code ?? '']))

  // Union-find over pages.
  const parent = new Map(pages.map((path) => [path, path]))
  const findRoot = (path: string): string => {
    let node = path
    while (parent.get(node) !== node) node = parent.get(node)!
    parent.set(path, node)
    return node
  }
  const union = (a: string, b: string): void => {
    parent.set(findRoot(a), findRoot(b))
  }
  const localTargets = new Map<string, string[]>()
  for (const path of pages) {
    const targets: string[] = []
    for (const alternate of infos.get(path)!.alternates) {
      if (alternate.hreflang.toLowerCase() === 'x-default') continue
      const link = resolveLink(alternate.href, path, site)
      const target = link && fileFor(link.path, pageSet)
      if (target && target !== path) targets.push(target)
    }
    localTargets.set(path, targets)
    for (const target of targets) union(path, target)
  }
  // Pages nobody links yet: paired by their path inside each language's folder.
  if (languages.length > 1) {
    for (const path of pages) {
      if (localTargets.get(path)!.length || infos.get(path)!.generated) continue
      const own = languageOfPath(path, languages)!
      const rest = path.slice(own.path.length)
      for (const other of languages) {
        if (other === own) continue
        const twin = other.path + rest
        if (pageSet.has(twin) && !localTargets.get(twin)!.length && !infos.get(twin)!.generated)
          union(path, twin)
      }
    }
  }

  const members = new Map<string, string[]>()
  for (const path of pages) {
    const key = findRoot(path)
    members.set(key, [...(members.get(key) ?? []), path])
  }
  const groupOf = new Map<string, TranslationGroup>()
  const groups: TranslationGroup[] = []
  const conflicts: Analysis['conflicts'] = []
  for (const list of members.values()) {
    const group: TranslationGroup = { pages: {} }
    const byCode = new Map<string, string[]>()
    for (const path of list.sort()) {
      const code = codeOf.get(path)!
      byCode.set(code, [...(byCode.get(code) ?? []), path])
    }
    for (const [code, paths] of byCode) {
      // Two pages of one language in a group: the first by path stays in it.
      const chosen = paths[0]
      group.pages[code] = chosen
      groupOf.set(chosen, group)
      if (paths.length > 1) {
        conflicts.push({ language: code, pages: paths })
        // The others stand alone, so each still gets a correct head.
        for (const path of paths)
          if (path !== chosen) groupOf.set(path, { pages: { [code]: path } })
      }
    }
    // In the site's language order, the root first.
    const order = (code: string): number => languages.findIndex((l) => l.code === code)
    group.pages = Object.fromEntries(
      Object.entries(group.pages).sort((a, b) => order(a[0]) - order(b[0]))
    )
    if (Object.keys(group.pages).length > 1) groups.push(group)
  }
  return { site, languages, pages, unmanaged, codeOf, infos, groupOf, groups, conflicts }
}

/** The hreflang links a page should have (local ones only; links to other sites are kept as they are). */
function expectedAlternates(analysis: Analysis, path: string): Alternate[] {
  const group = analysis.groupOf.get(path)
  if (!group || Object.keys(group.pages).length < 2) return []
  const { site, languages } = analysis
  const order = (code: string): number => languages.findIndex((language) => language.code === code)
  const list = Object.entries(group.pages)
    .sort((a, b) => order(a[0]) - order(b[0]))
    .map(([code, page]) => ({ hreflang: code, href: alternateHref(site, page) }))
  const rootPage = group.pages[rootLanguage(languages)?.code ?? '']
  if (rootPage) list.push({ hreflang: 'x-default', href: alternateHref(site, rootPage) })
  return list
}

/** Whether an hreflang link points inside this site (so it's ours to manage). */
const isLocal = (analysis: Analysis, path: string, alternate: Alternate): boolean =>
  resolveLink(alternate.href, path, analysis.site) !== null

const sameSet = (a: Alternate[], b: Alternate[]): boolean => {
  const key = (x: Alternate): string => `${x.hreflang.toLowerCase()} ${x.href}`
  const left = a.map(key).sort().join('\n')
  return left === b.map(key).sort().join('\n')
}

export function needsUpdate(analysis: Analysis, path: string): { lang: boolean; links: boolean } {
  const info = analysis.infos.get(path)!
  const code = analysis.codeOf.get(path)!
  const actual = info.alternates.filter((alternate) => isLocal(analysis, path, alternate))
  return {
    lang: !sameLanguage(info.lang, code),
    links: !sameSet(actual, expectedAlternates(analysis, path))
  }
}

// ---------- Detecting ----------

/** For a site not set up yet: the languages its folders, `lang` and hreflang point to. */
function detect(analysis: Analysis): SiteLanguage[] | null {
  const { pages, infos, site } = analysis
  const folders = new Map<string, string[]>()
  for (const path of pages) {
    const [first, ...rest] = path.split('/')
    if (rest.length && LANGUAGE_CODE.test(first) && first.length <= 7)
      folders.set(first, [...(folders.get(first) ?? []), path])
  }
  const hreflangs = new Set(
    pages.flatMap((path) => infos.get(path)!.alternates.map((a) => a.hreflang.toLowerCase()))
  )
  const found: SiteLanguage[] = []
  for (const [folder, paths] of folders) {
    const langs = paths.map((path) => infos.get(path)!.lang).filter(Boolean)
    const matching = langs.filter((lang) => sameLanguage(lang, folder))
    // A folder named like a language counts when its pages say so, or hreflang uses that code.
    // (a folder like faq/ is a language only with evidence).
    const evidence = matching.length > 0 && matching.length * 2 >= langs.length
    if (!evidence && !hreflangs.has(folder.toLowerCase())) continue
    // The pages' own spelling when it's the folder's code ("pt-BR" for pt-br/), else the folder.
    const code = matching.find((lang) => lang.toLowerCase() === folder.toLowerCase()) ?? folder
    found.push({ code, name: languageName(code), path: `${folder}/` })
  }
  if (!found.length) return null
  const outside = pages.filter((path) => !found.some((language) => path.startsWith(language.path)))
  const counts = new Map<string, number>()
  for (const path of outside) {
    const lang = infos.get(path)!.lang.trim()
    if (lang) counts.set(lang, (counts.get(lang) ?? 0) + 1)
  }
  const rootCode = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? (site.locale.trim() || 'en')
  const others = found.filter((language) => !sameLanguage(rootCode, language.code))
  if (!others.length) return null
  return [{ code: rootCode, name: languageName(rootCode), path: '' }, ...others]
}

// ---------- What the app shows ----------

export async function languagesState(root: string): Promise<LanguagesState> {
  const site = await getSiteSettings(root)
  const analysis = await analyze(root, site)
  const { languages } = site
  if (!languages.length) {
    return {
      languages,
      detected: detect(analysis),
      // Every page is in the site's one language: what the first row shows while adding another.
      counts: { [site.locale || 'en']: analysis.pages.length },
      groups: [],
      missing: {},
      outdated: [],
      unsaved: [],
      conflicts: [],
      unmanaged: []
    }
  }
  const counts: Record<string, number> = {}
  for (const code of analysis.codeOf.values()) counts[code] = (counts[code] ?? 0) + 1
  const rootCode = rootLanguage(languages)!.code
  const missing: Record<string, string[]> = {}
  for (const language of languages) {
    if (!language.path) continue
    missing[language.code] = analysis.pages.filter(
      (path) =>
        analysis.codeOf.get(path) === rootCode && !analysis.groupOf.get(path)?.pages[language.code]
    )
  }
  const stale = await staleSwitchers(root, analysis)
  const outdated = analysis.pages.filter((path) => {
    const update = needsUpdate(analysis, path)
    return update.lang || update.links || stale.has(path)
  })
  return {
    languages,
    detected: null,
    counts,
    groups: analysis.groups,
    missing,
    outdated,
    unsaved: outdated.filter(hasDraft),
    conflicts: analysis.conflicts,
    unmanaged: analysis.unmanaged
  }
}

/** Translations of each page that has some (for the sitemap). */
export async function translationsOf(
  root: string,
  site: SiteSettings,
  pages: string[]
): Promise<Map<string, TranslationGroup>> {
  if (site.languages.length < 2) return new Map()
  const analysis = await analyze(root, site, pages, undefined, true)
  return new Map([...analysis.groupOf].filter(([, group]) => Object.keys(group.pages).length > 1))
}

/** Language problems, for the SEO check. */
export async function languageIssues(
  root: string,
  site: SiteSettings,
  pages: string[]
): Promise<SeoIssue[]> {
  if (!site.languages.length) return []
  const analysis = await analyze(root, site, pages)
  const issues: SeoIssue[] = []
  for (const path of analysis.pages) {
    const code = analysis.codeOf.get(path)!
    const info = analysis.infos.get(path)!
    const update = needsUpdate(analysis, path)
    // A missing lang is reported by the general check already.
    if (update.lang && info.lang)
      issues.push({
        page: path,
        severity: 'warning',
        kind: 'language',
        message: `Says lang="${info.lang}", but it’s a ${languageName(code)} page.`
      })
    if (update.links)
      issues.push({
        page: path,
        severity: 'warning',
        kind: 'language',
        message:
          'Its links to translations (hreflang) are missing or out of date. Update them in Project settings → Languages.'
      })
  }
  for (const conflict of analysis.conflicts) {
    issues.push({
      page: conflict.pages[0],
      severity: 'warning',
      kind: 'language',
      message: `${conflict.pages.length} ${languageName(conflict.language)} pages are linked as translations of the same page.`,
      detail: conflict.pages
    })
  }
  if (!site.baseUrl && analysis.groups.length)
    issues.push({
      page: 'index.html',
      severity: 'warning',
      kind: 'language',
      message:
        'Search engines need full addresses in links to translations: set the site address in Project settings.'
    })
  return issues
}

// ---------- Writing ----------

/** The page with `lang` and its local hreflang links as they should be (unchanged if they are). */
export function updatedPage(analysis: Analysis, path: string, source: string): string {
  const code = analysis.codeOf.get(path)!
  const update = needsUpdate(analysis, path)
  // Only <html> and <head> change: parse that far (offsets match, the slice starts at 0).
  const headEnd = source.search(/<\/head\s*>/i)
  const document = parseWithLocations(
    headEnd >= 0 ? source.slice(0, source.indexOf('>', headEnd) + 1) : source
  )
  const html = find(document, (e) => e.tagName === 'html')
  const head = html && find(html, (e) => e.tagName === 'head')
  const patches: Patch[] = []
  if (update.lang && html?.sourceCodeLocation?.startTag) {
    patches.push(...attrPatches(source, html, { lang: code }))
  }
  if (update.links && head) {
    const lines = expectedAlternates(analysis, path).map(
      (a) =>
        `<link rel="alternate" hreflang="${escapeAttr(a.hreflang)}" href="${escapeAttr(a.href)}">`
    )
    const old: Element[] = []
    walk(head, (element) => {
      if (
        element.tagName === 'link' &&
        isAlternate(element) &&
        element.sourceCodeLocation &&
        isLocal(analysis, path, {
          hreflang: attr(element, 'hreflang')!,
          href: attr(element, 'href')!
        })
      )
        old.push(element)
    })
    old.forEach((element, index) => {
      const { startOffset, endOffset } = element.sourceCodeLocation!
      const lineStart = source.lastIndexOf('\n', startOffset - 1) + 1
      const ownLine = /^[ \t]*$/.test(source.slice(lineStart, startOffset))
      let end = endOffset
      if (ownLine) {
        if (source[end] === '\r') end++
        if (source[end] === '\n') end++
      }
      // The new links go where the first old one was.
      const indent = indentAt(source, startOffset)
      const text =
        index > 0 || !lines.length
          ? ''
          : ownLine
            ? lines.map((line) => `${indent}${line}\n`).join('')
            : lines.join('')
      patches.push({ start: ownLine ? lineStart : startOffset, end, text })
    })
    if (!old.length && lines.length) patches.push(headInsertPatch(source, head, lines))
  }
  const patched = patches.length ? applyPatches(source, patches) : source
  return fillSwitchers(patched, analysis.site, code, switcherLinks(analysis, path))
}

// ---------- The language switcher's links ----------

/** A language's home page, if the site has one. */
const homeOf = (analysis: Analysis, language: SiteLanguage): string | null => {
  const path = `${language.path}index.html`
  return analysis.codeOf.has(path) ? path : null
}

/**
 * Where a page's switcher points: its own version in each language, or that language's
 * home page when it has none (languages with neither are left out).
 */
export function switcherLinks(analysis: Analysis, path: string): Map<string, string> {
  const group = analysis.groupOf.get(path)
  const links = new Map<string, string>()
  for (const language of analysis.languages) {
    const page = group?.pages[language.code] ?? homeOf(analysis, language)
    if (page) links.set(language.code, urlOfPage(page))
  }
  return links
}

/** For placing a switcher on any page (layout and blog pages too): its language and links. */
export function switcherTarget(
  analysis: Analysis
): (path: string) => { code: string; links: Map<string, string> } {
  return (path) => ({
    code:
      analysis.codeOf.get(path) ??
      languageOfPath(path, analysis.languages)?.code ??
      rootLanguage(analysis.languages)?.code ??
      '',
    links: switcherLinks(analysis, path)
  })
}

const switcherCache = new Map<string, { mtimeMs: number; size: number; source: string | null }>()

/** The page's text when it has a switcher (cached by file stamp), else null. */
async function withSwitcher(root: string, path: string): Promise<string | null> {
  const full = join(root, path)
  const info = await stat(full)
  const key = `${root}\0${path}`
  const cached = switcherCache.get(key)
  if (cached && cached.mtimeMs === info.mtimeMs && cached.size === info.size) return cached.source
  const text = await readFile(full, 'utf8')
  const source = text.includes(SWITCHER_ATTR) ? text : null
  switcherCache.set(key, { mtimeMs: info.mtimeMs, size: info.size, source })
  return source
}

/** Pages whose switcher doesn't point where it should (a version or a language home changed). */
async function staleSwitchers(root: string, analysis: Analysis): Promise<Set<string>> {
  const stale = new Set<string>()
  for (const path of analysis.pages) {
    const source = await withSwitcher(root, path).catch(() => null)
    if (!source) continue
    const code = analysis.codeOf.get(path)!
    if (fillSwitchers(source, analysis.site, code, switcherLinks(analysis, path)) !== source)
      stale.add(path)
  }
  return stale
}

/** Brings `lang` and the links between translations up to date, in one revertable save. */
export async function updateLanguagePages(root: string): Promise<LanguagesUpdate> {
  const site = await getSiteSettings(root)
  if (!site.languages.length) return { changed: [], skipped: [], historyId: null }
  const analysis = await analyze(root, site)
  const stale = await staleSwitchers(root, analysis)
  const writes: FileWrite[] = []
  const skipped: string[] = []
  for (const path of analysis.pages) {
    const update = needsUpdate(analysis, path)
    if (!update.lang && !update.links && !stale.has(path)) continue
    // A page with unsaved edits is updated after Save all, so its edits stay valid.
    if (hasDraft(path)) {
      skipped.push(path)
      continue
    }
    const source = await readFile(join(root, path), 'utf8')
    const next = updatedPage(analysis, path, source)
    if (next !== source) writes.push({ path, content: next })
  }
  const historyId = writes.length
    ? await writeFiles(
        root,
        await withFlags(root, analysis.site, writes),
        'Languages: links between translations'
      )
    : null
  return { changed: writes.map((write) => write.path), skipped, historyId }
}
