import { mkdir, readFile, rename } from 'fs/promises'
import { join } from 'path'
import { readTemplates, saveTemplates } from './blog'
import {
  finishPage,
  pageSiteNodes,
  relocate,
  latestCardHtml,
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
  COVER_ALT_META,
  COVER_META,
  SHARE_FOCUS_META,
  SOCIAL_META,
  TRANSLATION_META,
  EXCERPT_META,
  TITLE_META,
  DESCRIPTION_META,
  FORMER_URL_META,
  POST_META,
  STATUS_META,
  draftFile,
  excerptOf,
  isLive,
  readPosts,
  type StoredPost
} from './posts'
import { APP_DIR, getSiteSettings, saveSiteSettings } from './settings'
import { isPublished, pagePattern } from './deploy/exclude'
import { listFiles, resolveInWorkspace } from './workspace'
import { sizeBodyImages } from './media'
import { SocialImages, focusOf, type SocialImage } from './social-image'
import { fillSwitchers, withFlags } from './language-switcher'
import { applyPatches, escapeAttr, escapeText, parseWithLocations, type Patch } from './html/dom'
import { pageComponents } from './html/components'
import {
  folderLanguage,
  languageOfPath,
  postGroup,
  rootLanguage,
  siteForLanguage
} from '../shared/languages'
import { fileOfPath, listPath, postPath, slugify } from '../shared/blog-urls'
import type {
  GenerateResult,
  ListLayout,
  PostLayout,
  PostRecord,
  SiteSettings,
  SwitcherLinks,
  BlogTemplates
} from '../shared/types'
import blocksCss from './blog-blocks.css?raw'
import lightboxJs from './blog-lightbox.js?raw'
import codeJs from './blog-code.js?raw'
import codeCss from '../shared/code-block.css?raw'

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
export const CODE_JS = 'assets/craftpages-code.js'
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

export const categoryUrl = (site: SiteSettings, category: string, page = 1): string =>
  listPath(`${listPath(site.blog.listPath)}category/${slugify(category)}/`, page)

const urlOfFile = (path: string): string => '/' + path.replace(/index\.html$/, '')

/** A page's addresses: /blog.html, and /blog as servers with clean URLs serve it. */
const addressesOf = (path: string): string[] => {
  const url = urlOfFile(path)
  return url.endsWith('.html') ? [url, url.slice(0, -'.html'.length)] : [url]
}

/**
 * The layout pages (the sample post and list the blog is built from) are the blog's
 * templates, not pages of the site: once the blog replaces them they come off the site
 * (once; switching one back on is respected), and while they're off, links and old
 * addresses lead to the blog. The home page is never taken off.
 */
async function retireLayouts(
  root: string,
  site: SiteSettings,
  templates: BlogTemplates | null,
  layouts: Layouts
): Promise<string[]> {
  const pages = [...new Set([layouts.post, layouts.list])].filter((path) => path !== 'index.html')
  const done = templates?.unpublished ?? []
  const fresh = pages.filter((path) => !done.includes(path))
  if (fresh.length) {
    const patterns = fresh.filter((path) => isPublished(site, path)).map(pagePattern)
    if (patterns.length) {
      site.deploy.exclude = [...site.deploy.exclude, ...patterns]
      await saveSiteSettings(root, { deploy: { exclude: site.deploy.exclude } })
    }
    await saveTemplates(root, { unpublished: [...done, ...fresh] })
  }
  return pages.filter((path) => !isPublished(site, path))
}

interface Moved {
  from: string
  to: string
}

/**
 * A layout page sitting exactly where the blog writes (blog/index.html as the list layout
 * with the blog at /blog/, or a sample post at a post's address) moves aside, next to where
 * it was: the blog takes the address, and the layout stays a page in Pages (same folder, so
 * its relative links still work). Its deploy exclusion and "taken off" record follow it.
 */
async function moveLayoutsAside(root: string, change: BlogChange, now: number): Promise<Moved[]> {
  const templates = await readTemplates(root)
  if (!templates?.post || !templates.list) return []
  const site = await getSiteSettings(root)
  const records = (await readPosts(root))
    .map((post) => post.record)
    .filter((post) => post.id !== change.remove && post.id !== change.upsert?.id)
  if (change.upsert) records.push(change.upsert)
  // Every language's blog address and posts (a layout can sit in any of them).
  const taken = new Set([
    ...[{ code: '' }, ...site.languages].map((language) =>
      fileOfPath(listPath(siteForLanguage(site, language.code).blog.listPath))
    ),
    ...records
      .filter((post) => isLive(post, now))
      .map((post) =>
        fileOfPath(postPath(siteForLanguage(site, post.lang).blog.permalink, post.slug))
      )
  ])
  const moved: Moved[] = []
  const update: BlogTemplates = {}
  for (const kind of ['list', 'post'] as const) {
    const from = templates[kind]!
    if (!taken.has(from) || moved.some((m) => m.from === from)) continue
    const source = await readSite(root, from)
    // Already the blog's own page (an earlier run moved the layout): nothing to move.
    if (source === null || source.includes(GENERATOR)) continue
    if (hasDraft(from)) {
      throw new Error(
        `The blog needs ${from} for its own page, so the layout moves next to it. Save or discard the edits open in ${from} first.`
      )
    }
    const dir = from.includes('/') ? from.slice(0, from.lastIndexOf('/') + 1) : ''
    let to = `${dir}${kind}-layout.html`
    for (let n = 2; (await readSite(root, to)) !== null; n++) to = `${dir}${kind}-layout-${n}.html`
    moved.push({ from, to })
    // Same content at the new path: the pointed-at parts still apply.
    if (kind === 'list') Object.assign(update, { list: to, listLayout: templates.listLayout })
    else Object.assign(update, { post: to, postLayout: templates.postLayout })
  }
  if (!moved.length) return []

  const writes: FileWrite[] = []
  for (const { from, to } of moved) {
    writes.push({ path: to, content: (await readSite(root, from))! }, { path: from, content: null })
  }
  await writeFiles(root, writes, 'Blog: move the layout pages aside')
  const rename = (path: string): string => moved.find((m) => m.from === path)?.to ?? path
  if (templates.unpublished?.length) update.unpublished = templates.unpublished.map(rename)
  await saveTemplates(root, update)
  // An exclusion added when the layout was taken off the site would now hide the blog's page.
  const patterns = new Map(moved.map((m) => [pagePattern(m.from), pagePattern(m.to)]))
  if (site.deploy.exclude.some((pattern) => patterns.has(pattern))) {
    await saveSiteSettings(root, {
      deploy: { exclude: site.deploy.exclude.map((pattern) => patterns.get(pattern) ?? pattern) }
    })
  }
  return moved
}

/** Post data the renderer needs, from a post. Block comments stay in the body. */
export function toPostData(post: PostRecord, site: SiteSettings): PostData {
  return {
    title: post.title,
    html: post.content,
    excerpt: post.excerpt.trim() || excerptOf(post.content),
    date: post.date,
    image: post.cover,
    url: postPath(site.blog.permalink, post.slug),
    tags: (post.tags ?? []).map((name) => ({ name, url: tagUrl(site, name) })),
    category: post.category?.trim()
      ? { name: post.category.trim(), url: categoryUrl(site, post.category.trim()) }
      : null,
    author: post.author?.trim() || undefined,
    description: post.seoDescription?.trim() || undefined
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

/** The head for a page with this body: scripts only for the blocks it uses. */
function sharedHead(site: SiteSettings, body = ''): string[] {
  return [
    GENERATOR,
    `<link rel="stylesheet" href="/${BLOCKS_CSS}">`,
    ...(/wp-block-gallery|cp-lightbox/.test(body)
      ? [`<script src="/${LIGHTBOX_JS}" defer></script>`]
      : []),
    ...(body.includes('cp-code--copy') ? [`<script src="/${CODE_JS}" defer></script>`] : []),
    `<link rel="alternate" type="application/rss+xml" title="${escapeText(site.siteName)}" href="${listPath(site.blog.listPath)}feed.xml">`
  ]
}

interface RenderContext {
  site: SiteSettings
  layouts: Layouts
  postSource: string
  context: PageContext
  homeNodes: Record<string, unknown>[]
  /** Links to layout pages that are off the site, to the blog (see retireLayouts). */
  linkAliases?: Record<string, string>
}

/** The post's share image: its own social image, else the cover, else the site's default. */
function shareSource(post: PostRecord, site: SiteSettings): string | null {
  return post.socialImage?.src || post.cover?.src || site.seo.defaultImage || null
}

/** A post's page, complete with everything needed to read it back as a post. */
function postPage(
  post: PostRecord,
  data: PostData,
  ctx: RenderContext,
  draft: boolean,
  social: SocialImage | null,
  formerUrls: string[] = [],
  /** hreflang links to the post's translations (rendered `<link>` tags). */
  alternates: string[] = []
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
  const image = social
    ? social.src.startsWith('/')
      ? absolute(site, social.src)
      : social.src
    : null
  const imageAlt = post.socialImage ? post.socialImage.alt : post.cover?.alt
  const metas = [
    `<meta name="${POST_META}" content="${escapeAttr(post.id)}">`,
    ...(draft ? [`<meta name="${STATUS_META}" content="${post.status}">`] : []),
    ...(draft
      ? formerUrls.map((url) => `<meta name="${FORMER_URL_META}" content="${escapeAttr(url)}">`)
      : []),
    ...(!post.excerpt.trim()
      ? [`<meta name="${EXCERPT_META}" content="auto">`]
      : data.description
        ? [`<meta name="${EXCERPT_META}" content="${escapeAttr(post.excerpt.trim())}">`]
        : []),
    ...(data.description ? [`<meta name="${DESCRIPTION_META}" content="custom">`] : []),
    `<meta name="${COVER_META}" content="${escapeAttr(post.cover?.src || 'none')}">`,
    ...(post.socialImage
      ? [`<meta name="${SOCIAL_META}" content="${escapeAttr(post.socialImage.src)}">`]
      : []),
    ...(focusOf(post.shareFocus)
      ? [`<meta name="${SHARE_FOCUS_META}" content="${focusOf(post.shareFocus)!.join(',')}">`]
      : []),
    ...(post.socialImage && post.cover?.alt
      ? [`<meta name="${COVER_ALT_META}" content="${escapeAttr(post.cover.alt)}">`]
      : []),
    ...(post.seoTitle?.trim() ? [`<meta name="${TITLE_META}" content="custom">`] : []),
    ...(post.translationOf
      ? [`<meta name="${TRANSLATION_META}" content="${escapeAttr(post.translationOf)}">`]
      : []),
    ...alternates,
    `<meta property="article:published_time" content="${escapeAttr(post.date)}">`,
    `<meta property="article:modified_time" content="${escapeAttr(post.modified)}">`,
    ...(data.tags ?? []).map(
      (tag) => `<meta property="article:tag" content="${escapeAttr(tag.name)}">`
    ),
    ...(data.category
      ? [`<meta property="article:section" content="${escapeAttr(data.category.name)}">`]
      : []),
    ...(data.author
      ? [`<meta property="article:author" content="${escapeAttr(data.author)}">`]
      : []),
    ...(image && social?.width && social.height
      ? [
          `<meta property="og:image:width" content="${social.width}">`,
          `<meta property="og:image:height" content="${social.height}">`
        ]
      : []),
    ...(image && imageAlt
      ? [`<meta property="og:image:alt" content="${escapeAttr(imageAlt)}">`]
      : [])
  ]
  let page = finishPage(html, {
    url: absolute(site, data.url),
    ogType: 'article',
    title,
    description: data.description || data.excerpt,
    image,
    jsonLd: {
      '@type': 'BlogPosting',
      headline: post.title,
      description: data.description || data.excerpt,
      datePublished: post.date,
      dateModified: post.modified,
      mainEntityOfPage: absolute(site, data.url),
      ...(image ? { image } : {}),
      ...(data.tags?.length ? { keywords: data.tags.map((t) => t.name).join(', ') } : {}),
      ...(data.category ? { articleSection: data.category.name } : {}),
      ...(data.author ? { author: { '@type': 'Person', name: data.author } } : {}),
      publisher: { '@type': 'Organization', name: site.siteName }
    },
    extraHead: [...sharedHead(site, post.content), ...metas],
    currentPath: listPath(site.blog.listPath),
    linkAliases: ctx.linkAliases,
    baseUrl: site.baseUrl,
    fallbackSiteNodes: ctx.homeNodes,
    lang: site.languages.length > 1 ? site.locale : undefined
  })
  // <title>: the post's own SEO title, or the title pattern (renderPost set it to the plain title).
  page = page.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeText(title)}</title>`)
  return page
}

/** One language's blog: its view of the site, its layouts and their sources. */
interface LanguageBlog {
  /** '' for the root language (and on a site in one language). */
  code: string
  site: SiteSettings
  ctx: RenderContext
  listSource: string
}

/** Parts a language swaps into the root layout: its own header, footer and navigation. */
const SWAPPED = new Set(['header', 'footer', 'nav'])

/**
 * The root layout dressed for another language: its header, footer and nav replaced by that
 * language's (from one of its pages), so a post in English gets the English menu. Addresses
 * in both are made root-absolute first, so the swapped parts work from any folder. The
 * article and list areas the layout points at are left where they are.
 */
export function languageLayout(
  source: string,
  path: string,
  reference: string,
  referencePath: string
): string {
  const base = relocate(source, path)
  const theirs = relocate(reference, referencePath)
  const replacements = pageComponents(parseWithLocations(theirs))
  const patches: Patch[] = []
  let covered = -1
  for (const [signature, element] of pageComponents(parseWithLocations(base))) {
    const location = element.sourceCodeLocation
    const other = replacements.get(signature)?.sourceCodeLocation
    if (!SWAPPED.has(element.tagName) || !location || !other) continue
    // A nav inside a swapped header goes with it.
    if (location.startOffset < covered) continue
    patches.push({
      start: location.startOffset,
      end: location.endOffset,
      text: theirs.slice(other.startOffset, other.endOffset)
    })
    covered = location.endOffset
  }
  return applyPatches(
    base,
    patches.sort((a, b) => a.start - b.start)
  )
}

/**
 * The blogs to write: the root one, and on a site with languages one per other language.
 * A language's layout is its own copy of the layout page when it has one (the same path in
 * its folder), else the root layout with its header, footer and nav.
 */
async function languageBlogs(
  root: string,
  ctx: RenderContext,
  listSource: string
): Promise<Map<string, LanguageBlog>> {
  const blogs = new Map<string, LanguageBlog>([['', { code: '', site: ctx.site, ctx, listSource }]])
  const { site } = ctx
  if (site.languages.length < 2) return blogs
  const pages = (await listFiles(root)).map((file) => file.path).filter((p) => /\.html?$/.test(p))
  for (const language of site.languages) {
    if (!language.path) continue
    const reference =
      pages.find((p) => p === `${language.path}index.html`) ??
      pages.find((p) => p.startsWith(language.path))
    const referenceSource = reference ? await readSite(root, reference) : null
    const layoutFor = async (
      path: string,
      source: string
    ): Promise<{ path: string; source: string }> => {
      const own = await readSite(root, language.path + path)
      if (own !== null && !own.includes(GENERATOR))
        return { path: language.path + path, source: own }
      return {
        path,
        source:
          reference && referenceSource
            ? languageLayout(source, path, referenceSource, reference)
            : source
      }
    }
    const post = await layoutFor(ctx.layouts.post, ctx.postSource)
    const list = await layoutFor(ctx.layouts.list, listSource)
    const own = siteForLanguage(site, language.code)
    blogs.set(language.code, {
      code: language.code,
      site: own,
      listSource: list.source,
      ctx: {
        site: own,
        layouts: { ...ctx.layouts, post: post.path, list: list.path },
        postSource: post.source,
        context: { baseUrl: site.baseUrl, locale: language.code, emptyText: site.blog.emptyText },
        homeNodes: referenceSource ? pageSiteNodes(referenceSource) : ctx.homeNodes,
        linkAliases: ctx.linkAliases
      }
    })
  }
  return blogs
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
    context: { baseUrl: site.baseUrl, locale: site.locale, emptyText: site.blog.emptyText },
    homeNodes: pageSiteNodes((await readSite(root, 'index.html')) ?? '')
  }
}

/** A post rendered as it would be published (for the editor's preview). */
export async function buildPostPage(root: string, post: PostRecord): Promise<string> {
  const ctx = await renderContext(root)
  const listSource = (await readSite(root, ctx.layouts.list)) ?? ''
  const blogs = await languageBlogs(root, ctx, listSource)
  const blog =
    blogs.get(folderLanguage(ctx.site.languages, post.lang)?.code ?? '') ?? blogs.get('')!
  const social = await new SocialImages(root, ctx.site, true).resolve(
    shareSource(post, ctx.site),
    post.shareFocus
  )
  const data = toPostData(post, blog.site)
  data.html = await sizeBodyImages(root, data.html, fileOfPath(data.url), ctx.site)
  return postPage(post, data, blog.ctx, false, social)
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

const escapeRegex = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * The same redirects for Apache, in a managed block of .htaccess (servers ignore
 * _redirects; Cloudflare never receives dot-files, so the two never meet). RedirectMatch,
 * not Redirect: Redirect matches by prefix, so /blog/a/ would also catch /blog/a-b/x.
 * A folder address also matches its index.html. Returns null when nothing changes.
 */
export function writeHtaccess(
  current: string | null,
  redirects: Record<string, string>
): string | null {
  const lines = Object.entries(redirects).map(([from, to]) => {
    const pattern = from.endsWith('/')
      ? `${escapeRegex(from.slice(0, -1))}(/|/index\\.html)?`
      : escapeRegex(from)
    return `  RedirectMatch 301 ^${pattern}$ ${to}`
  })
  const block = lines.length
    ? `${REDIRECTS_START}\n<IfModule mod_alias.c>\n${lines.join('\n')}\n</IfModule>\n${REDIRECTS_END}\n`
    : ''
  const text = current ?? ''
  const start = text.indexOf(REDIRECTS_START)
  const end = text.indexOf(REDIRECTS_END)
  let next: string
  if (start >= 0 && end > start) {
    const after = text.slice(end + REDIRECTS_END.length).replace(block ? /^\n/ : /^\n+/, '')
    next = text.slice(0, start) + block + after
  } else if (!block) {
    return null
  } else {
    // First, before the site's own rules (an old URL must not be rewritten elsewhere first).
    next = block + (text ? '\n' + text : '')
  }
  return next === text ? null : next
}

/**
 * Mirrors the blog's redirects from _redirects into .htaccess. Done for server deploys,
 * and whenever .htaccess already has the block, so switching targets keeps both in step.
 */
async function htaccessWrite(
  root: string,
  site: SiteSettings,
  redirects: Record<string, string>
): Promise<FileWrite | null> {
  const current = await readSite(root, '.htaccess')
  if (site.deploy.target !== 'server' && !current?.includes(REDIRECTS_START)) return null
  const content = writeHtaccess(current, redirects)
  return content === null ? null : { path: '.htaccess', content }
}

/** Before a server publish: .htaccess gets the redirects already in _redirects. */
export async function syncHtaccess(root: string): Promise<void> {
  const redirects = readRedirects(await readSite(root, '_redirects'))
  const write = await htaccessWrite(root, await getSiteSettings(root), redirects)
  if (write) await writeFiles(root, [write], 'Blog: redirects for the server')
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
  const moved = await moveLayoutsAside(root, change, now)
  const ctx = await renderContext(root)
  const { site, layouts } = ctx
  const templates = await readTemplates(root)
  const listSource = await readSite(root, layouts.list)
  if (listSource === null) throw new Error(`The list layout page ${layouts.list} is missing.`)
  const blogHome = listPath(site.blog.listPath)
  const retired = await retireLayouts(root, site, templates, layouts)
  const linkAliases = Object.fromEntries(
    retired.flatMap((path) =>
      addressesOf(path).map((url) => [url.replace(/([^/])$/, '$1/'), blogHome])
    )
  )
  ctx.linkAliases = linkAliases

  const stored = await readPosts(root)
  const byId = new Map<string, StoredPost>(stored.map((post) => [post.record.id, post]))
  const records = stored
    .map((post) => post.record)
    .filter((post) => post.id !== change.remove && post.id !== change.upsert?.id)
  if (change.upsert) records.push(change.upsert)
  records.sort((a, b) => b.date.localeCompare(a.date))
  const live = records.filter((post) => isLive(post, now))

  // One spelling per tag (and category) across the blog: the most used, ties to the earliest post.
  const spellingsOf = (namesOf: (post: PostRecord) => string[]): ((name: string) => string) => {
    const spellings = new Map<string, Map<string, number>>()
    for (const post of [...live].reverse()) {
      for (const name of namesOf(post)) {
        const counts = spellings.get(slugify(name)) ?? new Map<string, number>()
        counts.set(name, (counts.get(name) ?? 0) + 1)
        spellings.set(slugify(name), counts)
      }
    }
    return (name) =>
      [...(spellings.get(slugify(name)) ?? new Map([[name, 1]]))].reduce((best, entry) =>
        entry[1] > best[1] ? entry : best
      )[0]
  }
  const canonical = spellingsOf((post) => post.tags ?? [])
  const canonicalCategory = spellingsOf((post) =>
    post.category?.trim() ? [post.category.trim()] : []
  )
  // One blog per language: the root one, and one in each other language that has posts.
  const blogs = await languageBlogs(root, ctx, listSource)
  const multi = site.languages.length > 1
  const rootCode = rootLanguage(site.languages)?.code ?? ''
  const blogOf = (post: PostRecord): LanguageBlog =>
    blogs.get(folderLanguage(site.languages, post.lang)?.code ?? '') ?? blogs.get('')!

  const dataOf = (post: PostRecord): PostData => {
    const data = toPostData(post, blogOf(post).site)
    const seen = new Set<string>()
    data.tags = (data.tags ?? [])
      .map((tag) => ({ ...tag, name: canonical(tag.name) }))
      .filter((tag) => !seen.has(tag.url) && Boolean(seen.add(tag.url)))
    if (data.category)
      data.category = { ...data.category, name: canonicalCategory(data.category.name) }
    return data
  }

  // Posts that translate each other link to each other (hreflang), and to the root one as x-default.
  const languageOrder = (code: string): number =>
    site.languages.findIndex((language) => language.code === code)
  const alternateLines = (members: { code: string; url: string }[]): string[] => {
    if (!multi || members.length < 2) return []
    const sorted = [...members].sort((a, b) => languageOrder(a.code) - languageOrder(b.code))
    const fallback = sorted.find((member) => member.code === rootCode)
    return [...sorted, ...(fallback ? [{ code: 'x-default', url: fallback.url }] : [])].map(
      (member) =>
        `<link rel="alternate" hreflang="${escapeAttr(member.code)}" href="${escapeAttr(absolute(site, member.url))}">`
    )
  }
  const translations = new Map<string, { code: string; url: string }[]>()
  if (multi) {
    for (const post of live) {
      const blog = blogOf(post)
      const members = translations.get(postGroup(post)) ?? []
      // One per language: the first (newest) wins.
      if (members.some((member) => member.code === (blog.code || rootCode))) continue
      members.push({
        code: blog.code || rootCode,
        url: postPath(blog.site.blog.permalink, post.slug)
      })
      translations.set(postGroup(post), members)
    }
  }

  // Language switchers on blog pages: a post's own translations (a list: the same list in
  // the other blogs), else, as a stand-in, each language's blog (when it has posts) or its
  // home page.
  const withPosts = new Set(live.map((post) => blogOf(post).code))
  const switcherLinks = (members?: { code: string; url: string }[]): SwitcherLinks =>
    new Map(
      site.languages.map((language) => {
        const code = language.path ? language.code : ''
        const blog = blogs.get(code)
        const fallback =
          blog && (!code || withPosts.has(code))
            ? listPath(blog.site.blog.listPath)
            : '/' + language.path
        const own = members?.find((m) => m.code === language.code)?.url
        return [language.code, { url: own ?? fallback, exact: Boolean(own) }]
      })
    )
  const withSwitcher = (
    html: string,
    blog: LanguageBlog,
    members?: { code: string; url: string }[]
  ): string =>
    multi ? fillSwitchers(html, site, blog.code || rootCode, switcherLinks(members)) : html

  const outputs = new Map<string, string>()
  const blogUrls: string[] = []
  const redirects = readRedirects(await readSite(root, '_redirects'))
  const deletions = new Set<string>()
  for (const path of [layouts.post, layouts.list]) {
    // Not /blog when the blog is /blog/: servers already add the slash, and a rule would loop.
    for (const url of addressesOf(path).filter((url) => url + '/' !== blogHome)) {
      if (retired.includes(path)) redirects[url] = blogHome
      else if (redirects[url] === blogHome) delete redirects[url]
    }
  }

  // Posts: live ones on the site, the rest as drafts.
  const datas = new Map<string, PostData[]>([...blogs.keys()].map((code) => [code, []]))
  const socials = new SocialImages(root, site)
  const siteFiles = new Map((await listFiles(root)).map((file) => [file.path, file]))
  for (const post of records) {
    const blog = blogOf(post)
    const data = dataOf(post)
    data.html = await sizeBodyImages(root, data.html, fileOfPath(data.url), site, siteFiles)
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
    const social = await socials.resolve(shareSource(post, site), post.shareFocus)
    const alternates = isOn ? alternateLines(translations.get(postGroup(post)) ?? []) : []
    outputs.set(
      target,
      withSwitcher(
        postPage(post, data, blog.ctx, !isOn, social, [...new Set(former)], alternates),
        blog,
        isOn ? translations.get(postGroup(post)) : undefined
      )
    )
    if (isOn) {
      datas.get(blog.code)!.push(data)
      blogUrls.push(data.url)
    }
    if (before && before.file !== target && !before.legacy) {
      deletions.add(before.file)
      // Its old address keeps working: to the new one, or to the list while it's off the site.
      if (before.live)
        redirects[urlOfFile(before.file)] = isOn ? data.url : listPath(blog.site.blog.listPath)
    }
  }
  if (change.remove) {
    const gone = byId.get(change.remove)
    if (gone && !gone.legacy) {
      deletions.add(gone.file)
      if (gone.live)
        redirects[urlOfFile(gone.file)] = listPath(blogOf(gone.record).site.blog.listPath)
    }
  }

  // Paginated lists: the main one and one per tag and category, in every language's blog.
  const perPage = site.blog.postsPerPage
  // A language's blog exists once it has a post; the root one always does.
  const listed = [...blogs.values()].filter((blog) => !blog.code || datas.get(blog.code)!.length)
  const homeMembers = listed.map((blog) => ({
    code: blog.code || rootCode,
    url: listPath(blog.site.blog.listPath)
  }))
  const homeAlternates = alternateLines(homeMembers)
  const addList = (
    blog: LanguageBlog,
    items: PostData[],
    urlOf: (page: number) => string,
    heading: string,
    alternates: string[] = [],
    // The lists that translate this one (the blogs' first pages), for the switcher.
    members?: { code: string; url: string }[]
  ): void => {
    const { site: own, ctx: blogCtx } = blog
    const total = Math.max(1, Math.ceil(items.length / perPage))
    for (let page = 1; page <= total; page++) {
      const url = urlOf(page)
      const html = renderList(
        blog.listSource,
        blogCtx.layouts.list,
        blogCtx.layouts.listLayout,
        items.slice((page - 1) * perPage, page * perPage),
        { page, total, urlOf, heading },
        blogCtx.context
      )
      const title = page > 1 ? `${heading} · page ${page}` : heading
      const withTitle = html.replace(
        /<title>[\s\S]*?<\/title>/i,
        `<title>${escapeText(titleOf(own, title))}</title>`
      )
      outputs.set(
        fileOfPath(url),
        withSwitcher(
          finishPage(withTitle, {
            url: absolute(own, url),
            ogType: 'website',
            title,
            image: own.seo.defaultImage ? absolute(own, own.seo.defaultImage) : null,
            description: `${own.siteName} · ${title}`,
            jsonLd: { '@type': 'CollectionPage', name: title, url: absolute(own, url) },
            extraHead: [...sharedHead(own), ...(page === 1 ? alternates : [])],
            currentPath: listPath(own.blog.listPath),
            linkAliases,
            baseUrl: own.baseUrl,
            fallbackSiteNodes: blogCtx.homeNodes,
            lang: multi ? own.locale : undefined
          }),
          blog,
          page === 1 ? members : undefined
        )
      )
      if (items.length) blogUrls.push(url)
    }
  }
  for (const blog of listed) {
    const own = blog.site
    const items = datas.get(blog.code)!
    addList(
      blog,
      items,
      (n) => listPath(own.blog.listPath, n),
      own.blog.title,
      homeAlternates,
      homeMembers
    )
    const tags = new Map<string, { name: string; posts: PostData[] }>()
    for (const data of items) {
      for (const tag of data.tags ?? []) {
        const entry = tags.get(tag.url) ?? { name: tag.name, posts: [] }
        entry.posts.push(data)
        tags.set(tag.url, entry)
      }
    }
    for (const { name, posts } of tags.values()) {
      addList(blog, posts, (n) => tagUrl(own, name, n), `${own.blog.title}: ${name}`)
    }
    const categories = new Map<string, { name: string; posts: PostData[] }>()
    for (const data of items) {
      if (!data.category) continue
      const entry = categories.get(data.category.url) ?? { name: data.category.name, posts: [] }
      entry.posts.push(data)
      categories.set(data.category.url, entry)
    }
    for (const { name, posts } of categories.values()) {
      addList(blog, posts, (n) => categoryUrl(own, name, n), `${own.blog.title}: ${name}`)
    }
    const feedUrl = `${listPath(own.blog.listPath)}feed.xml`
    outputs.set(feedUrl.replace(/^\//, ''), rss(own, items))
  }
  outputs.set(BLOCKS_CSS, `${blocksCss}\n${codeCss}`)
  outputs.set(LIGHTBOX_JS, lightboxJs)
  outputs.set(CODE_JS, codeJs)

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
  // Share crops: new ones go out with the posts; ones no post uses any more go.
  for (const write of socials.writes.values()) {
    writes.push(write)
    written.push(write.path)
  }
  for (const crop of socials.takeUnused()) deletions.add(crop)
  await socials.save()
  const removed: string[] = []
  for (const path of deletions) {
    if ((await read(path)) === null) continue
    writes.push({ path, content: null })
    if (!path.startsWith(APP_DIR)) removed.push(path)
  }

  // "Latest posts" blocks on the site's own pages, changed only inside their area.
  const kept: string[] = []
  const latestBlocks = templates?.latest ?? []
  let cardsSaved = false
  for (const latest of latestBlocks) {
    if (hasDraft(latest.page)) {
      kept.push(`${latest.page} (has unsaved edits; its latest posts update after you save)`)
      continue
    }
    const source = await readSite(root, latest.page)
    if (source === null) continue
    // Keep the card's design before the first rewrite: with no posts the area ends up empty.
    if (latest.card && !latest.card.html) {
      const html = latestCardHtml(source, latest)
      if (html) {
        latest.card = { ...latest.card, html }
        cardsSaved = true
      }
    }
    // A page shows the latest posts of its own language.
    const language = multi
      ? folderLanguage(site.languages, languageOfPath(latest.page, site.languages)?.code)
      : undefined
    const blog = blogs.get(language?.code ?? '') ?? blogs.get('')!
    const posts = datas.get(blog.code) ?? []
    const next = renderLatest(
      source,
      latest,
      posts.slice(0, Math.max(1, latest.count)),
      blog.ctx.context
    )
    if (next !== source) {
      writes.push({ path: latest.page, content: next })
      written.push(latest.page)
    }
  }
  if (cardsSaved) await saveTemplates(root, { latest: latestBlocks })

  const redirectsBefore = await readSite(root, '_redirects')
  const redirectsText = writeRedirects(redirectsBefore, redirects)
  if (redirectsText !== null && redirectsText !== redirectsBefore) {
    writes.push({ path: '_redirects', content: redirectsText })
    written.push('_redirects')
  }
  const htaccess = await htaccessWrite(root, site, redirects)
  if (htaccess) {
    writes.push(htaccess)
    written.push('.htaccess')
  }
  const sitemapBefore = await readSite(root, 'sitemap.xml')
  const sitemap = site.seo.sitemapAuto
    ? null // rebuilt from all pages after the writes
    : updateSitemap(sitemapBefore, site, owned.map(urlOfFile), blogUrls)
  if (sitemap !== null && sitemap !== sitemapBefore) {
    writes.push({ path: 'sitemap.xml', content: sitemap })
    written.push('sitemap.xml')
  }

  const historyId = writes.length
    ? await writeFiles(root, await withFlags(root, site, writes), 'Blog: publish')
    : null
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

  return {
    written,
    removed,
    redirects: Object.keys(redirects).length,
    historyId,
    kept,
    ...(moved.length ? { moved } : {})
  }
}
