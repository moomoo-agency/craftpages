import { mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { parse } from 'parse5'
import { attr, children, find, isElement, textContent, walk, type Element } from './html/dom'
import { renderList, renderPost, type PostData } from './blog-render'
import { fileOfPath, listPath, postPath } from '../shared/blog-urls'
import { APP_DIR, getSiteSettings } from './settings'
import { getWorkspace } from './state'
import { startStaticServer, type StaticServer } from './preview/server'
import { resolveInWorkspace } from './workspace'
import type {
  BlogPreview,
  BlogSetup,
  BlogTemplates,
  SiteSettings,
  TemplateCandidate,
  Workspace
} from '../shared/types'

/**
 * Blog setup: which page is the post template and which is the list page.
 * Stored in `.sitecms/templates.json`; the content regions, card fields and
 * pagination are pointed at in the next step and stored alongside.
 */

const BLOG_DIR = /^(blog|news|posts|articles|journal|insights)\//
const templatesFile = (root: string): string => join(root, APP_DIR, 'templates.json')

export async function readTemplates(root: string): Promise<BlogTemplates | null> {
  try {
    return JSON.parse(await readFile(templatesFile(root), 'utf8')) as BlogTemplates
  } catch {
    return null
  }
}

export async function saveTemplates(root: string, update: BlogTemplates): Promise<void> {
  let templates = update
  const current = (await readTemplates(root)) ?? {}
  // Pointing belongs to a specific page: choosing another page starts that layout over.
  if (
    templates.post !== undefined &&
    templates.post !== current.post &&
    templates.postLayout === undefined
  ) {
    templates = { ...templates, postLayout: null }
  }
  if (
    templates.list !== undefined &&
    templates.list !== current.list &&
    templates.listLayout === undefined
  ) {
    templates = { ...templates, listLayout: null }
  }
  await mkdir(join(root, APP_DIR), { recursive: true })
  await writeFile(templatesFile(root), JSON.stringify({ ...current, ...templates }, null, 2))
}

const words = (text: string): number => text.split(/\s+/).filter(Boolean).length

const INTERNAL_PAGE = /^(?!#|[a-z][a-z0-9+.-]*:|\/\/)[^#]+/i

interface CardRun {
  count: number
  /** Cards linking to distinct pages of this site (not anchors, not other sites). */
  linkedPages: number
  dated: number
  inBlogDir: number
}

/**
 * The longest run of same-shaped siblings that each hold a heading and a link.
 * A post list's cards link to separate internal pages and usually show a date;
 * a landing page's feature cards usually link to anchors or nowhere special.
 */
function cardRun(root: Element): CardRun {
  let best: CardRun = { count: 0, linkedPages: 0, dated: 0, inBlogDir: 0 }
  walk(root, (element) => {
    const kids = children(element)
    if (kids.length < 3) return true
    const byShape = new Map<string, Element[]>()
    for (const kid of kids) {
      const hasLink = Boolean(find(kid, (e) => e.tagName === 'a' && Boolean(attr(e, 'href'))))
      const hasHeading = Boolean(find(kid, (e) => /^h[2-4]$/.test(e.tagName)))
      if (!hasLink || !hasHeading) continue
      const shape = `${kid.tagName}.${(attr(kid, 'class') ?? '').split(/\s+/)[0]}`
      byShape.set(shape, [...(byShape.get(shape) ?? []), kid])
    }
    for (const cards of byShape.values()) {
      if (cards.length <= best.count) continue
      const hrefs = cards
        .map((card) =>
          attr(
            find(card, (e) => e.tagName === 'a' && Boolean(attr(e, 'href')))!,
            'href'
          )!
        )
        .filter((href) => INTERNAL_PAGE.test(href))
      best = {
        count: cards.length,
        linkedPages: new Set(hrefs).size,
        dated: cards.filter((card) => find(card, (e) => e.tagName === 'time')).length,
        inBlogDir: hrefs.filter((href) => BLOG_DIR.test(href.replace(/^\/+/, ''))).length
      }
    }
    return true
  })
  return best
}

function scorePage(
  path: string,
  title: string,
  html: string
): { post: TemplateCandidate; list: TemplateCandidate } {
  const document = parse(html)
  const htmlElement = document.childNodes.filter(isElement)[0]
  const body = htmlElement && children(htmlElement).find((e) => e.tagName === 'body')
  const post: TemplateCandidate = { path, title, score: 0, reasons: [] }
  const list: TemplateCandidate = { path, title, score: 0, reasons: [] }
  const add = (target: TemplateCandidate, points: number, reason: string): void => {
    target.score += points
    target.reasons.push(reason)
  }

  if (/"@type"\s*:\s*"(BlogPosting|Article|NewsArticle)"/.test(html))
    add(post, 4, 'has Article structured data')
  if (/<meta[^>]+property=["']og:type["'][^>]+content=["']article["']/i.test(html))
    add(post, 3, 'og:type is article')
  const article = body && find(body, (e) => e.tagName === 'article')
  if (article && words(textContent(article)) > 150) add(post, 2, 'has an <article> with body text')
  if (body && find(body, (e) => e.tagName === 'time' && Boolean(attr(e, 'datetime'))))
    add(post, 1, 'shows a date')
  const isListPath = /^(blog|news|posts|articles|journal|insights)(\/index)?\.html$/.test(path)
  if (BLOG_DIR.test(path) && !isListPath) add(post, 2, `lives under /${path.split('/')[0]}/`)
  const main = body && (find(body, (e) => e.tagName === 'main') ?? body)
  if (main && words(textContent(main)) > 800) add(post, 1, 'long-form text')

  if (isListPath) add(list, 4, `is /${path.split('/')[0]}/`)
  const cards = body ? cardRun(body) : null
  if (cards && cards.linkedPages >= 3 && (cards.dated >= 2 || cards.inBlogDir >= 2)) {
    add(
      list,
      3,
      `lists ${cards.linkedPages} cards linking to ${cards.inBlogDir >= 2 ? 'posts' : 'dated pages'}`
    )
  } else if (cards && cards.linkedPages >= 3) {
    add(list, 1, `repeats ${cards.linkedPages} cards linking to pages`)
  }
  if (/rel=["']next["']|\/page\/2\b/.test(html)) add(list, 1, 'has pagination')

  return { post, list }
}

export async function blogSetup(workspace: Workspace): Promise<BlogSetup> {
  const posts: TemplateCandidate[] = []
  const lists: TemplateCandidate[] = []
  for (const page of workspace.pages) {
    if (page.path === '404.html') continue
    const html = await readFile(join(workspace.root, page.path), 'utf8')
    const { post, list } = scorePage(page.path, page.title, html)
    if (post.score >= 3) posts.push(post)
    if (list.score >= 3) lists.push(list)
  }
  const byScore = (a: TemplateCandidate, b: TemplateCandidate): number => b.score - a.score
  return {
    templates: await readTemplates(workspace.root),
    candidates: { post: posts.sort(byScore), list: lists.sort(byScore) }
  }
}

// ---------- URLs ----------

export const postUrl = (site: SiteSettings, slug: string): string =>
  postPath(site.blog.permalink, slug)
export const listUrl = (site: SiteSettings, page = 1): string => listPath(site.blog.listPath, page)
export const fileOf = fileOfPath

// ---------- Preview with sample posts ----------

const SAMPLE_BODY = `<p>This is a sample post, rendered with your own layout so you can check the setup. Real posts replace it.</p>
<h2>A section heading</h2>
<p>Body text flows into the article area you pointed at. Headings, lists, quotes and images from the editor keep the site's own typography.</p>
<ul><li>A list item</li><li>Another list item</li></ul>
<h2>Another section</h2>
<p>If a banner splits your article, the second part starts here (or wherever you place a break in the editor).</p>
<blockquote><p>A quote, to see how the site styles it.</p></blockquote>
<p>That's the end of the sample.</p>`

function samplePosts(site: SiteSettings, image: string | null): PostData[] {
  const titles = [
    'How we plan a new season',
    'Five small fixes that doubled sign-ups',
    'Notes from our first year'
  ]
  return titles.map((title, i) => ({
    title,
    html: SAMPLE_BODY,
    excerpt: 'A short summary of the post, as it will appear on cards and in search results.',
    date: new Date(Date.now() - i * 9 * 86400000).toISOString(),
    image: image ? { src: image, alt: '' } : null,
    url: postUrl(site, `sample-post-${i + 1}`)
  }))
}

let previewServer: StaticServer | null = null
let viewServer: StaticServer | null = null

/** A page as visitors see it, from a plain server (no editor), e.g. a generated blog page. */
export async function viewUrl(path: string): Promise<string> {
  viewServer ??= await startStaticServer({ getRoot: () => getWorkspace()?.root ?? null })
  return viewServer.origin + '/' + path.replace(/(^|\/)index\.html$/, '$1')
}

/** Renders a sample post and list page into a throwaway server; nothing is written to the site. */
export async function previewBlog(): Promise<BlogPreview> {
  const workspace = getWorkspace()
  if (!workspace) throw new Error('No project is open.')
  const root = workspace.root
  const templates = await readTemplates(root)
  if (!templates?.post || !templates.list || !templates.postLayout || !templates.listLayout) {
    throw new Error('Finish both layouts first.')
  }
  const site = await getSiteSettings(root)
  const context = { baseUrl: site.baseUrl, locale: site.locale }
  const read = (path: string): Promise<string> => readFile(resolveInWorkspace(root, path), 'utf8')
  const posts = samplePosts(site, firstImage(await read(templates.post)))

  const overlay = new Map<string, string | null>()
  const postSource = await read(templates.post)
  for (const post of posts) {
    overlay.set(
      fileOf(post.url),
      renderPost(postSource, templates.post, templates.postLayout, post, context)
    )
  }
  const list = renderList(
    await read(templates.list),
    templates.list,
    templates.listLayout,
    posts,
    { page: 1, total: 2, urlOf: (n) => listUrl(site, n), heading: site.blog.title },
    context
  )
  overlay.set(fileOf(listUrl(site)), list)

  await previewServer?.close()
  previewServer = await startStaticServer({ getRoot: () => getWorkspace()?.root ?? null, overlay })
  return { post: previewServer.origin + posts[0].url, list: previewServer.origin + listUrl(site) }
}

/** A root-absolute image from the page, to give sample posts a cover. */
function firstImage(html: string): string | null {
  const match = html.match(/<img[^>]+src=["'](\/[^"']+\.(?:jpe?g|png|webp|avif))["']/i)
  return match ? match[1] : null
}
