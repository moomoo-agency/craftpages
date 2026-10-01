import { randomBytes } from 'crypto'
import { readdir, readFile } from 'fs/promises'
import { join } from 'path'
import { parse } from 'parse5'
import { attr, find, textContent, walk, type Element } from './html/dom'
import { APP_DIR, getSiteSettings } from './settings'
import { DRAFTS_DIR, listFiles } from './workspace'
import { isValidSlug, listPath, postPath, postPrefix, slugify } from '../shared/blog-urls'
import type { PostRecord, PostSummary, SiteSettings } from '../shared/types'

/**
 * Posts are HTML pages. A published post *is* its page in the site folder
 * (`/blog/slug/index.html`); drafts and scheduled posts are the same kind of
 * page in `.sitecms/drafts/<id>.html`, never deployed. Everything about a post
 * is read back from the page itself:
 *
 * - `og:title` (title), `<title>` (SEO title when it differs), `meta description`
 *   (excerpt), `article:published_time` / `article:modified_time`, `article:tag`,
 *   `og:image` + `og:image:alt` (cover), the canonical URL (slug)
 * - the body between `<!-- craftpages:body -->` markers, with Gutenberg's block
 *   comments kept so the editor reopens it as blocks
 * - `<meta name="craftpages:post">` (a stable id, so a renamed post can be
 *   redirected) and, in drafts, `<meta name="craftpages:status">`
 */

export const POST_META = 'craftpages:post'
export const STATUS_META = 'craftpages:status'
export const EXCERPT_META = 'craftpages:excerpt'
/** "none": the post has no cover; its og:image is the site's default, not the post's. */
export const COVER_META = 'craftpages:cover'
/** "custom": <title> is the post's own SEO title (otherwise it comes from the title pattern). */
export const TITLE_META = 'craftpages:title'
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

  const status = content(meta(head, 'name', STATUS_META)[0])
  return {
    id,
    title,
    slug,
    status: status === 'draft' ? 'draft' : 'published',
    date: content(meta(head, 'property', 'article:published_time')[0]) || new Date().toISOString(),
    modified:
      content(meta(head, 'property', 'article:modified_time')[0]) || new Date().toISOString(),
    // "auto": the description was made from the body, so it follows the body on the next publish.
    excerpt:
      content(meta(head, 'name', EXCERPT_META)[0]) === 'auto'
        ? ''
        : content(meta(head, 'name', 'description')[0]),
    cover:
      localImage && content(meta(head, 'name', COVER_META)[0]) !== 'none'
        ? { src: localImage, alt: content(meta(head, 'property', 'og:image:alt')[0]) }
        : null,
    content: parts.join(`\n${BREAK_BLOCK}\n`),
    seoTitle: content(meta(head, 'name', TITLE_META)[0]) === 'custom' ? pageTitle : '',
    tags: meta(head, 'property', 'article:tag').map(content).filter(Boolean)
  }
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
        const record = JSON.parse(await readFile(join(dir, name), 'utf8')) as PostRecord & {
          seoDescription?: string
        }
        const excerpt = record.seoDescription?.trim() || record.excerpt
        delete record.seoDescription
        return {
          record: { ...record, excerpt },
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
    url: postPath(site.blog.permalink, post.slug),
    tags: post.tags ?? []
  }))
}

export async function getPost(root: string, id: string): Promise<PostRecord> {
  const post = (await readPosts(root)).find((stored) => stored.record.id === id)
  if (!post) throw new Error('This post no longer exists.')
  return post.record
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
    tags: []
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
export async function validatePost(root: string, post: PostRecord): Promise<PostRecord> {
  const site = await getSiteSettings(root)
  const title = post.title.trim()
  if (!title) throw new Error('Give the post a title.')
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
  const sharesFolder = postPrefix(site.blog.permalink) === listPath(site.blog.listPath)
  if (sharesFolder && (slug === 'page' || slug === 'tag')) {
    throw new Error(
      `“${slug}” is used by the post list (pagination and tag pages). Pick another slug.`
    )
  }
  if (postPath(site.blog.permalink, slug) === listPath(site.blog.listPath)) {
    throw new Error('That URL is the post list’s own address. Pick another slug.')
  }
  const others = (await readPosts(root)).filter((other) => other.record.id !== post.id)
  const clash = others.find((other) => other.record.slug === slug)
  if (clash) throw new Error(`“${clash.record.title}” already uses the slug “${slug}”.`)
  const date = Number.isNaN(new Date(post.date).getTime()) ? new Date().toISOString() : post.date
  return {
    ...post,
    title,
    slug,
    date,
    tags: cleanTags(post.tags),
    modified: new Date().toISOString()
  }
}
