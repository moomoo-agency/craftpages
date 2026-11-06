import { readFile } from 'fs/promises'
import { posix } from 'path'
import { writeFiles } from './history'
import {
  applyPatches,
  attr,
  children,
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
import { getSiteSettings } from './settings'
import { NOT_FOUND_PAGE, syncServerRules } from './redirects-site'
import { resolveInWorkspace } from './workspace'
import type { NotFoundOptions, NotFoundState } from '../shared/types'

/**
 * The 404 page: made once from one of the site's pages, so it has the site's header,
 * footer and styles, then edited like any other page. Cloudflare serves 404.html by
 * itself; for a server, `.htaccess` gets `ErrorDocument 404` (see redirects-site).
 *
 * The page is served at any address (/a/b/c), so every relative address taken from the
 * source page becomes root-absolute, and what describes the source page to search
 * engines and social networks (description, canonical, og:*, structured data) is left out.
 */

const LOADER_SRC = /(^|\/)craftpages-search\.js([?#]|$)/
const LANDMARK = new Set(['header', 'nav', 'footer'])
const LANDMARK_ROLE = /^(banner|navigation|contentinfo)$/
const SHARED_NAME =
  /(^|[\s_-])(header|footer|nav|navbar|navigation|menu|topbar|masthead)([\s_-]|$)/i
const KEEP = new Set(['script', 'noscript', 'template', 'style', 'link'])

async function readSite(root: string, path: string): Promise<string | null> {
  return readFile(resolveInWorkspace(root, path), 'utf8').catch(() => null)
}

export async function notFoundState(root: string): Promise<NotFoundState> {
  const site = await getSiteSettings(root)
  const page = await readSite(root, NOT_FOUND_PAGE)
  const htaccess = (await readSite(root, '.htaccess')) ?? ''
  const titleMatch = page?.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return {
    exists: page !== null,
    title: titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : '',
    target: site.deploy.target,
    serverReady: site.deploy.target !== 'server' || /ErrorDocument\s+404\s/.test(htaccess)
  }
}

/** Whether an element is part of the site's frame (header, menu, footer), kept as it is. */
function isFrame(element: Element): boolean {
  if (LANDMARK.has(element.tagName) || KEEP.has(element.tagName)) return true
  if (LANDMARK_ROLE.test(attr(element, 'role') ?? '')) return true
  return SHARED_NAME.test(`${attr(element, 'id') ?? ''} ${attr(element, 'class') ?? ''}`)
}

/** The element whose children are the page's blocks: past wrappers holding everything. */
function container(body: Element): Element {
  let current = body
  for (;;) {
    const blocks = children(current).filter((e) => !KEEP.has(e.tagName))
    if (blocks.length !== 1 || isFrame(blocks[0]) || blocks[0].tagName === 'main') return current
    current = blocks[0]
  }
}

const ABSOLUTE = /^([a-z][a-z0-9+.-]*:|\/|#|\{|\$)/i

function absolute(value: string, from: string): string {
  const trimmed = value.trim()
  if (!trimmed || ABSOLUTE.test(trimmed)) return value
  const joined = posix.normalize(posix.join(posix.dirname('/' + from), trimmed))
  return trimmed.endsWith('/') && !joined.endsWith('/') ? joined + '/' : joined
}

function absoluteSrcset(value: string, from: string): string {
  return value
    .split(',')
    .map((part) => {
      const [url, ...rest] = part.trim().split(/\s+/)
      return [absolute(url, from), ...rest].join(' ')
    })
    .join(', ')
}

const URL_ATTRS = ['href', 'src', 'poster', 'action', 'data-src']

/** Builds 404.html from a page of the site. */
export function notFoundHtml(source: string, from: string, options: NotFoundOptions): string {
  const document = parseWithLocations(source)
  const head = find(document, (e) => e.tagName === 'head')
  const body = find(document, (e) => e.tagName === 'body')
  if (!head || !body) throw new Error(`${from} has no <head> or <body> to work from.`)

  const removed: [number, number][] = []
  const patches: Patch[] = []
  const remove = (element: Element): void => {
    const location = element.sourceCodeLocation!
    let start = location.startOffset
    while (start > 0 && /[ \t]/.test(source[start - 1])) start--
    const end = source[location.endOffset] === '\n' ? location.endOffset + 1 : location.endOffset
    removed.push([start, end])
    patches.push({ start, end, text: '' })
  }
  const inRemoved = (offset: number): boolean =>
    removed.some(([start, end]) => offset >= start && offset < end)

  // Head: the new title; nothing that describes the source page; noindex.
  let hasTitle = false
  for (const element of children(head)) {
    const name = (attr(element, 'name') ?? '').toLowerCase()
    const property = (attr(element, 'property') ?? '').toLowerCase()
    const rel = (attr(element, 'rel') ?? '').toLowerCase()
    if (element.tagName === 'title' && element.sourceCodeLocation?.startTag) {
      hasTitle = true
      const { startTag, endTag } = element.sourceCodeLocation
      patches.push({
        start: startTag.endOffset,
        end: endTag?.startOffset ?? startTag.endOffset,
        text: escapeText(options.title)
      })
    } else if (
      (element.tagName === 'meta' &&
        (['description', 'robots', 'keywords'].includes(name) ||
          name.startsWith('twitter:') ||
          name.startsWith('craftpages:') ||
          property.startsWith('og:') ||
          property.startsWith('article:'))) ||
      (element.tagName === 'link' &&
        (rel === 'canonical' || (rel === 'alternate' && attr(element, 'hreflang')))) ||
      (element.tagName === 'script' && /ld\+json/i.test(attr(element, 'type') ?? ''))
    ) {
      remove(element)
    }
  }
  const headEnd = head.sourceCodeLocation!.endTag!.startOffset
  patches.push({
    start: headEnd,
    end: headEnd,
    text:
      (hasTitle ? '' : `  <title>${escapeText(options.title)}</title>\n`) +
      '  <meta name="robots" content="noindex">\n'
  })

  // Body: the site's frame stays; the page's own content gives way to the message.
  const search = Boolean(
    find(document, (e) => e.tagName === 'script' && LOADER_SRC.test(attr(e, 'src') ?? ''))
  )
  const message = [
    `<h1>${escapeText(options.heading)}</h1>`,
    `<p>${escapeText(options.message)}</p>`,
    `<p><a href="/">${escapeText(options.linkText)}</a></p>`,
    search && options.searchText
      ? `<p><button type="button" data-craftpages-search>${escapeText(options.searchText)}</button></p>`
      : ''
  ]
    .filter(Boolean)
    .join('\n      ')
  const section = `<section class="craftpages-not-found" style="padding:12vh 1.5rem;text-align:center">\n      ${message}\n    </section>`
  const main = find(body, (e) => e.tagName === 'main')
  if (main?.sourceCodeLocation?.startTag && main.sourceCodeLocation.endTag) {
    const start = main.sourceCodeLocation.startTag.endOffset
    const end = main.sourceCodeLocation.endTag.startOffset
    removed.push([start, end])
    patches.push({ start, end, text: `\n    ${section}\n  ` })
  } else {
    const holder = container(body)
    const blocks = children(holder)
    let insertAt: number | null = null
    let seenContent = false
    for (const element of blocks) {
      if (isFrame(element)) {
        // The message goes after the last frame part above the content (header, menu).
        if (!seenContent && !KEEP.has(element.tagName))
          insertAt = element.sourceCodeLocation!.endOffset
        continue
      }
      if (!seenContent && insertAt === null) {
        let start = element.sourceCodeLocation!.startOffset
        while (start > 0 && /[ \t]/.test(source[start - 1])) start--
        insertAt = start
      }
      seenContent = true
      remove(element)
    }
    // Text between blocks (stray words) goes too.
    for (const node of holder.childNodes) {
      if (!isElement(node) && node.nodeName === '#text' && textContent(node).trim()) {
        const location = (
          node as { sourceCodeLocation?: { startOffset: number; endOffset: number } }
        ).sourceCodeLocation
        if (location && !inRemoved(location.startOffset)) {
          // Only the words: the spaces around them belong to the neighbours' lines.
          const text = source.slice(location.startOffset, location.endOffset)
          const start = location.startOffset + (text.length - text.trimStart().length)
          const end = location.endOffset - (text.length - text.trimEnd().length)
          removed.push([start, end])
          patches.push({ start, end, text: '' })
        }
      }
    }
    const at = insertAt ?? holder.sourceCodeLocation!.startTag!.endOffset
    patches.push({ start: at, end: at, text: `\n  <main>\n    ${section}\n  </main>\n` })
  }

  // Every address that stays becomes root-absolute: the page answers at any depth.
  walk(document, (element) => {
    const location = element.sourceCodeLocation
    if (!location || inRemoved(location.startOffset)) return false
    for (const name of [...URL_ATTRS, 'srcset']) {
      const value = attr(element, name)
      const at = location.attrs?.[name]
      if (value === undefined || !at) continue
      const next = name === 'srcset' ? absoluteSrcset(value, from) : absolute(value, from)
      if (next !== value)
        patches.push({
          start: at.startOffset,
          end: at.endOffset,
          text: `${name}="${escapeAttr(next)}"`
        })
    }
    return true
  })

  return applyPatches(source, patches)
}

export async function createNotFound(root: string, options: NotFoundOptions): Promise<string> {
  const from = options.from.replace(/^\/+/, '')
  const source = await readSite(root, from)
  if (source === null) throw new Error(`${from} isn’t in the site folder.`)
  const html = notFoundHtml(source, from, options)
  const id = await writeFiles(root, [{ path: NOT_FOUND_PAGE, content: html }], '404 page')
  await syncServerRules(root)
  return id
}
