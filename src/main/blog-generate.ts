import { mkdir, readFile, rename } from 'fs/promises'
import { join } from 'path'
import { readTemplates } from './blog'
import {
  finishPage,
  pageSiteNodes,
  renderLatest,
  renderList,
  renderPost,
  type PageContext,
  type PostData
} from './blog-render'
import { hasDraft } from './drafts'
import { writeSitemap } from './seo-site'
import { writeFiles, type FileWrite } from './history'
import {
  COVER_META,
  EXCERPT_META,
  TITLE_META,
  FORMER_URL_META,
  POST_META,
  STATUS_META,
  draftFile,
  excerptOf,
  isLive,
  readPosts,
  type StoredPost
} from './posts'
import { APP_DIR, getSiteSettings } from './settings'
import { listFiles, resolveInWorkspace } from './workspace'
import { escapeAttr, escapeText } from './html/dom'
import { fileOfPath, listPath, postPath, slugify } from '../shared/blog-urls'
import type {
  GenerateResult,
  ListLayout,
  PostLayout,
  PostRecord,
  SiteSettings,
  BlogTemplates
} from '../shared/types'
import blocksCss from './blog-blocks.css?raw'
import lightboxJs from './blog-lightbox.js?raw'

/**
 * The blog is written from the pages themselves: every post is an HTML page
 * (on the site when live, in .sitecms/drafts otherwise), and this function
 * re-renders all of them into the current layouts, then the paginated list,
 * tag archives, the feed, "latest posts" blocks on other pages, blog URLs in
 * sitemap.xml and 301s for moved URLs in a managed block of _redirects.
 *
 * It keeps no state of its own. Which pages it owns is marked in the pages
 * (`<meta name="generator" content="CraftPages">`), and earlier redirects are
 * read back from `_redirects`. It never overwrites a page it didn't make.
 */

export const BLOCKS_CSS = 'assets/craftpages-blocks.css'
export const LIGHTBOX_JS = 'assets/craftpages-lightbox.js'
const GENERATOR = '<meta name="generator" content="CraftPages">'
const REDIRECTS_START = '# craftpages:blog start (managed by CraftPages, edits here are replaced)'
const REDIRECTS_END = '# craftpages:blog end'

async function readSite(root: string, path: string): Promise<string | null> {
  try {
    return await readFile(resolveInWorkspace(root, path), 'utf8')
  } catch {
    return null
  }
}

export const tagUrl = (site: SiteSettings, tag: string, page = 1): string =>
  listPath(`${listPath(site.blog.listPath)}tag/${slugify(tag)}/`, page)

const urlOfFile = (path: string): string => '/' + path.replace(/index\.html$/, '')

/** Post data the renderer needs, from a post. Block comments stay in the body. */
export function toPostData(post: PostRecord, site: SiteSettings): PostData {
  return {
    title: post.title,
    html: post.content,
    excerpt: post.excerpt.trim() || excerptOf(post.content),
    date: post.date,
    image: post.cover,
    url: postPath(site.blog.permalink, post.slug),
    tags: (post.tags ?? []).map((name) => ({ name, url: tagUrl(site, name) }))
  }
}

interface Layouts {
  post: string
  list: string
  postLayout: PostLayout
  listLayout: ListLayout
}

export function requireLayouts(templates: BlogTemplates | null): Layouts {
  if (!templates?.post || !templates.list || !templates.postLayout || !templates.listLayout) {
    throw new Error('Finish the blog setup first (layouts for posts and the list).')
  }
  return {
    post: templates.post,
    list: templates.list,
    postLayout: templates.postLayout,
    listLayout: templates.listLayout
  }
}

/** The site's title pattern: "%title% · %site%" → "My post · CraftForms". */
export function titleOf(site: SiteSettings, title: string): string {
  return site.seo.titlePattern.replace(/%title%/g, title).replace(/%site%/g, site.siteName)
}

function absolute(site: SiteSettings, path: string): string {
  return site.baseUrl ? site.baseUrl + path : path
}

function sharedHead(site: SiteSettings, withLightbox: boolean): string[] {
  return [
    GENERATOR,
    `<link rel="stylesheet" href="/${BLOCKS_CSS}">`,
    ...(withLightbox ? [`<script src="/${LIGHTBOX_JS}" defer></script>`] : []),
    `<link rel="alternate" type="application/rss+xml" title="${escapeText(site.siteName)}" href="${listPath(site.blog.listPath)}feed.xml">`
  ]
}

interface RenderContext {
  site: SiteSettings
  layouts: Layouts
  postSource: string
  context: PageContext
  homeNodes: Record<string, unknown>[]
}

/** A post's page, complete with everything needed to read it back as a post. */
function postPage(
  post: PostRecord,
  data: PostData,
  ctx: RenderContext,
  draft: boolean,
  formerUrls: string[] = []
): string {
  const { site } = ctx
  const html = renderPost(
    ctx.postSource,
    ctx.layouts.post,
    ctx.layouts.postLayout,
    data,
    ctx.context
  )
  const title = post.seoTitle?.trim() || titleOf(site, post.title)
  const fallbackImage = site.seo.defaultImage ? absolute(site, site.seo.defaultImage) : null
  const image = post.cover ? absolute(site, post.cover.src) : fallbackImage
  const metas = [
    `<meta name="${POST_META}" content="${escapeAttr(post.id)}">`,
    ...(draft ? [`<meta name="${STATUS_META}" content="${post.status}">`] : []),
    ...(draft
      ? formerUrls.map((url) => `<meta name="${FORMER_URL_META}" content="${escapeAttr(url)}">`)
      : []),
    ...(post.excerpt.trim() ? [] : [`<meta name="${EXCERPT_META}" content="auto">`]),
    ...(post.cover ? [] : [`<meta name="${COVER_META}" content="none">`]),
    ...(post.seoTitle?.trim() ? [`<meta name="${TITLE_META}" content="custom">`] : []),
    `<meta property="article:published_time" content="${escapeAttr(post.date)}">`,
    `<meta property="article:modified_time" content="${escapeAttr(post.modified)}">`,
    ...(data.tags ?? []).map(
      (tag) => `<meta property="article:tag" content="${escapeAttr(tag.name)}">`
    ),
    ...(post.cover?.alt
      ? [`<meta property="og:image:alt" content="${escapeAttr(post.cover.alt)}">`]
      : [])
  ]
  let page = finishPage(html, {
    url: absolute(site, data.url),
    ogType: 'article',
    title,
    description: data.excerpt,
    image,
    jsonLd: {
      '@type': 'BlogPosting',
      headline: post.title,
      description: data.excerpt,
      datePublished: post.date,
      dateModified: post.modified,
      mainEntityOfPage: absolute(site, data.url),
      ...(image ? { image } : {}),
      ...(data.tags?.length ? { keywords: data.tags.map((t) => t.name).join(', ') } : {}),
      publisher: { '@type': 'Organization', name: site.siteName }
    },
    extraHead: [...sharedHead(site, /wp-block-gallery|cp-lightbox/.test(post.content)), ...metas],
    currentPath: listPath(site.blog.listPath),
    baseUrl: site.baseUrl,
    fallbackSiteNodes: ctx.homeNodes
  })
  // <title>: the post's own SEO title, or the title pattern (renderPost set it to the plain title).
  page = page.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeText(title)}</title>`)
  return page
}

async function renderContext(root: string): Promise<RenderContext> {
  const site = await getSiteSettings(root)
  const layouts = requireLayouts(await readTemplates(root))
  const postSource = await readSite(root, layouts.post)
  if (postSource === null) throw new Error(`The post layout page ${layouts.post} is missing.`)
  return {
    site,
    layouts,
    postSource,
    context: { baseUrl: site.baseUrl, locale: site.locale },
    homeNodes: pageSiteNodes((await readSite(root, 'index.html')) ?? '')
  }
}

/** A post rendered as it would be published (for the editor's preview). */
export async function buildPostPage(root: string, post: PostRecord): Promise<string> {
  const ctx = await renderContext(root)
  return postPage(post, toPostData(post, ctx.site), ctx, false)
}

function rss(site: SiteSettings, posts: PostData[]): string {
  const channelLink = absolute(site, listPath(site.blog.listPath))
  const items = posts
    .slice(0, 20)
    .map(
      (post) => `    <item>
      <title>${escapeText(post.title)}</title>
      <link>${escapeText(absolute(site, post.url))}</link>
      <guid>${escapeText(absolute(site, post.url))}</guid>
      <pubDate>${new Date(post.date).toUTCString()}</pubDate>
${(post.tags ?? []).map((tag) => `      <category>${escapeText(tag.name)}</category>\n`).join('')}      <description>${escapeText(post.excerpt)}</description>
    </item>`
    )
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeText(`${site.blog.title} · ${site.siteName}`)}</title>
    <link>${escapeText(channelLink)}</link>
    <description>${escapeText(site.siteName)} ${escapeText(site.blog.title.toLowerCase())}</description>
    <language>${escapeText(site.locale)}</language>
${items}
  </channel>
</rss>
`
}

/** Replaces the blog's URLs in sitemap.xml: drops `previous`, adds `urls`. */
function updateSitemap(
  current: string | null,
  site: SiteSettings,
  previous: string[],
  urls: string[]
): string | null {
  const locs = urls.map((url) => absolute(site, url))
  const old = new Set([...previous, ...urls].map((url) => absolute(site, url)))
  if (current === null) {
    if (!locs.length) return null
    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${locs.map((loc) => `  <url><loc>${escapeText(loc)}</loc></url>`).join('\n')}
</urlset>
`
  }
  // Remove whole lines of blog entries (only their own line break, so re-adding is stable).
  let xml = current.replace(
    /[ \t]*<url>\s*<loc>([^<]+)<\/loc>[\s\S]*?<\/url>[ \t]*\n?/g,
    (block, loc: string) => (old.has(loc.trim().replace(/&amp;/g, '&')) ? '' : block)
  )
  const added = locs.map((loc) => `  <url><loc>${escapeText(loc)}</loc></url>\n`).join('')
  xml = xml.replace(/<\/urlset>/, `${added}</urlset>`)
  return xml
}

function readRedirects(text: string | null): Record<string, string> {
  const redirects: Record<string, string> = {}
  if (!text) return redirects
  const start = text.indexOf(REDIRECTS_START)
  const end = text.indexOf(REDIRECTS_END)
  if (start < 0 || end < start) return redirects
  for (const line of text.slice(start + REDIRECTS_START.length, end).split('\n')) {
    const [from, to] = line.trim().split(/\s+/)
    if (from?.startsWith('/') && to) redirects[from] = to
  }
  return redirects
}

function writeRedirects(current: string | null, redirects: Record<string, string>): string | null {
  const lines = Object.entries(redirects).map(([from, to]) => `${from} ${to} 301`)
  const block = lines.length ? `${REDIRECTS_START}\n${lines.join('\n')}\n${REDIRECTS_END}\n` : ''
  const text = current ?? ''
  const start = text.indexOf(REDIRECTS_START)
  const end = text.indexOf(REDIRECTS_END)
  if (start >= 0 && end > start) {
    const after = text.slice(end + REDIRECTS_END.length).replace(/^\n/, '')
    return text.slice(0, start) + block + after
  }
  if (!block) return current
  // Put ours first: Cloudflare applies the first matching rule.
  return block + (text ? '\n' + text : '')
}

/** Site pages the blog generator made (post, list and tag pages). */
async function ownedPages(root: string): Promise<string[]> {
  const owned: string[] = []
  for (const file of await listFiles(root)) {
    if (!file.path.endsWith('.html')) continue
    const html = (await readSite(root, file.path)) ?? ''
    if (html.includes(GENERATOR)) owned.push(file.path)
  }
  return owned
}

export async function generatedFiles(root: string): Promise<string[]> {
  return ownedPages(root)
}

/** Scheduled posts whose time has come but which aren't on the site yet. */
export async function duePosts(root: string, now = Date.now()): Promise<PostRecord[]> {
  return (await readPosts(root))
    .filter((post) => !post.live && isLive(post.record, now))
    .map((post) => post.record)
}

export interface BlogChange {
  /** Saved post (new or changed). */
  upsert?: PostRecord
  /** Post id to delete. */
  remove?: string
}

/** Re-renders the whole blog, applying one change. Writes nothing if nothing changed. */
export async function generateBlog(
  root: string,
  change: BlogChange = {},
  now = Date.now()
): Promise<GenerateResult> {
  const ctx = await renderContext(root)
  const { site, layouts, context } = ctx
  const templates = await readTemplates(root)
  const listSource = await readSite(root, layouts.list)
  if (listSource === null) throw new Error(`The list layout page ${layouts.list} is missing.`)

  const stored = await readPosts(root)
  const byId = new Map<string, StoredPost>(stored.map((post) => [post.record.id, post]))
  const records = stored
    .map((post) => post.record)
    .filter((post) => post.id !== change.remove && post.id !== change.upsert?.id)
  if (change.upsert) records.push(change.upsert)
  records.sort((a, b) => b.date.localeCompare(a.date))
  const live = records.filter((post) => isLive(post, now))

  // One spelling per tag across the blog: the most used, ties to the earliest post.
  const spellings = new Map<string, Map<string, number>>()
  for (const post of [...live].reverse()) {
    for (const tag of post.tags ?? []) {
      const counts = spellings.get(slugify(tag)) ?? new Map<string, number>()
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
      spellings.set(slugify(tag), counts)
    }
  }
  const canonical = (name: string): string =>
    [...(spellings.get(slugify(name)) ?? new Map([[name, 1]]))].reduce((best, entry) =>
      entry[1] > best[1] ? entry : best
    )[0]
  const dataOf = (post: PostRecord): PostData => {
    const data = toPostData(post, site)
    const seen = new Set<string>()
    data.tags = (data.tags ?? [])
      .map((tag) => ({ ...tag, name: canonical(tag.name) }))
      .filter((tag) => !seen.has(tag.url) && Boolean(seen.add(tag.url)))
    return data
  }

  const outputs = new Map<string, string>()
  const blogUrls: string[] = []
  const redirects = readRedirects(await readSite(root, '_redirects'))
  const deletions = new Set<string>()

  // Posts: live ones on the site, the rest as drafts.
  const datas: PostData[] = []
  for (const post of records) {
    const data = dataOf(post)
    const isOn = isLive(post, now)
    const target = isOn ? fileOfPath(data.url) : draftFile(post.id)
    const before = byId.get(post.id)
    // Addresses it had while live: remembered in its draft, redirected to it once it's back.
    const former = [...(before?.formerUrls ?? [])]
    if (before?.live && !isOn) {
      // Its address, and every older address that was redirecting to it.
      const url = urlOfFile(before.file)
      former.push(url, ...Object.keys(redirects).filter((from) => redirects[from] === url))
    }
    if (isOn) for (const url of former) if (url !== data.url) redirects[url] = data.url
    outputs.set(target, postPage(post, data, ctx, !isOn, [...new Set(former)]))
    if (isOn) {
      datas.push(data)
      blogUrls.push(data.url)
    }
    if (before && before.file !== target && !before.legacy) {
      deletions.add(before.file)
      // Its old address keeps working: to the new one, or to the list while it's off the site.
      if (before.live)
        redirects[urlOfFile(before.file)] = isOn ? data.url : listPath(site.blog.listPath)
    }
  }
  if (change.remove) {
    const gone = byId.get(change.remove)
    if (gone && !gone.legacy) {
      deletions.add(gone.file)
      if (gone.live) redirects[urlOfFile(gone.file)] = listPath(site.blog.listPath)
    }
  }

  // Paginated lists: the main one and one per tag.
  const perPage = site.blog.postsPerPage
  const addList = (items: PostData[], urlOf: (page: number) => string, heading: string): void => {
    const total = Math.max(1, Math.ceil(items.length / perPage))
    for (let page = 1; page <= total; page++) {
      const url = urlOf(page)
      const html = renderList(
        listSource,
        layouts.list,
        layouts.listLayout,
        items.slice((page - 1) * perPage, page * perPage),
        { page, total, urlOf, heading },
        context
      )
      const title = page > 1 ? `${heading} · page ${page}` : heading
      const withTitle = html.replace(
        /<title>[\s\S]*?<\/title>/i,
        `<title>${escapeText(titleOf(site, title))}</title>`
      )
      outputs.set(
        fileOfPath(url),
        finishPage(withTitle, {
          url: absolute(site, url),
          ogType: 'website',
          title,
          image: site.seo.defaultImage ? absolute(site, site.seo.defaultImage) : null,
          description: `${site.siteName} · ${title}`,
          jsonLd: { '@type': 'CollectionPage', name: title, url: absolute(site, url) },
          extraHead: sharedHead(site, false),
          currentPath: listPath(site.blog.listPath),
          baseUrl: site.baseUrl,
          fallbackSiteNodes: ctx.homeNodes
        })
      )
      if (items.length) blogUrls.push(url)
    }
  }
  addList(datas, (n) => listPath(site.blog.listPath, n), site.blog.title)
  const tags = new Map<string, { name: string; posts: PostData[] }>()
  for (const data of datas) {
    for (const tag of data.tags ?? []) {
      const entry = tags.get(tag.url) ?? { name: tag.name, posts: [] }
      entry.posts.push(data)
      tags.set(tag.url, entry)
    }
  }
  for (const { name, posts } of tags.values()) {
    addList(posts, (n) => tagUrl(site, name, n), `${site.blog.title}: ${name}`)
  }
  const feedUrl = `${listPath(site.blog.listPath)}feed.xml`
  outputs.set(feedUrl.replace(/^\//, ''), rss(site, datas))
  outputs.set(BLOCKS_CSS, blocksCss)
  outputs.set(LIGHTBOX_JS, lightboxJs)

  // Never overwrite a page someone else made (e.g. /privacy/ with a /%postname%/ permalink).
  const owned = await ownedPages(root)
  const ownedSet = new Set(owned)
  const conflicts: string[] = []
  for (const path of outputs.keys()) {
    if (!path.endsWith('.html') || path.startsWith(APP_DIR) || ownedSet.has(path)) continue
    if ((await readSite(root, path)) !== null) conflicts.push(path)
  }
  if (conflicts.length) {
    throw new Error(
      `These pages already exist and weren't made by the blog, so they won't be overwritten: ${conflicts.join(', ')}. Change the post slug, the tag or the URL pattern.`
    )
  }
  // Generated pages that are no longer produced (a tag nobody uses, page 3 of the list…).
  for (const path of owned) if (!outputs.has(path)) deletions.add(path)
  for (const path of outputs.keys()) deletions.delete(path)

  // A live URL must not redirect, and chains collapse to their end.
  for (const url of blogUrls) delete redirects[url]
  for (const from of Object.keys(redirects)) {
    let to = redirects[from]
    for (let hops = 0; redirects[to] && hops < 10; hops++) to = redirects[to]
    if (to === from) delete redirects[from]
    else redirects[from] = to
  }

  const writes: FileWrite[] = []
  const written: string[] = []
  const read = async (path: string): Promise<string | null> => {
    try {
      return await readFile(join(root, path), 'utf8')
    } catch {
      return null
    }
  }
  for (const [path, content] of outputs) {
    if ((await read(path)) !== content) {
      writes.push({ path, content })
      if (!path.startsWith(APP_DIR)) written.push(path)
    }
  }
  const removed: string[] = []
  for (const path of deletions) {
    if ((await read(path)) === null) continue
    writes.push({ path, content: null })
    if (!path.startsWith(APP_DIR)) removed.push(path)
  }

  // "Latest posts" blocks on the site's own pages, changed only inside their area.
  const kept: string[] = []
  for (const latest of templates?.latest ?? []) {
    if (hasDraft(latest.page)) {
      kept.push(`${latest.page} (has unsaved edits; its latest posts update after you save)`)
      continue
    }
    const source = await readSite(root, latest.page)
    if (source === null) continue
    const next = renderLatest(source, latest, datas.slice(0, Math.max(1, latest.count)), context)
    if (next !== source) {
      writes.push({ path: latest.page, content: next })
      written.push(latest.page)
    }
  }

  const redirectsBefore = await readSite(root, '_redirects')
  const redirectsText = writeRedirects(redirectsBefore, redirects)
  if (redirectsText !== null && redirectsText !== redirectsBefore) {
    writes.push({ path: '_redirects', content: redirectsText })
    written.push('_redirects')
  }
  const sitemapBefore = await readSite(root, 'sitemap.xml')
  const sitemap = site.seo.sitemapAuto
    ? null // rebuilt from all pages after the writes
    : updateSitemap(sitemapBefore, site, owned.map(urlOfFile), blogUrls)
  if (sitemap !== null && sitemap !== sitemapBefore) {
    writes.push({ path: 'sitemap.xml', content: sitemap })
    written.push('sitemap.xml')
  }

  const historyId = writes.length ? await writeFiles(root, writes, 'Blog: publish') : null
  // With an automatic sitemap, rebuild it from all pages now that the blog is written.
  if (site.seo.sitemapAuto && writes.length) {
    const { changed } = await writeSitemap(root)
    if (changed && !written.includes('sitemap.xml')) written.push('sitemap.xml')
  }

  // Posts from before posts were HTML are now pages; keep the old files in the trash.
  for (const post of stored) {
    if (!post.legacy) continue
    await mkdir(join(root, APP_DIR, 'trash', 'posts'), { recursive: true })
    await rename(
      join(root, post.file),
      join(root, APP_DIR, 'trash', 'posts', post.file.split('/').pop()!)
    ).catch(() => {})
  }

  return { written, removed, redirects: Object.keys(redirects).length, historyId, kept }
}
