import { createHash } from 'crypto'
import { readFile, stat } from 'fs/promises'
import { join } from 'path'
import { parse } from 'parse5'
import {
  attr,
  children,
  isElement,
  textContent,
  type ChildNode,
  type Document,
  type Element
} from './dom'
import type { ComponentGroup } from '../../shared/types'

const SEMANTIC = new Set(['header', 'footer', 'nav', 'aside'])
const SECTION_TAGS = new Set(['section', 'div', 'form', 'article'])
/** Top-level sections smaller than this are too generic to count as a component. */
const MIN_DESCENDANTS = 6

/** Per-page state that differs between otherwise identical instances (e.g. the current menu item). */
const STATE_CLASSES = /^(is-)?(active|current|selected|open)$|^current[-_]/
const STATE_ATTRS = new Set(['aria-current', 'aria-selected', 'aria-expanded'])

function descendants(element: Element): number {
  return children(element).reduce((sum, child) => sum + 1 + descendants(child), 0)
}

/** Serialization with whitespace collapsed, attributes sorted and per-page state dropped. */
function normalize(node: ChildNode): string {
  if (node.nodeName === '#text') {
    return textContent(node).replace(/\s+/g, ' ').trim()
  }
  if (!isElement(node)) return ''
  const attrs = node.attrs
    .filter((a) => !STATE_ATTRS.has(a.name))
    .map((a) => {
      if (a.name !== 'class') return `${a.name}="${a.value}"`
      const classes = a.value.split(/\s+/).filter((name) => name && !STATE_CLASSES.test(name))
      return `class="${classes.sort().join(' ')}"`
    })
    .sort()
  const inner = node.childNodes.map(normalize).filter(Boolean).join('')
  return `<${node.tagName}${attrs.length ? ' ' + attrs.join(' ') : ''}>${inner}</${node.tagName}>`
}

function signature(element: Element): string {
  const id = attr(element, 'id')
  const classes = (attr(element, 'class') ?? '')
    .split(/\s+/)
    .filter((name) => name && !STATE_CLASSES.test(name))
  return element.tagName + (id ? `#${id}` : classes[0] ? `.${classes[0]}` : '')
}

function contains(element: Element, tag: string): boolean {
  return children(element).some((child) => child.tagName === tag || contains(child, tag))
}

function candidates(body: Element): Element[] {
  const found: Element[] = []
  const visit = (element: Element, topLevel: boolean): void => {
    // A page-wide wrapper (e.g. <div class="site"> around header/main/footer) is layout, not a
    // component: look through it.
    if (topLevel && !SEMANTIC.has(element.tagName) && contains(element, 'main')) {
      children(element).forEach((child) => visit(child, true))
      return
    }
    if (SEMANTIC.has(element.tagName)) found.push(element)
    else if (
      topLevel &&
      SECTION_TAGS.has(element.tagName) &&
      descendants(element) >= MIN_DESCENDANTS
    ) {
      found.push(element)
    }
    // Sections directly inside <main> count as top level too.
    children(element).forEach((child) => visit(child, topLevel && element.tagName === 'main'))
  }
  children(body).forEach((child) => visit(child, true))
  return found
}

const HEADINGS = new Set(['h1', 'h2', 'h3', 'h4'])

/** The first heading inside a block, to name it for people ("Section “About me”"). */
export function componentHeading(element: Element): string | undefined {
  const find = (node: Element): Element | undefined => {
    for (const child of children(node)) {
      if (HEADINGS.has(child.tagName)) return child
      const found = find(child)
      if (found) return found
    }
    return undefined
  }
  const heading = find(element)
  const text = heading && textContent(heading).replace(/\s+/g, ' ').trim()
  return text ? (text.length > 40 ? text.slice(0, 39) + '…' : text) : undefined
}

const hash = (text: string): string => createHash('sha1').update(text).digest('hex').slice(0, 12)

export const componentId = (signature: string): string => hash(signature)

function bodyOf(document: Document): Element | undefined {
  const html = document.childNodes.filter(isElement)[0]
  return html && children(html).find((element) => element.tagName === 'body')
}

/**
 * Component candidates of one page by signature. A signature that occurs more
 * than once on the same page (e.g. every `section.band`) can't identify one
 * block, so it's left out.
 */
export function pageComponents(document: Document): Map<string, Element> {
  const body = bodyOf(document)
  const found = new Map<string, Element>()
  const repeated = new Set<string>()
  for (const element of body ? candidates(body) : []) {
    const key = signature(element)
    if (found.has(key)) repeated.add(key)
    else found.set(key, element)
  }
  repeated.forEach((key) => found.delete(key))
  return found
}

interface PageScan {
  mtimeMs: number
  size: number
  entries: Map<string, { tag: string; fingerprint: string; preview: string; heading?: string }>
}

const scanCache = new Map<string, PageScan>()

async function scanPage(root: string, page: string): Promise<PageScan> {
  const full = join(root, page)
  const info = await stat(full)
  const key = `${root}\0${page}`
  const cached = scanCache.get(key)
  if (cached && cached.mtimeMs === info.mtimeMs && cached.size === info.size) return cached
  const entries: PageScan['entries'] = new Map()
  for (const [sig, element] of pageComponents(parse(await readFile(full, 'utf8')))) {
    entries.set(sig, {
      tag: element.tagName,
      fingerprint: hash(normalize(element)),
      heading: componentHeading(element),
      preview: textContent(element).replace(/\s+/g, ' ').trim().slice(0, 120)
    })
  }
  const scan = { mtimeMs: info.mtimeMs, size: info.size, entries }
  scanCache.set(key, scan)
  return scan
}

/**
 * Finds blocks repeated across pages (header, footer, nav, shared sections).
 * Identical instances share a fingerprint; instances with the same tag/id/class
 * but different content are listed as variants of one group.
 */
export async function scanComponents(root: string, pages: string[]): Promise<ComponentGroup[]> {
  const groups = new Map<
    string,
    { tag: string; preview: string; heading?: string; variants: Map<string, Set<string>> }
  >()

  for (const page of pages) {
    for (const [label, entry] of (await scanPage(root, page)).entries) {
      const group = groups.get(label) ?? {
        tag: entry.tag,
        preview: entry.preview,
        heading: entry.heading,
        variants: new Map()
      }
      group.variants.set(
        entry.fingerprint,
        (group.variants.get(entry.fingerprint) ?? new Set()).add(page)
      )
      groups.set(label, group)
    }
  }

  const result: ComponentGroup[] = []
  for (const [label, group] of groups) {
    const pagesWith = new Set([...group.variants.values()].flatMap((set) => [...set]))
    if (pagesWith.size < 2) continue
    // A generic section that matches by class alone but is never identical on two pages is
    // just a shared style, not a shared block. Header / footer / nav count even when they vary.
    const identicalSomewhere = [...group.variants.values()].some((set) => set.size > 1)
    if (!SEMANTIC.has(group.tag) && !identicalSomewhere) continue
    result.push({
      id: componentId(label),
      label,
      tag: group.tag,
      heading: group.heading,
      pages: [...pagesWith].sort(),
      variants: [...group.variants]
        .map(([fingerprint, set]) => ({ hash: fingerprint, pages: [...set].sort() }))
        .sort((a, b) => b.pages.length - a.pages.length),
      preview: group.preview
    })
  }
  return result.sort((a, b) => b.pages.length - a.pages.length || a.label.localeCompare(b.label))
}
