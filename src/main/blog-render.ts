import { parseFragment, serializeOuter } from 'parse5'
import { posix } from 'path'
import {
  applyPatches,
  attr,
  attrPatches,
  escapeAttr,
  escapeText,
  find,
  isElement,
  parseWithLocations,
  textContent,
  walk,
  type Element,
  type Patch
} from './html/dom'
import { follow, resolveLocator } from './html/locator'
import { readSeo, writeSeo } from './html/seo'
import type {
  CardFields,
  ElementLocator,
  LatestLayout,
  ListLayout,
  PostLayout
} from '../shared/types'

/**
 * Builds blog pages from the user's own pages: a post is the post layout page
 * with its article area(s) replaced; a list page is the list layout page with
 * its card area replaced. Everything else in those pages stays as it is.
 */

export interface PostData {
  title: string
  /** Body HTML (Gutenberg output). */
  html: string
  excerpt: string
  /** ISO date. */
  date: string
  image?: { src: string; alt: string } | null
  /** Site path of the post page, e.g. /blog/my-post/ */
  url: string
  tags?: { name: string; url: string }[]
}

export interface PageContext {
  baseUrl: string
  locale: string
}

/** Marker a writer can put between blocks to choose where a banner splits the article. */
export const REGION_BREAK = '<!-- wp:craftpages/break /-->'
/** The post body is wrapped in these so it can be read back from the page. */
export const BODY_START = '<!-- craftpages:body -->'
export const BODY_END = '<!-- /craftpages:body -->'

const URL_ATTRS = ['href', 'src', 'poster', 'action', 'data-src']

/**
 * Makes relative URLs root-absolute, so a layout page from one folder still
 * works when the generated page lives in another (e.g. /privacy/ → /blog/x/).
 */
export function relocate(source: string, fromPath: string): string {
  const fromDir = posix.dirname('/' + fromPath)
  const document = parseWithLocations(source)
  const patches: Patch[] = []
  walk(document, (element) => {
    const values: Record<string, string> = {}
    for (const name of URL_ATTRS) {
      const value = attr(element, name)
      if (
        value === undefined ||
        !value.trim() ||
        /^([a-z][a-z0-9+.-]*:|\/|#|\?|\{)/i.test(value.trim())
      )
        continue
      values[name] = posix.normalize(posix.join(fromDir, value.trim()))
    }
    const srcset = attr(element, 'srcset')
    if (srcset && !/^\s*(\/|[a-z]+:)/i.test(srcset)) {
      values.srcset = srcset
        .split(',')
        .map((part) => {
          const [url, ...rest] = part.trim().split(/\s+/)
          const fixed = /^([a-z][a-z0-9+.-]*:|\/)/i.test(url)
            ? url
            : posix.normalize(posix.join(fromDir, url))
          return [fixed, ...rest].join(' ')
        })
        .join(', ')
    }
    if (Object.keys(values).length && element.sourceCodeLocation?.startTag) {
      patches.push(...attrPatches(source, element, values))
    }
    return true
  })
  return applyPatches(source, patches)
}

function contains(ancestor: Element, element: Element): boolean {
  for (let node: unknown = element; node && typeof node === 'object' && 'tagName' in node;) {
    if (node === ancestor) return true
    node = (node as Element).parentNode
  }
  return false
}

/** Never removed: they don't show content (styles, scripts, metadata). */
const NON_VISUAL = new Set(['script', 'style', 'link', 'meta', 'template', 'noscript'])
/** Page chrome, kept when it sits outside <main>. */
const CHROME = new Set(['header', 'footer', 'nav', 'aside'])

const holdsTag = (element: Element, tags: string[]): boolean =>
  Boolean(find(element, (e) => tags.includes(e.tagName)))

/**
 * Patches that take out what the generated page shouldn't carry over from the
 * layout page.
 *
 * - `keepOnly`: whole sections of the main content that hold no picked part are
 *   removed. The section a pick sits in keeps its inner structure (its grid).
 * - Left-out parts: a top-level section is removed; anything smaller is emptied,
 *   so the grid or flex layout around it keeps its shape.
 */
function trimPatches(
  document: ReturnType<typeof parseWithLocations>,
  kept: Element[],
  removeLocators: ElementLocator[] | undefined,
  keepOnly: boolean | undefined
): Patch[] {
  const holdsKept = (element: Element): boolean => kept.some((k) => contains(element, k))
  const insideKept = (element: Element): boolean => kept.some((k) => contains(k, element))
  const main = find(document, (e) => e.tagName === 'main')
  const inMain = Boolean(main && kept.every((k) => contains(main, k)))
  const start = inMain ? main : find(document, (e) => e.tagName === 'body')
  if (!start) return []

  const remove = new Set<Element>()
  const empty = new Set<Element>()
  if (keepOnly && kept.length) {
    const visit = (element: Element): void => {
      for (const child of element.childNodes.filter(isElement)) {
        if (kept.includes(child) || NON_VISUAL.has(child.tagName)) continue
        if (holdsKept(child)) {
          // Only look inside page-level wrappers (around header / main / footer).
          if (holdsTag(child, ['main', 'header', 'footer'])) visit(child)
        } else if (inMain || !CHROME.has(child.tagName)) {
          remove.add(child)
        }
      }
    }
    visit(start)
  }
  const topLevel = (element: Element): boolean => {
    for (
      let node = element.parentNode as Element | null;
      node && 'tagName' in node;
      node = node.parentNode as Element | null
    ) {
      if (node === start) return true
      if (!holdsTag(node, ['main', 'header', 'footer']) || node.tagName === 'main') return false
    }
    return false
  }
  for (const locator of removeLocators ?? []) {
    const element = resolveLocator(document, locator)
    // Never cut into a picked part, or around one.
    if (!element || holdsKept(element) || insideKept(element)) continue
    if (topLevel(element)) remove.add(element)
    else empty.add(element)
  }

  const all = [...remove, ...empty]
  const outermost = (element: Element): boolean =>
    !all.some((other) => other !== element && contains(other, element))
  const patches: Patch[] = []
  for (const element of remove) {
    const location = element.sourceCodeLocation
    if (location && outermost(element)) {
      patches.push({ start: location.startOffset, end: location.endOffset, text: '' })
    }
  }
  for (const element of empty) {
    const location = element.sourceCodeLocation
    if (location?.startTag && location.endTag && outermost(element)) {
      patches.push({
        start: location.startTag.endOffset,
        end: location.endTag.startOffset,
        text: ''
      })
    } else if (location && outermost(element)) {
      patches.push({ start: location.startOffset, end: location.endOffset, text: '' })
    }
  }
  return patches
}

function formatDate(iso: string, locale: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  try {
    return date.toLocaleDateString(locale || 'en', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  } catch {
    return date.toLocaleDateString('en', { year: 'numeric', month: 'long', day: 'numeric' })
  }
}

function innerRange(element: Element, what: string): { start: number; end: number } {
  const location = element.sourceCodeLocation
  if (!location?.startTag || !location.endTag) {
    throw new Error(
      `The ${what} can’t take content (it has no closing tag). Pick a different element.`
    )
  }
  return { start: location.startTag.endOffset, end: location.endTag.startOffset }
}

/** Splits body HTML into `count` parts: at explicit break markers, else before evenly spaced H2s. */
export function splitBody(html: string, count: number): string[] {
  // One area: the body as it is, break markers included (they're invisible and keep the split
  // if the layout gets a second area later).
  if (count <= 1) return [html]
  if (html.includes(REGION_BREAK)) {
    const parts = html.split(REGION_BREAK).map((part) => part.trim())
    while (parts.length < count) parts.push('')
    return [...parts.slice(0, count - 1), parts.slice(count - 1).join(`\n${REGION_BREAK}\n`)]
  }
  // No marker: cut before a top-level block near each target, preferring an H2 heading,
  // at block comment boundaries so Gutenberg's comments stay intact.
  const starts = [...html.matchAll(/(?:^|\n)<!-- wp:([a-z0-9/-]+)(\s[^>]*?)?\s*\/?-->/g)].map(
    (m) => ({
      at: m.index + (m[0].startsWith('\n') ? 1 : 0),
      heading2: m[1] === 'heading' && (!m[2] || /"level":2\b/.test(m[2]))
    })
  )
  if (starts.length > 1) {
    const cuts: number[] = []
    for (let k = 1; k < count; k++) {
      const target = (html.length * k) / count
      const pool = starts.filter((start) => start.at > 0 && !cuts.includes(start.at))
      const headings = pool.filter((start) => start.heading2)
      const nearest = (list: typeof pool): number | undefined =>
        list.sort((x, y) => Math.abs(x.at - target) - Math.abs(y.at - target))[0]?.at
      const cut = nearest(headings) ?? nearest(pool)
      if (cut !== undefined) cuts.push(cut)
    }
    cuts.sort((x, y) => x - y)
    const parts: string[] = []
    let from = 0
    for (const cut of [...cuts, html.length]) {
      parts.push(html.slice(from, cut).trim())
      from = cut
    }
    while (parts.length < count) parts.push('')
    return parts
  }
  // Plain HTML (no block comments): cut between elements, preferring an H2.
  const fragment = parseFragment(html)
  const blocks = fragment.childNodes.filter(
    (node) => isElement(node) || (node.nodeName === '#text' && 'value' in node && node.value.trim())
  )
  const html2 = blocks.map((node) =>
    isElement(node) ? serializeOuter(node) : escapeText((node as { value: string }).value)
  )
  const headings = blocks
    .map((node, i) => (isElement(node) && node.tagName === 'h2' ? i : -1))
    .filter((i) => i > 0)
  const cuts: number[] = []
  for (let k = 1; k < count; k++) {
    const target = Math.round((blocks.length * k) / count)
    const near = headings
      .filter((i) => !cuts.includes(i))
      .sort((x, y) => Math.abs(x - target) - Math.abs(y - target))[0]
    cuts.push(near ?? target)
  }
  cuts.sort((x, y) => x - y)
  const parts: string[] = []
  let from = 0
  for (const cut of [...cuts, blocks.length]) {
    parts.push(html2.slice(from, cut).join('\n'))
    from = cut
  }
  return parts
}

function required(element: Element | null, locator: ElementLocator, what: string): Element {
  if (!element)
    throw new Error(
      `Can’t find the ${what} (${locator.hint}) in the layout page any more. Point at it again.`
    )
  return element
}

export function renderPost(
  layoutSource: string,
  layoutPath: string,
  layout: PostLayout,
  post: PostData,
  context: PageContext
): string {
  const source = relocate(layoutSource, layoutPath)
  const document = parseWithLocations(source)
  const patches: Patch[] = []
  const regions = layout.regions.map((locator, i) =>
    required(resolveLocator(document, locator), locator, `article area ${i + 1}`)
  )
  const parts = splitBody(post.html, regions.length)

  const titleElement = layout.title ? resolveLocator(document, layout.title) : null
  regions.forEach((region, i) => {
    const heading = i === 0 && !titleElement ? `<h1>${escapeText(post.title)}</h1>\n` : ''
    patches.push({
      ...innerRange(region, 'article area'),
      text: `${heading}${BODY_START}\n${parts[i]}\n${BODY_END}`
    })
  })
  // Title / date / image inside an article area are overwritten by the article anyway.
  const insideRegion = (element: Element): boolean =>
    regions.some((region) => contains(region, element))

  if (titleElement && !insideRegion(titleElement)) {
    patches.push({ ...innerRange(titleElement, 'title'), text: escapeText(post.title) })
  }
  const dateElement = layout.date ? resolveLocator(document, layout.date) : null
  if (dateElement && !insideRegion(dateElement)) {
    patches.push({
      ...innerRange(dateElement, 'date'),
      text: escapeText(formatDate(post.date, context.locale))
    })
    if (dateElement.tagName === 'time')
      patches.push(...attrPatches(source, dateElement, { datetime: post.date.slice(0, 10) }))
  }
  const imageElement = layout.image ? resolveLocator(document, layout.image) : null
  const img =
    imageElement &&
    (imageElement.tagName === 'img' ? imageElement : find(imageElement, (e) => e.tagName === 'img'))
  if (img && post.image && !insideRegion(img)) {
    patches.push(
      ...attrPatches(source, img, {
        src: post.image.src,
        alt: post.image.alt,
        srcset: null,
        sizes: null
      })
    )
  }

  // Tag links (e.g. under the title); the area is emptied for a post without tags.
  const tagsElement = layout.tags ? resolveLocator(document, layout.tags) : null
  if (tagsElement && !insideRegion(tagsElement)) {
    const links = (post.tags ?? [])
      .map((tag) => `<a href="${escapeAttr(tag.url)}" rel="tag">${escapeText(tag.name)}</a>`)
      .join(', ')
    patches.push({ ...innerRange(tagsElement, 'tags area'), text: links })
  }

  const keptParts = [...regions, titleElement, dateElement, imageElement, tagsElement].filter(
    (element): element is Element => Boolean(element)
  )
  patches.push(...trimPatches(document, keptParts, layout.remove, layout.keepOnly))

  const body = applyPatches(source, patches)
  const absolute = (path: string): string => (context.baseUrl ? context.baseUrl + path : path)
  const seo = readSeo(body)
  return writeSeo(body, {
    ...seo,
    title: post.title,
    description: post.excerpt,
    canonical: absolute(post.url),
    ogTitle: post.title,
    ogDescription: post.excerpt,
    ogImage: post.image ? absolute(post.image.src) : seo.ogImage
  })
}

// ---------- List pages ----------

const DEFAULT_CARD_STYLE = `<style id="cp-blog">
.cp-cards{display:grid;gap:28px;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));margin:0;padding:0}
.cp-card{display:flex;flex-direction:column;gap:8px}
.cp-card a{color:inherit;text-decoration:none}
.cp-card img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:8px;background:rgba(127,127,127,.15)}
.cp-card h2{margin:4px 0 0;font-size:1.25em;line-height:1.3}
.cp-card time{opacity:.7;font-size:.9em}
.cp-card p{margin:0}
.cp-pagination{display:flex;gap:16px;align-items:center;justify-content:center;margin-top:40px}
</style>`

function defaultCard(post: PostData, context: PageContext): string {
  const image = post.image
    ? `<img src="${escapeAttr(post.image.src)}" alt="${escapeAttr(post.image.alt)}" loading="lazy">`
    : ''
  return `<article class="cp-card"><a href="${escapeAttr(post.url)}">${image}<h2>${escapeText(post.title)}</h2></a><time datetime="${post.date.slice(0, 10)}">${escapeText(formatDate(post.date, context.locale))}</time><p>${escapeText(post.excerpt)}</p></article>`
}

function fillCard(
  cardHtml: string,
  fields: CardFields,
  post: PostData,
  context: PageContext
): string {
  const fragment = parseFragment(cardHtml, { sourceCodeLocationInfo: true })
  const card = fragment.childNodes.find(isElement)!
  const at = (path?: number[] | null): Element | null => (path ? follow(card, path) : null)
  const patches: Patch[] = []
  const setText = (element: Element | null, text: string): void => {
    const location = element?.sourceCodeLocation
    if (location?.startTag && location.endTag) {
      patches.push({
        start: location.startTag.endOffset,
        end: location.endTag.startOffset,
        text: escapeText(text)
      })
    }
  }
  setText(at(fields.title), post.title)
  setText(at(fields.excerpt), post.excerpt)
  const date = at(fields.date)
  setText(date, formatDate(post.date, context.locale))
  if (date?.tagName === 'time')
    patches.push(...attrPatches(cardHtml, date, { datetime: post.date.slice(0, 10) }))
  const imageHolder = at(fields.image)
  const img =
    imageHolder &&
    (imageHolder.tagName === 'img' ? imageHolder : find(imageHolder, (e) => e.tagName === 'img'))
  if (img && post.image) {
    patches.push(
      ...attrPatches(cardHtml, img, {
        src: post.image.src,
        alt: post.image.alt,
        srcset: null,
        sizes: null
      })
    )
  }

  // Every link in the card that pointed where the mapped link pointed now points to the post.
  const linkHolder =
    at(fields.link) ?? (card.tagName === 'a' ? card : find(card, (e) => e.tagName === 'a'))
  const link =
    linkHolder &&
    (linkHolder.tagName === 'a' ? linkHolder : find(linkHolder, (e) => e.tagName === 'a'))
  const original = link && attr(link, 'href')
  if (original !== undefined && original !== null) {
    const anchors: Element[] = card.tagName === 'a' ? [card] : []
    walk(card, (e) => {
      if (e.tagName === 'a') anchors.push(e)
    })
    for (const anchor of anchors) {
      if (attr(anchor, 'href') === original)
        patches.push(...attrPatches(cardHtml, anchor, { href: post.url }))
    }
  }
  return applyPatches(cardHtml, patches)
}

export interface ListPage {
  page: number
  total: number
  /** Site path of a given list page, e.g. /blog/ or /blog/page/2/ */
  urlOf: (page: number) => string
  /** Text for the pointed-at heading and the page title, e.g. "Blog" or "Tagged: Design". */
  heading: string
}

/**
 * Cards for `posts` in the page's own card design (or the simple built-in card),
 * and the element whose content they replace.
 */
function buildCards(
  source: string,
  document: ReturnType<typeof parseWithLocations>,
  layout: Pick<ListLayout, 'container' | 'card'>,
  posts: PostData[],
  context: PageContext,
  what: string
): { target: Element; html: string } {
  if (layout.card) {
    const card = required(
      resolveLocator(document, layout.card.element),
      layout.card.element,
      'post card'
    )
    const location = card.sourceCodeLocation!
    const template = source.slice(location.startOffset, location.endOffset)
    // The cards replace everything in the card's own parent (the grid).
    return {
      target: card.parentNode as Element,
      html: posts.map((post) => fillCard(template, layout.card!.fields, post, context)).join('\n')
    }
  }
  return {
    target: required(resolveLocator(document, layout.container), layout.container, what),
    html: posts.length
      ? `<div class="cp-cards">${posts.map((post) => defaultCard(post, context)).join('\n')}</div>`
      : '<p class="cp-empty">No posts yet.</p>'
  }
}

function withCardStyle(html: string): string {
  if (html.includes('id="cp-blog"')) return html
  const headEnd = html.search(/<\/head>/i)
  return headEnd >= 0
    ? html.slice(0, headEnd) + DEFAULT_CARD_STYLE + '\n' + html.slice(headEnd)
    : html
}

/**
 * The "latest posts" block of an existing page, updated in place: only the
 * pointed-at card area changes, the rest of the page stays byte-identical.
 */
export function renderLatest(
  pageSource: string,
  layout: LatestLayout,
  posts: PostData[],
  context: PageContext
): string {
  const document = parseWithLocations(pageSource)
  const { target, html } = buildCards(
    pageSource,
    document,
    layout,
    posts,
    context,
    'latest posts area'
  )
  const next = applyPatches(pageSource, [
    { ...innerRange(target, 'latest posts area'), text: html }
  ])
  return layout.card ? next : withCardStyle(next)
}

export function renderList(
  layoutSource: string,
  layoutPath: string,
  layout: ListLayout,
  posts: PostData[],
  paging: ListPage,
  context: PageContext
): string {
  const source = relocate(layoutSource, layoutPath)
  const document = parseWithLocations(source)
  const patches: Patch[] = []

  const built = buildCards(source, document, layout, posts, context, 'list area')
  const target = built.target
  let cardsHtml = built.html

  const headingElement = layout.heading ? resolveLocator(document, layout.heading) : null
  if (headingElement && !contains(target, headingElement)) {
    patches.push({ ...innerRange(headingElement, 'heading'), text: escapeText(paging.heading) })
  }

  const prev = paging.page > 1 ? paging.urlOf(paging.page - 1) : null
  const next = paging.page < paging.total ? paging.urlOf(paging.page + 1) : null
  const pagination = (className: string): string =>
    [
      prev ? `<a${className} rel="prev" href="${prev}">← Newer posts</a>` : '',
      paging.total > 1 ? `<span>Page ${paging.page} of ${paging.total}</span>` : '',
      next ? `<a${className} rel="next" href="${next}">Older posts →</a>` : ''
    ].join(' ')

  const paginationElement = layout.pagination ? resolveLocator(document, layout.pagination) : null
  if (paginationElement && paginationElement !== target) {
    const firstLink = find(paginationElement, (e) => e.tagName === 'a')
    const cls = firstLink && attr(firstLink, 'class')
    patches.push({
      ...innerRange(paginationElement, 'pagination'),
      text: pagination(cls ? ` class="${escapeAttr(cls)}"` : '')
    })
  } else if (paging.total > 1) {
    cardsHtml += `\n<nav class="cp-pagination" aria-label="Posts">${pagination('')}</nav>`
  }
  patches.push({ ...innerRange(target, 'list area'), text: cardsHtml })
  const keptParts = [target, paginationElement, headingElement].filter(
    (element): element is Element => Boolean(element)
  )
  patches.push(...trimPatches(document, keptParts, layout.remove, layout.keepOnly))

  let html = applyPatches(source, patches)
  if (!layout.card) html = withCardStyle(html)
  const url = paging.urlOf(paging.page)
  const seo = readSeo(html)
  const title = paging.page > 1 ? `${paging.heading} · page ${paging.page}` : paging.heading
  return writeSeo(html, {
    ...seo,
    title,
    canonical: context.baseUrl ? context.baseUrl + url : url,
    ogTitle: title
  })
}

// ---------- Finishing generated pages ----------

const STATE_CLASS = /^(is-)?(active|current)$|^current[-_]|[-_]current$|[-_]active$/

export interface HeadFinish {
  url: string
  ogType: 'article' | 'website'
  title: string
  description: string
  image?: string | null
  /** This page's own schema.org node (no @context); site-wide nodes of the layout are kept. */
  jsonLd?: Record<string, unknown> | null
  /** Raw tags added before </head> (stylesheet, feed link). */
  extraHead?: string[]
  /** Nav links to this path are marked current (e.g. the blog's list address). */
  currentPath?: string
  /** Site-wide JSON-LD (e.g. from the home page) for layouts that carry none of their own. */
  fallbackSiteNodes?: Record<string, unknown>[]
  baseUrl?: string
}

/**
 * Gives a generated page its own identity: og/twitter tags and page-specific
 * JSON-LD of the layout page would otherwise describe that page. Drops `noindex`,
 * and moves the navigation's "current item" state to the blog link.
 */
export function finishPage(html: string, finish: HeadFinish): string {
  const document = parseWithLocations(html)
  const head = find(document, (e) => e.tagName === 'head')
  const patches: Patch[] = []
  const inserts: string[] = []

  const metaBy = (key: 'name' | 'property', value: string): Element | null =>
    head ? find(head, (e) => e.tagName === 'meta' && attr(e, key) === value) : null
  const setMeta = (
    key: 'name' | 'property',
    name: string,
    value: string | null | undefined,
    add: boolean
  ): void => {
    if (!value) return
    const element = metaBy(key, name)
    if (element) patches.push(...attrPatches(html, element, { content: value }))
    else if (add) inserts.push(`<meta ${key}="${name}" content="${escapeAttr(value)}">`)
  }
  // The layout page's own article:* / craftpages:* / generator tags describe it, not this page;
  // the generator adds this page's ones through extraHead.
  if (head) {
    walk(head, (element) => {
      if (element.tagName !== 'meta' || !element.sourceCodeLocation) return true
      const property = attr(element, 'property') ?? ''
      const name = attr(element, 'name') ?? ''
      if (
        property.startsWith('article:') ||
        property === 'og:image:alt' ||
        name.startsWith('craftpages:') ||
        name === 'generator'
      ) {
        const { startOffset, endOffset } = element.sourceCodeLocation
        let end = endOffset
        if (html[end] === '\n') end++
        patches.push({ start: startOffset, end, text: '' })
      }
      return true
    })
  }
  setMeta('property', 'og:url', finish.url, true)
  setMeta('property', 'og:type', finish.ogType, true)
  setMeta('name', 'twitter:title', finish.title, false)
  setMeta('name', 'twitter:description', finish.description, false)
  setMeta('name', 'twitter:image', finish.image, false)
  setMeta('property', 'og:image', finish.image, true)

  const robots = metaBy('name', 'robots')
  const robotsValue = robots && attr(robots, 'content')
  if (robots && robotsValue && /noindex|nofollow/i.test(robotsValue)) {
    const cleaned = robotsValue
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part && !/^(noindex|nofollow|none)$/i.test(part))
      .join(', ')
    patches.push(...attrPatches(html, robots, { content: cleaned || 'index, follow' }))
  }

  // Structured data: site-wide nodes (Organization, WebSite…) stay; page-specific ones
  // (WebPage, Product, FAQ…) described the layout page and go. The page's own node is added.
  const siteNodes: Record<string, unknown>[] = []
  walk(document, (element) => {
    const location = element.sourceCodeLocation
    if (element.tagName === 'script' && /ld\+json/i.test(attr(element, 'type') ?? '') && location) {
      patches.push({ start: location.startOffset, end: location.endOffset, text: '' })
      siteNodes.push(...siteWideNodes(textContent(element)))
      return false
    }
    return true
  })
  if (!siteNodes.length && finish.fallbackSiteNodes) siteNodes.push(...finish.fallbackSiteNodes)
  if (finish.jsonLd || siteNodes.length) {
    const organization = siteNodes.find((node) => typesOf(node).some((t) => ORGANIZATION.has(t)))
    const page = finish.jsonLd && {
      ...finish.jsonLd,
      // Point at the site's organisation instead of repeating it.
      ...(organization?.['@id'] && 'publisher' in finish.jsonLd
        ? { publisher: { '@id': organization['@id'] } }
        : {})
    }
    const graph = [...siteNodes, ...(page ? [page] : [])]
    const data = { '@context': 'https://schema.org', '@graph': graph }
    inserts.push(
      `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`
    )
  }
  inserts.push(...(finish.extraHead ?? []))

  patches.push(...navPatches(html, document, finish))

  const headEnd = head?.sourceCodeLocation?.endTag?.startOffset
  if (headEnd !== undefined && inserts.length) {
    patches.push({ start: headEnd, end: headEnd, text: inserts.join('\n') + '\n' })
  }
  return applyPatches(html, patches)
}

/** Schema.org types that describe the whole site rather than one page. */
const ORGANIZATION = new Set(['Organization', 'Corporation', 'LocalBusiness', 'OnlineStore', 'NGO'])
const SITE_WIDE = new Set([...ORGANIZATION, 'WebSite', 'Person', 'Brand'])

function typesOf(node: Record<string, unknown>): string[] {
  const type = node['@type']
  return (Array.isArray(type) ? type : [type]).filter((t): t is string => typeof t === 'string')
}

/** Site-wide schema.org nodes (Organization, WebSite…) of a whole page. */
export function pageSiteNodes(html: string): Record<string, unknown>[] {
  const nodes: Record<string, unknown>[] = []
  for (const match of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  )) {
    nodes.push(...siteWideNodes(match[1]))
  }
  return nodes
}

function siteWideNodes(json: string): Record<string, unknown>[] {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    return []
  }
  const list = Array.isArray(data) ? data : [data]
  const nodes = list.flatMap((item) =>
    item && typeof item === 'object' && Array.isArray((item as { '@graph'?: unknown })['@graph'])
      ? ((item as { '@graph': unknown[] })['@graph'] as unknown[])
      : [item]
  )
  return nodes
    .filter((node): node is Record<string, unknown> => Boolean(node) && typeof node === 'object')
    .filter((node) => typesOf(node).some((t) => SITE_WIDE.has(t)))
    .map((node) => {
      const copy = { ...node }
      delete copy['@context']
      return copy
    })
}

/** Path of a link for comparison: /blog/, /blog/index.html and https://site/blog/ all match. */
function linkPath(href: string | undefined, baseUrl: string): string | null {
  if (!href || /^(#|mailto:|tel:|javascript:)/i.test(href.trim())) return null
  try {
    const base = baseUrl || 'http://craftpages.local'
    const url = new URL(href.trim(), base + '/')
    if (url.origin !== new URL(base).origin) return null
    return url.pathname.replace(/index\.html?$/, '').replace(/([^/])$/, '$1/')
  } catch {
    return null
  }
}

/**
 * Navigation on a generated page: the layout page's "current item" state is
 * cleared, and the link to the blog gets it instead, using the same classes and
 * aria-current the site uses for its own current item.
 */
function navPatches(
  html: string,
  document: ReturnType<typeof parseWithLocations>,
  finish: HeadFinish
): Patch[] {
  const navElements: Element[] = []
  walk(document, (element) => {
    if (element.tagName !== 'nav' && element.tagName !== 'header') return true
    walk(element, (inner) => {
      navElements.push(inner)
      return true
    })
    return false
  })

  // Learn how this site marks its current item.
  const linkState = new Set<string>()
  const wrapperState = new Set<string>()
  for (const element of navElements) {
    const state = (attr(element, 'class') ?? '').split(/\s+/).filter((c) => STATE_CLASS.test(c))
    state.forEach((c) => (element.tagName === 'a' ? linkState : wrapperState).add(c))
  }

  const current = new Set<Element>()
  const wrappers = new Set<Element>()
  if (finish.currentPath) {
    for (const element of navElements) {
      if (element.tagName !== 'a') continue
      if (linkPath(attr(element, 'href'), finish.baseUrl ?? '') !== finish.currentPath) continue
      current.add(element)
      const parent = element.parentNode as Element
      if (parent && 'tagName' in parent && navElements.includes(parent)) wrappers.add(parent)
    }
  }

  const patches: Patch[] = []
  for (const element of navElements) {
    if (!element.sourceCodeLocation?.startTag) continue
    const values: Record<string, string | null> = {}
    const classes = (attr(element, 'class') ?? '').split(/\s+/).filter(Boolean)
    const next = classes.filter((name) => !STATE_CLASS.test(name))
    if (current.has(element)) next.push(...linkState)
    if (wrappers.has(element)) next.push(...wrapperState)
    const joined = [...new Set(next)].join(' ')
    if (joined !== classes.join(' ')) values.class = joined || null
    const aria = attr(element, 'aria-current')
    if (current.has(element)) {
      if (aria !== 'page') values['aria-current'] = 'page'
    } else if (aria !== undefined) {
      values['aria-current'] = null
    }
    if (Object.keys(values).length) patches.push(...attrPatches(html, element, values))
  }
  return patches
}
