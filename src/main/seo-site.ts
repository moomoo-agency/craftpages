import { readFile, stat } from 'fs/promises'
import { join, posix } from 'path'
import { parse } from 'parse5'
import { attr, find, textContent, walk, type Element } from './html/dom'
import { pageSiteNodes } from './blog-render'
import { writeFiles } from './history'
import { POST_META } from './posts'
import { getSiteSettings } from './settings'
import { listFiles } from './workspace'
import { isPublished } from './deploy/exclude'
import { identityScript } from '../shared/identity'
import type {
  SeoIssue,
  SeoReport,
  SiteIdentity,
  SiteSettings,
  SitemapStatus
} from '../shared/types'

/**
 * Site-wide SEO: the check panel (every page scanned for the usual problems),
 * the sitemap built from the pages themselves, robots.txt, and what the home
 * page says about the site (Organization / WebSite structured data).
 */

const OVERSIZED = 400 * 1024

interface PageInfo {
  path: string
  url: string
  html: string
  title: string
  description: string
  canonical: string
  robots: string
  ogImage: string
  lang: string
  h1: number
  ids: Set<string>
  links: string[]
  images: { src: string; alt: string | undefined; sized: boolean }[]
  isPost: boolean
}

/** Site path of a page file: about/index.html → /about/, contact.html → /contact */
export function urlOfPage(path: string): string {
  if (path === 'index.html') return '/'
  if (path.endsWith('/index.html')) return '/' + path.slice(0, -'index.html'.length)
  return '/' + path.replace(/\.html?$/, '')
}

function metaContent(head: Element | null, key: 'name' | 'property', value: string): string {
  const found =
    head && find(head, (e) => e.tagName === 'meta' && (attr(e, key) ?? '').toLowerCase() === value)
  return (found && attr(found, 'content')) ?? ''
}

async function readPages(root: string): Promise<PageInfo[]> {
  const pages: PageInfo[] = []
  for (const file of await listFiles(root)) {
    if (!file.path.endsWith('.html')) continue
    const html = await readFile(join(root, file.path), 'utf8')
    const document = parse(html)
    const head = find(document, (e) => e.tagName === 'head')
    const root_ = find(document, (e) => e.tagName === 'html')
    const titleTag = head && find(head, (e) => e.tagName === 'title')
    const canonical =
      head && find(head, (e) => e.tagName === 'link' && attr(e, 'rel') === 'canonical')
    const info: PageInfo = {
      path: file.path,
      url: urlOfPage(file.path),
      html,
      title: titleTag ? textContent(titleTag).trim() : '',
      description: metaContent(head, 'name', 'description'),
      canonical: (canonical && attr(canonical, 'href')) ?? '',
      robots: metaContent(head, 'name', 'robots'),
      ogImage: metaContent(head, 'property', 'og:image'),
      lang: (root_ && attr(root_, 'lang')) ?? '',
      h1: 0,
      ids: new Set(),
      links: [],
      images: [],
      isPost: html.includes(POST_META)
    }
    const body = find(document, (e) => e.tagName === 'body')
    walk(body ?? document, (element) => {
      if (element.tagName === 'template' || element.tagName === 'noscript') return false
      const id = attr(element, 'id')
      if (id) info.ids.add(id)
      if (element.tagName === 'h1') info.h1++
      if (element.tagName === 'a') {
        const href = attr(element, 'href')
        if (href) info.links.push(href)
      }
      if (element.tagName === 'img') {
        info.images.push({
          src: attr(element, 'src') ?? '',
          alt: attr(element, 'alt'),
          sized: Boolean(attr(element, 'width') && attr(element, 'height'))
        })
      }
      return true
    })
    pages.push(info)
  }
  return pages
}

/**
 * Where a link points inside the site: a file path (with the #fragment),
 * or null for external links, mailto: and the like.
 */
function resolveLink(
  href: string,
  fromPath: string,
  site: SiteSettings
): { path: string; hash: string } | null {
  let value = href.trim()
  if (!value || /^(mailto:|tel:|javascript:|data:)/i.test(value)) return null
  if (site.baseUrl && value.startsWith(site.baseUrl))
    value = value.slice(site.baseUrl.length) || '/'
  if (/^[a-z][a-z0-9+.-]*:|^\/\//i.test(value)) return null
  const [withoutHash, hash = ''] = value.split('#')
  const pathPart = withoutHash.split('?')[0]
  if (!pathPart) return { path: fromPath, hash } // same-page anchor
  const base = posix.dirname('/' + fromPath)
  const absolute = pathPart.startsWith('/') ? pathPart : posix.join(base, pathPart)
  return { path: decodeURI(posix.normalize(absolute)).replace(/^\/+/, ''), hash }
}

/** The file a site path is served from (Cloudflare Pages rules), or null. */
function fileFor(path: string, files: Set<string>): string | null {
  const clean = path.replace(/\/+$/, '')
  const candidates =
    path.endsWith('/') || !clean
      ? [`${clean ? clean + '/' : ''}index.html`]
      : [clean, `${clean}.html`, `${clean}/index.html`]
  return candidates.find((candidate) => files.has(candidate)) ?? null
}

export async function auditSite(root: string): Promise<SeoReport> {
  const site = await getSiteSettings(root)
  // Only what goes live: pages and files left out of publishing (layout pages, drafts) are
  // neither checked nor link targets, since a link to them is broken on the published site.
  const pages = (await readPages(root)).filter((page) => isPublished(site, page.path))
  const files = (await listFiles(root)).filter((file) => isPublished(site, file.path))
  const fileSet = new Set(files.map((file) => file.path))
  const sizes = new Map(files.map((file) => [file.path, file.bytes]))
  const byPath = new Map(pages.map((page) => [page.path, page]))
  const issues: SeoIssue[] = []
  const add = (issue: SeoIssue): void => {
    issues.push(issue)
  }

  const indexable = pages.filter(
    (page) => page.path !== '404.html' && !/noindex/i.test(page.robots)
  )
  const duplicates = (values: (page: PageInfo) => string): Map<string, string[]> => {
    const seen = new Map<string, string[]>()
    for (const page of indexable) {
      const value = values(page).trim().toLowerCase()
      if (!value) continue
      seen.set(value, [...(seen.get(value) ?? []), page.path])
    }
    return new Map([...seen].filter(([, list]) => list.length > 1))
  }
  const duplicateTitles = duplicates((page) => page.title)
  const duplicateDescriptions = duplicates((page) => page.description)

  const linkedFrom = new Map<string, Set<string>>()
  for (const page of pages) {
    const where = { page: page.path }
    const isIndexable = indexable.includes(page)

    if (!page.title) add({ ...where, severity: 'error', kind: 'title', message: 'No <title>.' })
    else if (page.title.length > 65)
      add({
        ...where,
        severity: 'warning',
        kind: 'title',
        message: `Title is long (${page.title.length} characters; aim for 30–60).`
      })
    else if (page.title.length < 15)
      add({
        ...where,
        severity: 'warning',
        kind: 'title',
        message: `Title is short (${page.title.length} characters).`
      })
    if (isIndexable && duplicateTitles.has(page.title.trim().toLowerCase())) {
      const others = duplicateTitles
        .get(page.title.trim().toLowerCase())!
        .filter((p) => p !== page.path)
      add({
        ...where,
        severity: 'warning',
        kind: 'title',
        message: `Same title as ${others.join(', ')}.`
      })
    }

    if (isIndexable) {
      if (!page.description)
        add({ ...where, severity: 'error', kind: 'description', message: 'No meta description.' })
      else if (page.description.length > 160)
        add({
          ...where,
          severity: 'warning',
          kind: 'description',
          message: `Description is long (${page.description.length} characters; aim for 70–160).`
        })
      else if (page.description.length < 50)
        add({
          ...where,
          severity: 'warning',
          kind: 'description',
          message: `Description is short (${page.description.length} characters).`
        })
      if (duplicateDescriptions.has(page.description.trim().toLowerCase())) {
        const others = duplicateDescriptions
          .get(page.description.trim().toLowerCase())!
          .filter((p) => p !== page.path)
        add({
          ...where,
          severity: 'warning',
          kind: 'description',
          message: `Same description as ${others.join(', ')}.`
        })
      }
      if (page.h1 !== 1)
        add({
          ...where,
          severity: 'warning',
          kind: 'headings',
          message: page.h1 === 0 ? 'No H1 heading.' : `${page.h1} H1 headings (one is best).`
        })
      if (!page.canonical)
        add({ ...where, severity: 'info', kind: 'canonical', message: 'No canonical URL.' })
      else if (site.baseUrl && !page.canonical.startsWith(site.baseUrl))
        add({
          ...where,
          severity: 'warning',
          kind: 'canonical',
          message: `Canonical points elsewhere: ${page.canonical}`
        })
      if (!page.ogImage)
        add({
          ...where,
          severity: 'info',
          kind: 'social',
          message: 'No social image (og:image); shares show no picture.'
        })
    } else if (page.path !== '404.html') {
      add({
        ...where,
        severity: 'info',
        kind: 'indexing',
        message: 'Hidden from search (noindex).'
      })
    }
    if (!page.lang)
      add({
        ...where,
        severity: 'warning',
        kind: 'language',
        message: 'No lang attribute on <html>.'
      })

    const noAlt = page.images.filter((image) => image.alt === undefined)
    if (noAlt.length)
      add({
        ...where,
        severity: 'warning',
        kind: 'images',
        message: `${noAlt.length} image${noAlt.length === 1 ? '' : 's'} without alt text.`,
        detail: noAlt.map((i) => i.src).slice(0, 8)
      })
    const unsized = page.images.filter((image) => !image.sized)
    if (unsized.length)
      add({
        ...where,
        severity: 'info',
        kind: 'images',
        message: `${unsized.length} image${unsized.length === 1 ? '' : 's'} without width/height (layout shifts while loading).`,
        detail: unsized.map((i) => i.src).slice(0, 8)
      })
    const big = [
      ...new Set(
        page.images
          .map((i) => resolveLink(i.src, page.path, site)?.path)
          .filter((p): p is string => Boolean(p))
      )
    ].filter((path) => (sizes.get(path) ?? 0) > OVERSIZED)
    if (big.length)
      add({
        ...where,
        severity: 'warning',
        kind: 'images',
        message: `${big.length} large image${big.length === 1 ? '' : 's'} (over ${OVERSIZED / 1024} KB); optimise in Media.`,
        detail: big.map((p) => `${p} · ${Math.round((sizes.get(p) ?? 0) / 1024)} KB`)
      })

    // Links: broken files and missing #anchors.
    const broken: string[] = []
    const missingHere: string[] = []
    for (const href of page.links) {
      const target = resolveLink(href, page.path, site)
      if (!target) continue
      const file = target.path === page.path ? page.path : fileFor(target.path, fileSet)
      if (!file) {
        // Not a page: fine if it's a file of the site (PDF, image, feed…).
        if (!fileSet.has(target.path)) broken.push(href)
        continue
      }
      if (file !== page.path)
        linkedFrom.set(file, (linkedFrom.get(file) ?? new Set()).add(page.path))
      const targetPage = byPath.get(file)
      const hash = decodeURIComponent(target.hash)
      // "#top" always scrolls to the top (HTML spec), with or without such an id.
      if (!hash || hash.toLowerCase() === 'top' || !targetPage || targetPage.ids.has(hash)) continue
      if (file === page.path) {
        // A section of this very page that isn't there. Often a link copied from the home
        // page, where it worked because the section is there.
        const owner = pages.find((p) => p.path !== page.path && p.ids.has(hash))
        missingHere.push(owner ? `${href} → ${owner.url}${href}` : href)
      } else {
        broken.push(href)
      }
    }
    if (missingHere.length)
      add({
        ...where,
        severity: 'error',
        kind: 'links',
        message: `${missingHere.length} link${missingHere.length === 1 ? ' jumps' : 's jump'} to a section this page doesn’t have${
          missingHere.some((m) => m.includes('→'))
            ? '; they probably mean the page shown after the arrow'
            : ''
        }.`,
        detail: [...new Set(missingHere)].slice(0, 10)
      })
    if (broken.length)
      add({
        ...where,
        severity: 'error',
        kind: 'links',
        message: `${broken.length} broken link${broken.length === 1 ? '' : 's'}.`,
        detail: [...new Set(broken)].slice(0, 10)
      })
  }

  // Orphans: pages nothing links to (besides the home page and 404).
  const sitemap = (await readFile(join(root, 'sitemap.xml'), 'utf8').catch(() => '')) as string
  for (const page of indexable) {
    if (page.path === 'index.html' || linkedFrom.has(page.path)) continue
    const inSitemap =
      sitemap.includes(`${page.url}<`) || sitemap.includes(`${site.baseUrl}${page.url}<`)
    add({
      page: page.path,
      severity: inSitemap ? 'info' : 'warning',
      kind: 'links',
      message: inSitemap
        ? 'No page links here (only the sitemap does).'
        : 'No page links here and it isn’t in the sitemap.'
    })
  }

  const order = { error: 0, warning: 1, info: 2 }
  issues.sort((a, b) => order[a.severity] - order[b.severity] || a.page.localeCompare(b.page))
  return {
    pages: pages.length,
    issues,
    counts: {
      error: issues.filter((i) => i.severity === 'error').length,
      warning: issues.filter((i) => i.severity === 'warning').length,
      info: issues.filter((i) => i.severity === 'info').length
    }
  }
}

// ---------- Sitemap ----------

function excluded(path: string, patterns: string[]): boolean {
  return patterns
    .map((pattern) => pattern.trim())
    .filter(Boolean)
    .some((pattern) => {
      const regexp = new RegExp(
        '^' +
          pattern
            .replace(/^\/+/, '')
            .replace(/[.+^${}()|[\]\\]/g, '\\$&')
            .replace(/\*\*/g, '§')
            .replace(/\*/g, '[^/]*')
            .replace(/§/g, '.*') +
          '$'
      )
      return regexp.test(path) || regexp.test(urlOfPage(path).replace(/^\//, ''))
    })
}

/** sitemap.xml from every indexable page (not 404, not noindex, not excluded). */
export async function buildSitemap(root: string): Promise<{ xml: string; urls: number }> {
  const site = await getSiteSettings(root)
  const entries: string[] = []
  for (const page of await readPages(root)) {
    if (page.path === '404.html' || /noindex/i.test(page.robots)) continue
    if (excluded(page.path, site.seo.sitemapExclude) || !isPublished(site, page.path)) continue
    const modified = (await stat(join(root, page.path))).mtime.toISOString().slice(0, 10)
    const loc = (site.baseUrl || '') + page.url
    entries.push(
      `  <url><loc>${loc.replace(/&/g, '&amp;')}</loc><lastmod>${modified}</lastmod></url>`
    )
  }
  entries.sort()
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>
`
  return { xml, urls: entries.length }
}

/** Whether sitemap.xml exists, what it lists, and whether it matches the pages now. */
export async function sitemapStatus(root: string): Promise<SitemapStatus> {
  const file = join(root, 'sitemap.xml')
  const [current, info, built] = await Promise.all([
    readFile(file, 'utf8').catch(() => null),
    stat(file).catch(() => null),
    buildSitemap(root)
  ])
  return {
    exists: current !== null,
    urls: current === null ? 0 : (current.match(/<loc>/g) ?? []).length,
    modified: info ? info.mtime.toISOString() : null,
    pages: built.urls,
    upToDate: current === built.xml
  }
}

export async function writeSitemap(root: string): Promise<{ urls: number; changed: boolean }> {
  const { xml, urls } = await buildSitemap(root)
  const current = await readFile(join(root, 'sitemap.xml'), 'utf8').catch(() => null)
  if (current === xml) return { urls, changed: false }
  await writeFiles(root, [{ path: 'sitemap.xml', content: xml }], 'SEO: rebuild sitemap')
  return { urls, changed: true }
}

// ---------- robots.txt ----------

/** robots.txt as it is, or null when the site has none. */
export async function readRobots(root: string): Promise<string | null> {
  return readFile(join(root, 'robots.txt'), 'utf8').catch(() => null)
}

export async function saveRobots(root: string, text: string): Promise<void> {
  const clean = text.replace(/\r\n/g, '\n').replace(/\n*$/, '\n')
  await writeFiles(root, [{ path: 'robots.txt', content: clean }], 'SEO: robots.txt')
}

// ---------- Site identity (structured data on the home page) ----------

export async function siteIdentity(root: string): Promise<SiteIdentity> {
  const home = await readFile(join(root, 'index.html'), 'utf8').catch(() => '')
  const nodes = pageSiteNodes(home)
  // The JSON-LD scripts that describe the site, as they are in the file.
  const code = [
    ...home.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi)
  ]
    .map((match) => match[0])
    .filter((tag) => pageSiteNodes(tag).length > 0)
  const pick = (type: string): Record<string, unknown> | undefined =>
    nodes.find((node) => [node['@type']].flat().includes(type))
  const organization = pick('Organization') ?? pick('LocalBusiness') ?? pick('Corporation')
  const website = pick('WebSite')
  return {
    organization: organization
      ? {
          name: String(organization.name ?? ''),
          url: String(organization.url ?? ''),
          logo:
            typeof organization.logo === 'string'
              ? organization.logo
              : String((organization.logo as { url?: string })?.url ?? '')
        }
      : null,
    website: website ? { name: String(website.name ?? ''), url: String(website.url ?? '') } : null,
    code: code.length ? code.join('\n') : null
  }
}

/**
 * Adds Organization + WebSite structured data to the home page (only when it
 * has none), so search engines know the site's name and logo.
 */
export async function addSiteIdentity(
  root: string,
  identity: { name: string; url: string; logo: string }
): Promise<string> {
  const current = await siteIdentity(root)
  if (current.organization) throw new Error('The home page already describes the organisation.')
  const home = await readFile(join(root, 'index.html'), 'utf8')
  const headEnd = home.search(/<\/head>/i)
  if (headEnd < 0) throw new Error('index.html has no </head>.')
  const tag = identityScript(identity, !current.website)
  await writeFiles(
    root,
    [{ path: 'index.html', content: home.slice(0, headEnd) + tag + '\n' + home.slice(headEnd) }],
    'SEO: site identity'
  )
  return tag
}
