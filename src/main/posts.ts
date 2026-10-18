import { randomBytes } from 'crypto'
import { readdir, readFile } from 'fs/promises'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { parse } from 'parse5'
import { attr, find, textContent, walk, type Element } from './html/dom'
import { APP_DIR, getSiteSettings } from './settings'
import { focusOf } from './social-image'
import { DRAFTS_DIR, listFiles } from './workspace'
import { isValidSlug, listPath, postPath, postPrefix, slugify } from '../shared/blog-urls'
import {
  folderLanguage,
  postGroup,
  sameLanguage,
  siteForLanguage,
  siteForPost
} from '../shared/languages'
import type { PostRecord, PostSummary, SiteSettings } from '../shared/types'

/**
 * Posts are HTML pages. A published post *is* its page in the site folder
 * (`/blog/slug/index.html`); drafts and scheduled posts are the same kind of
 * page in `.sitecms/drafts/<id>.html`, never deployed. Everything about a post
 * is read back from the page itself:
 *
 * - `og:title` (title), `<title>` (SEO title when it differs), `meta description`
 *   (excerpt), `article:published_time` / `article:modified_time`, `article:tag`,
 *   `article:section` (category), `article:author`,
 *   `craftpages:cover` / `craftpages:social` (cover and social image; on older pages
 *   the cover is `og:image`), `craftpages:share-focus` and `og:image:alt`, the canonical
 *   URL (slug)
 * - the body between `<!-- craftpages:body -->` markers, with Gutenberg's block
 *   comments kept so the editor reopens it as blocks
 * - `<meta name="craftpages:post">` (a stable id, so a renamed post can be
 *   redirected) and, in drafts, `<meta name="craftpages:status">`
 */

export const POST_META = 'craftpages:post'
export const STATUS_META = 'craftpages:status'
export const EXCERPT_META = 'craftpages:excerpt'
/**
 * The cover's own path, or "none" when the post has none: og:image may be a social image,
 * a 1200×630 crop or the site's default instead. Pages made before this have no path here,
 * and their og:image is the cover.
 */
export const COVER_META = 'craftpages:cover'
/** The post's own social image (a path), when it isn't the cover; og:image may be its crop. */
export const SOCIAL_META = 'craftpages:social'
/** Where the share crop sits, "x,y" (see `PostRecord.shareFocus`); missing when it's centred. */
export const SHARE_FOCUS_META = 'craftpages:share-focus'
/** The cover's alt text, when og:image:alt belongs to the social image. */
export const COVER_ALT_META = 'craftpages:cover-alt'
/** The id of the post this one translates (a post's language is its `<html lang>`). */
export const TRANSLATION_META = 'craftpages:translation-of'
/** "custom": <title> is the post's own SEO title (otherwise it comes from the title pattern). */
export const TITLE_META = 'craftpages:title'
/**
 * "custom": the meta description is the post's own, not its excerpt. The excerpt is then kept
 * in `craftpages:excerpt` (which otherwise only says "auto").
 */
export const DESCRIPTION_META = 'craftpages:description'
/** In a draft: an address the post had while it was on the site (redirected to it when it's back). */
export const FORMER_URL_META = 'craftpages:former-url'
export const BODY_START = '<!-- craftpages:body -->'
export const BODY_END = '<!-- /craftpages:body -->'
/** Joins the parts of a post split around a banner (the editor's banner-position block). */
export const BREAK_BLOCK = '<!-- wp:craftpages/break /-->'

export interface StoredPost {
  record: PostRecord
  /** Workspace-relative file: a site page, a draft in .sitecms/drafts, or a legacy JSON post. */
  file: string
  /** Set when the post is a page on the site. */
  live: boolean
  /** A post from before posts were HTML (.sitecms/posts/*.json), migrated on the next publish. */
  legacy?: boolean
  /** Addresses this post had while live (kept in its draft page). */
  formerUrls: string[]
}

export const draftFile = (id: string): string => {
  if (!/^[a-z0-9]+$/.test(id)) throw new Error('Invalid post id')
  return `${DRAFTS_DIR}/${id}.html`
}

const meta = (head: Element, key: 'name' | 'property', value: string): Element[] => {
  const found: Element[] = []
  walk(head, (element) => {
    if (element.tagName === 'meta' && attr(element, key) === value) found.push(element)
  })
  return found
}

/** Reads a post back from its page, or null when the page isn't a post. */
export function parsePostPage(html: string, site: SiteSettings): PostRecord | null {
  if (!html.includes(POST_META)) return null
  const document = parse(html)
  const head = find(document, (e) => e.tagName === 'head')
  if (!head) return null
  const content = (element: Element | undefined): string =>
    (element && attr(element, 'content')) ?? ''
  const id = content(meta(head, 'name', POST_META)[0])
  if (!/^[a-z0-9]+$/.test(id)) return null

  const titleTag = find(head, (e) => e.tagName === 'title')
  const h1 = find(document, (e) => e.tagName === 'h1')
  const title = content(meta(head, 'property', 'og:title')[0]) || (h1 ? textContent(h1).trim() : '')
  const pageTitle = titleTag ? textContent(titleTag).trim() : ''
  const canonical = find(head, (e) => e.tagName === 'link' && attr(e, 'rel') === 'canonical')
  const url = (canonical && attr(canonical, 'href')) ?? ''
  const slug = url.replace(/\/+$/, '').split('/').pop() ?? ''

  const image = content(meta(head, 'property', 'og:image')[0])
  const localImage =
    site.baseUrl && image.startsWith(site.baseUrl) ? image.slice(site.baseUrl.length) : image

  const parts: string[] = []
  let from = html.indexOf(BODY_START)
  while (from >= 0) {
    const end = html.indexOf(BODY_END, from)
    if (end < 0) break
    parts.push(html.slice(from + BODY_START.length, end).trim())
    from = html.indexOf(BODY_START, end)
  }

  // The language: one of the site's other languages by `<html lang>`, else the root one.
  const htmlTag = find(document, (e) => e.tagName === 'html')
  const pageLang = (htmlTag && attr(htmlTag, 'lang')) ?? ''
  const lang =
    site.languages.length > 1 && pageLang
      ? site.languages.find((l) => l.path && sameLanguage(pageLang, l.code))?.code
      : undefined
  const translationOf = content(meta(head, 'name', TRANSLATION_META)[0])
  const coverMeta = content(meta(head, 'name', COVER_META)[0])
  const socialMeta = content(meta(head, 'name', SOCIAL_META)[0])
  const imageAlt = content(meta(head, 'property', 'og:image:alt')[0])
  const shareFocus = focusOf(
    content(meta(head, 'name', SHARE_FOCUS_META)[0])
      .split(',')
      .map((n) => (n.trim() ? Number(n) : NaN)) as [number, number]
  )
  const status = content(meta(head, 'name', STATUS_META)[0])
  const description = content(meta(head, 'name', 'description')[0])
  const customDescription = content(meta(head, 'name', DESCRIPTION_META)[0]) === 'custom'
  return {
    id,
    title,
    slug,
    status: status === 'draft' ? 'draft' : 'published',
    date: content(meta(head, 'property', 'article:published_time')[0]) || new Date().toISOString(),
    modified:
      content(meta(head, 'property', 'article:modified_time')[0]) || new Date().toISOString(),
    // "auto": the description was made from the body, so it follows the body on the next publish.
    excerpt: storedExcerpt(
      content(meta(head, 'name', EXCERPT_META)[0]),
      customDescription,
      description
    ),
    cover:
      coverMeta === 'none'
        ? null
        : coverMeta
          ? {
              src: coverMeta,
              alt: socialMeta ? content(meta(head, 'name', COVER_ALT_META)[0]) : imageAlt
            }
          : localImage
            ? { src: localImage, alt: imageAlt }
            : null,
    socialImage: socialMeta ? { src: socialMeta, alt: imageAlt } : null,
    ...(shareFocus ? { shareFocus } : {}),
    content: parts.join(`\n${BREAK_BLOCK}\n`),
    seoTitle: content(meta(head, 'name', TITLE_META)[0]) === 'custom' ? pageTitle : '',
    seoDescription: customDescription ? description : '',
    tags: meta(head, 'property', 'article:tag').map(content).filter(Boolean),
    category: content(meta(head, 'property', 'article:section')[0]),
    author: content(meta(head, 'property', 'article:author')[0]),
    ...(lang ? { lang } : {}),
    ...(/^[a-z0-9]+$/.test(translationOf) ? { translationOf } : {})
  }
}

/**
 * The excerpt from a post page's metas: "auto" (made from the body) is empty; with a custom
 * description the excerpt is the marker's own text; otherwise it's the meta description.
 */
function storedExcerpt(marker: string, customDescription: boolean, description: string): string {
  if (marker === 'auto') return ''
  return customDescription ? marker : description
}

async function readLegacy(root: string): Promise<StoredPost[]> {
  const dir = join(root, APP_DIR, 'posts')
  let names: string[] = []
  try {
    names = (await readdir(dir)).filter((name) => name.endsWith('.json'))
  } catch {
    return []
  }
  const posts = await Promise.all(
    names.map(async (name): Promise<StoredPost | null> => {
      try {
        const record = JSON.parse(await readFile(join(dir, name), 'utf8')) as PostRecord
        return {
          record,
          file: `${APP_DIR}/posts/${name}`,
          live: false,
          legacy: true,
          formerUrls: []
        }
      } catch {
        return null
      }
    })
  )
  return posts.filter((post): post is StoredPost => Boolean(post))
}

/** Every post: pages on the site, drafts, and not-yet-migrated JSON posts. Newest first. */
export async function readPosts(root: string): Promise<StoredPost[]> {
  const site = await getSiteSettings(root)
  const found = new Map<string, StoredPost>()
  const add = (post: StoredPost): void => {
    const existing = found.get(post.record.id)
    // A page on the site wins over a leftover copy elsewhere.
    if (!existing || (post.live && !existing.live)) found.set(post.record.id, post)
  }

  for (const file of await listFiles(root)) {
    if (!file.path.endsWith('.html')) continue
    const html = await readFile(join(root, file.path), 'utf8')
    const record = parsePostPage(html, site)
    if (record) add({ record, file: file.path, live: true, formerUrls: [] })
  }
  try {
    for (const name of await readdir(join(root, DRAFTS_DIR))) {
      if (!name.endsWith('.html')) continue
      const html = await readFile(join(root, DRAFTS_DIR, name), 'utf8')
      const record = parsePostPage(html, site)
      const former = [
        ...html.matchAll(new RegExp(`<meta name="${FORMER_URL_META}" content="([^"]+)"`, 'g'))
      ]
      if (record) {
        add({
          record,
          file: `${DRAFTS_DIR}/${name}`,
          live: false,
          formerUrls: former.map((m) => m[1])
        })
      }
    }
  } catch {
    // No drafts folder yet.
  }
  for (const post of await readLegacy(root)) if (!found.has(post.record.id)) add(post)

  return [...found.values()].sort((a, b) => b.record.date.localeCompare(a.record.date))
}

/**
 * Posts waiting in .sitecms/drafts to go live (published, with a date), read
 * without scanning the site: cheap enough to check every project often.
 * A date in the past means the post is due.
 */
export async function scheduledPosts(root: string): Promise<PostRecord[]> {
  const site = await getSiteSettings(root)
  let names: string[]
  try {
    names = await readdir(join(root, DRAFTS_DIR))
  } catch {
    return []
  }
  const found: PostRecord[] = []
  for (const name of names) {
    if (!name.endsWith('.html')) continue
    const html = await readFile(join(root, DRAFTS_DIR, name), 'utf8').catch(() => '')
    const record = parsePostPage(html, site)
    if (record?.status === 'published') found.push(record)
  }
  return found.sort((a, b) => a.date.localeCompare(b.date))
}

/** Published and its date has come: on the site. Published with a future date: scheduled. */
export const isLive = (post: PostRecord, now = Date.now()): boolean =>
  post.status === 'published' && new Date(post.date).getTime() <= now

export async function listPosts(root: string): Promise<PostSummary[]> {
  const site = await getSiteSettings(root)
  return (await readPosts(root)).map(({ record: post }) => ({
    id: post.id,
    title: post.title,
    slug: post.slug,
    status: post.status,
    scheduled: post.status === 'published' && !isLive(post),
    date: post.date,
    modified: post.modified,
    excerpt: post.excerpt,
    url: postPath(siteForPost(site, post).blog.permalink, post.slug),
    tags: post.tags ?? [],
    category: post.category ?? '',
    author: post.author ?? '',
    lang: post.lang ?? '',
    group: postGroup(post)
  }))
}

export async function getPost(root: string, id: string): Promise<PostRecord> {
  const post = (await readPosts(root)).find((stored) => stored.record.id === id)
  if (!post) throw new Error('This post no longer exists.')
  return post.record
}

/**
 * A draft that translates a post into another language: the same content, slug and
 * settings to translate, linked to the original (and its other translations).
 */
export async function translationDraft(
  root: string,
  id: string,
  code: string
): Promise<PostRecord> {
  const site = await getSiteSettings(root)
  const stored = await readPosts(root)
  const source = stored.find((post) => post.record.id === id)?.record
  if (!source) throw new Error('That post no longer exists.')
  const language = site.languages.find((l) => l.code === code)
  if (!language || site.languages.length < 2)
    throw new Error(`“${code}” isn’t one of the site’s languages.`)
  const group = postGroup(source)
  const lang = language.path ? language.code : undefined
  const existing = stored.find(
    (post) => postGroup(post.record) === group && (post.record.lang ?? '') === (lang ?? '')
  )
  if (existing) return existing.record
  const now = new Date().toISOString()
  const rest: PostRecord = { ...source }
  delete rest.lang
  return {
    ...rest,
    ...(lang ? { lang } : {}),
    id: newPost().id,
    translationOf: group,
    status: 'draft',
    date: now,
    modified: now
  }
}

export function newPost(): PostRecord {
  const now = new Date().toISOString()
  return {
    id: randomBytes(6).toString('hex'),
    title: '',
    slug: '',
    status: 'draft',
    date: now,
    modified: now,
    excerpt: '',
    cover: null,
    content: '',
    seoTitle: '',
    seoDescription: '',
    tags: [],
    category: '',
    author: ''
  }
}

/** Plain-text summary from block HTML, for cards and meta descriptions. */
export function excerptOf(html: string, words = 32): string {
  const text = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
  const list = text.split(' ')
  return list.length <= words ? text : list.slice(0, words).join(' ') + '…'
}

/** Tags cleaned up: trimmed, de-duplicated case-insensitively, first spelling wins. */
export function cleanTags(tags: string[] | undefined): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const tag of tags ?? []) {
    const name = tag.replace(/\s+/g, ' ').trim()
    if (!name || seen.has(name.toLowerCase())) continue
    seen.add(name.toLowerCase())
    out.push(name)
  }
  return out
}

/** Checks and normalises a post before it's written. */
/**
 * Turns `file:///` links and images back into site paths. Text pasted from a page opened from
 * disk (a Markdown preview, the app itself) carries `/blog/` as `file:///blog/`, which no
 * visitor can open. A file inside the site folder becomes its site path.
 */
export function siteLinks(content: string, root: string): string {
  const base = pathToFileURL(root).href.replace(/\/?$/, '/')
  return content.replace(
    /\b(href|src)="file:\/\/(\/[^"]*)"/gi,
    (_match, name: string, path: string) => {
      const url = `file://${path}`
      const site = url.startsWith(base) ? `/${url.slice(base.length)}` : path
      return `${name}="${site}"`
    }
  )
}

export async function validatePost(root: string, post: PostRecord): Promise<PostRecord> {
  const site = await getSiteSettings(root)
  const title = post.title.trim()
  if (!title) throw new Error('Give the post a title.')
  // Only the site's other languages; the root language is no language at all.
  const lang = folderLanguage(site.languages, post.lang)?.code
  const own = siteForLanguage(site, lang)
  const slug = (post.slug.trim() ? post.slug.trim().toLowerCase() : slugify(title)).replace(
    /^-+|-+$/g,
    ''
  )
  if (!isValidSlug(slug)) {
    throw new Error(
      'The slug may only use lowercase letters, digits and dashes (e.g. my-first-post).'
    )
  }
  // /blog/page/2/ and /blog/tag/x/ belong to the list when posts and the list share a folder.
  const sharesFolder = postPrefix(own.blog.permalink) === listPath(own.blog.listPath)
  if (sharesFolder && (slug === 'page' || slug === 'tag' || slug === 'category')) {
    throw new Error(
      `“${slug}” is used by the post list (pagination, tag and category pages). Pick another slug.`
    )
  }
  if (postPath(own.blog.permalink, slug) === listPath(own.blog.listPath)) {
    throw new Error('That URL is the post list’s own address. Pick another slug.')
  }
  const others = (await readPosts(root)).filter((other) => other.record.id !== post.id)
  // Each language has its own addresses: the same slug in two languages is fine.
  const clash = others.find(
    (other) => other.record.slug === slug && (other.record.lang ?? '') === (lang ?? '')
  )
  if (clash) throw new Error(`“${clash.record.title}” already uses the slug “${slug}”.`)
  const date = Number.isNaN(new Date(post.date).getTime()) ? new Date().toISOString() : post.date
  const rest: PostRecord = { ...post }
  delete rest.lang
  return {
    ...rest,
    ...(lang ? { lang } : {}),
    title,
    slug,
    date,
    content: siteLinks(post.content, root),
    tags: cleanTags(post.tags),
    category: (post.category ?? '').replace(/\s+/g, ' ').trim(),
    author: (post.author ?? '').replace(/\s+/g, ' ').trim(),
    modified: new Date().toISOString()
  }
}
