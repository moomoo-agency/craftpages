import { parseFragment, serialize } from 'parse5'
import {
  applyPatches,
  attr,
  attrPatches,
  children,
  isElement,
  parseWithLocations,
  tagNameEndOffset,
  textContent,
  walk,
  type Document,
  type Element,
  type ParentNode,
  type Patch
} from './dom'
import type { ListEdits, NodeChange } from '../../shared/types'

/** Elements whose text can be edited when they contain only phrasing content. */
const TEXT_TAGS = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'a', 'button', 'span', 'figcaption', 'td',
  'th', 'blockquote', 'label', 'dt', 'dd', 'small', 'strong', 'em', 'b', 'summary', 'caption',
  'legend', 'cite', 'time'
]) // prettier-ignore

/** Inline markup allowed inside an editable element (and in what the editor sends back). */
export const PHRASING = new Set([
  'a', 'abbr', 'b', 'bdi', 'bdo', 'br', 'cite', 'code', 'data', 'dfn', 'em', 'i', 'kbd',
  'mark', 'q', 's', 'samp', 'small', 'span', 'strong', 'sub', 'sup', 'time', 'u', 'var', 'wbr'
]) // prettier-ignore

export interface EditableNode {
  id: number
  kind: 'text' | 'image'
  element: Element
}

/** A run of sibling elements with the same shape: cards, team members, list items. */
export interface RepeatingList {
  id: string
  container: Element
  items: Element[]
}

/** A page parsed for editing. Node ids are stable for the same source text. */
export interface Analysis {
  document: Document
  nodes: Map<number, EditableNode>
  idOf: Map<Element, number>
  /** Lists whose items can be added, removed and reordered, by id. */
  lists: Map<string, RepeatingList>
  /** For the served copy: ids on editable nodes, page scripts removed. */
  patches: Patch[]
  headEnd?: number
}

function onlyPhrasing(element: ParentNode): boolean {
  return element.childNodes.every(
    (child) => !isElement(child) || (PHRASING.has(child.tagName) && onlyPhrasing(child))
  )
}

function isTextEditable(element: Element): boolean {
  const location = element.sourceCodeLocation
  return (
    TEXT_TAGS.has(element.tagName) &&
    // Implied tags (no start or end tag in the file) have no range to patch.
    Boolean(location?.startTag && location.endTag) &&
    textContent(element).trim() !== '' &&
    onlyPhrasing(element)
  )
}

/**
 * Finds the editable nodes of a page. Nothing here touches the file: ids exist
 * only in the served copy, and saves map them back to source offsets.
 */
export function analyze(source: string): Analysis {
  const document = parseWithLocations(source)
  const nodes = new Map<number, EditableNode>()
  const idOf = new Map<Element, number>()
  const patches: Patch[] = []
  let next = 1

  const mark = (element: Element, kind: EditableNode['kind']): void => {
    const id = next++
    nodes.set(id, { id, kind, element })
    idOf.set(element, id)
    const at = tagNameEndOffset(element)
    patches.push({ start: at, end: at, text: ` data-cms-id="${id}"` })
  }

  walk(document, (element) => {
    const location = element.sourceCodeLocation
    if (element.tagName === 'script' && location?.endTag) {
      // Page scripts would change the DOM under the editor; JSON-LD is inert, keep it.
      if (!/json/i.test(attr(element, 'type') ?? '')) {
        patches.push({ start: location.startOffset, end: location.endOffset, text: '' })
      }
      return false
    }
    if (
      element.tagName === 'meta' &&
      /content-security-policy/i.test(attr(element, 'http-equiv') ?? '')
    ) {
      if (location) patches.push({ start: location.startOffset, end: location.endOffset, text: '' })
      return false
    }
    if (element.tagName === 'img' && location?.startTag) {
      mark(element, 'image')
      return false
    }
    if (isTextEditable(element)) {
      mark(element, 'text')
      return false
    }
    return true
  })

  const head = document.childNodes
    .filter(isElement)
    .flatMap((html) => html.childNodes.filter(isElement))
    .find((element) => element.tagName === 'head')
  return {
    document,
    nodes,
    idOf,
    lists: findLists(document, idOf),
    patches,
    headEnd: head?.sourceCodeLocation?.endTag?.startOffset
  }
}

// ---------- Repeating lists ----------

/** Classes that mark one item's state (the current tab, an open card), not its kind. */
const STATE_CLASS = /^(active|current|selected|open|is-.+|has-.+|js-.+)$/

/** What makes siblings "the same kind of item": the tag and its classes. */
const itemKey = (element: Element): string =>
  [
    element.tagName,
    ...(attr(element, 'class') ?? '')
      .split(/\s+/)
      .filter((name) => name && !STATE_CLASS.test(name))
      .sort()
  ].join('.')

/** Never lists: document structure, form controls and graphics. */
const NOT_A_LIST = new Set([
  'html', 'head', 'body', 'select', 'datalist', 'optgroup', 'svg', 'picture', 'video', 'audio',
  'table', 'thead', 'colgroup', 'tr', 'script', 'template', 'noscript', 'iframe', 'map', 'form'
]) // prettier-ignore

const hasContent = (element: Element, idOf: Map<Element, number>): boolean => {
  let found = idOf.has(element)
  walk(element, (child) => {
    if (idOf.has(child)) found = true
    return !found
  })
  return found
}

/**
 * Finds repeating lists: an element whose children (two or more) are all the
 * same kind of item with editable text or images inside. Only these can have
 * items added, removed or moved; everything else keeps its structure.
 */
function findLists(document: Document, idOf: Map<Element, number>): Map<string, RepeatingList> {
  const lists = new Map<string, RepeatingList>()
  const visit = (element: Element): void => {
    const items = children(element)
    const location = element.sourceCodeLocation
    if (
      !NOT_A_LIST.has(element.tagName) &&
      items.length >= 2 &&
      location?.startTag &&
      location.endTag &&
      items.every((item) => item.sourceCodeLocation?.startTag && item.sourceCodeLocation.endTag) &&
      new Set(items.map(itemKey)).size === 1 &&
      items.every((item) => hasContent(item, idOf))
    ) {
      const id = `L${lists.size + 1}`
      lists.set(id, { id, container: element, items })
    }
    if (element.tagName === 'svg' || element.tagName === 'template') return
    items.forEach(visit)
  }
  children(document as unknown as Element).forEach(visit)
  return lists
}

/** Tags and attributes a new list item may not carry (it's a copy of an item on the page). */
const BLOCKED_TAGS = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'template',
  'link',
  'meta',
  'base'
])
const URL_ATTRS = new Set(['href', 'src', 'action', 'formaction', 'poster', 'xlink:href'])

/** Cleans a new item's HTML (from the editor): no scripts, handlers or editor markers. */
export function sanitizeItem(html: string): string {
  const fragment = parseFragment(html)
  const clean = (node: ParentNode): void => {
    node.childNodes = node.childNodes.filter((child) => {
      if (!isElement(child)) return true
      if (BLOCKED_TAGS.has(child.tagName)) return false
      child.attrs = child.attrs.filter(
        (a) =>
          !a.name.startsWith('on') &&
          !a.name.startsWith('data-cms') &&
          a.name !== 'contenteditable' &&
          a.name !== 'spellcheck' &&
          !(URL_ATTRS.has(a.name) && !SAFE_URL.test(a.value.trim())) &&
          !(a.name === 'srcset' && /javascript:/i.test(a.value))
      )
      clean(child)
      return true
    })
  }
  clean(fragment)
  const items = fragment.childNodes.filter(isElement)
  if (items.length !== 1) throw new Error('A new list item must be a single element')
  return serialize(fragment).trim()
}

/**
 * Turns node edits plus list edits into patches. An edited list is written as
 * one patch over its inside: the items it keeps are copied byte for byte from
 * the file (with the edits made inside them), new items are inserted, and the
 * original whitespace between items is reused.
 */
export function editPatches(
  source: string,
  analysis: Analysis,
  changes: NodeChange[],
  lists: ListEdits = {}
): Patch[] {
  let patches = changesToPatches(source, analysis.nodes, changes)
  // Inner lists first, so a moved outer item carries its inner list's changes along.
  const byDepth = Object.entries(lists).sort(
    ([a], [b]) =>
      (analysis.lists.get(b)?.container.sourceCodeLocation?.startOffset ?? 0) -
      (analysis.lists.get(a)?.container.sourceCodeLocation?.startOffset ?? 0)
  )
  for (const [id, order] of byDepth) {
    const list = analysis.lists.get(id)
    if (!list) throw new Error('A list on this page changed; reload the page and try again')
    const unchanged =
      order.length === list.items.length &&
      order.every((item, i) => item.from === i && item.html === undefined)
    if (unchanged) continue
    if (!order.length) throw new Error('A list needs at least one item')

    const range = (element: Element): [number, number] => [
      element.sourceCodeLocation!.startOffset,
      element.sourceCodeLocation!.endOffset
    ]
    const innerStart = list.container.sourceCodeLocation!.startTag!.endOffset
    const innerEnd = list.container.sourceCodeLocation!.endTag!.startOffset
    const spans = list.items.map(range)
    const inside = patches.filter((p) => p.start >= innerStart && p.end <= innerEnd)
    patches = patches.filter((p) => !inside.includes(p))

    const itemText = (index: number): string => {
      const [start, end] = spans[index]
      const own = inside
        .filter((p) => p.start >= start && p.end <= end)
        .map((p) => ({ ...p, start: p.start - start, end: p.end - start }))
      return applyPatches(source.slice(start, end), own)
    }
    const gaps = spans.slice(1).map(([start], i) => source.slice(spans[i][1], start))
    const pieces = order.map((item) => {
      if (!Number.isInteger(item.from) || item.from < 0 || item.from >= list.items.length)
        throw new Error('Unknown list item; reload the page and try again')
      return item.html === undefined ? itemText(item.from) : sanitizeItem(item.html)
    })
    const text =
      source.slice(innerStart, spans[0][0]) +
      pieces
        .map((piece, i) => (i === 0 ? '' : gaps[Math.min(i - 1, gaps.length - 1)]) + piece)
        .join('') +
      source.slice(spans[spans.length - 1][1], innerEnd)
    patches.push({ start: innerStart, end: innerEnd, text })
  }
  return patches
}

/** The copy served to the editor iframe, with shared components marked by id. */
export function serveCopy(
  source: string,
  analysis: Analysis,
  editorScript: string,
  components: Map<Element, string>
): string {
  const patches = [...analysis.patches]
  for (const [element, id] of components) {
    if (!element.sourceCodeLocation?.startTag) continue
    // Right after the tag name too; sort order keeps it apart from a data-cms-id insert.
    const at = tagNameEndOffset(element)
    patches.push({ start: at, end: at, text: ` data-cms-component="${id}"` })
  }
  // Lists inside shared components keep their structure: an edit there would have to reach every page.
  const inComponent = (element: Element): boolean => {
    for (let node: ParentNode | null = element; node; node = (node as Element).parentNode ?? null) {
      if (components.has(node as Element)) return true
    }
    return false
  }
  for (const list of analysis.lists.values()) {
    if (inComponent(list.container)) continue
    const at = tagNameEndOffset(list.container)
    patches.push({ start: at, end: at, text: ` data-cms-list="${list.id}"` })
    list.items.forEach((item, index) => {
      const itemAt = tagNameEndOffset(item)
      patches.push({ start: itemAt, end: itemAt, text: ` data-cms-item="${index}"` })
    })
  }
  const inject = `<script src="${editorScript}"></script>`
  if (analysis.headEnd !== undefined) {
    patches.push({ start: analysis.headEnd, end: analysis.headEnd, text: inject })
  }
  const served = applyPatches(source, patches)
  return analysis.headEnd === undefined ? inject + served : served
}

// ---------- Saving ----------

const SAFE_URL = /^(https?:|mailto:|tel:|#|\/|\.\/|\.\.\/|[\w-]+(\/|\.|$))/i

/** Keeps inline markup only, and drops event handlers and script URLs. */
export function sanitizeInline(html: string): string {
  const fragment = parseFragment(html)
  const clean = (node: ParentNode): void => {
    node.childNodes = node.childNodes.flatMap((child) => {
      if (child.nodeName === '#comment') return []
      if (!isElement(child)) return [child]
      if (['script', 'style', 'template', 'iframe', 'object'].includes(child.tagName)) return []
      clean(child)
      if (!PHRASING.has(child.tagName)) {
        child.childNodes.forEach((grandchild) => (grandchild.parentNode = node))
        return child.childNodes
      }
      child.attrs = child.attrs.filter((a) => {
        if (
          a.name.startsWith('on') ||
          a.name.startsWith('data-cms') ||
          a.name === 'contenteditable'
        ) {
          return false
        }
        if ((a.name === 'href' || a.name === 'src') && !SAFE_URL.test(a.value.trim())) return false
        return true
      })
      return [child]
    })
  }
  clean(fragment)
  return serialize(fragment)
}

export function changesToPatches(
  source: string,
  nodes: Map<number, EditableNode>,
  changes: NodeChange[]
): Patch[] {
  const patches: Patch[] = []
  for (const change of changes) {
    const node = nodes.get(Number(change.id))
    if (!node) throw new Error(`Unknown element ${change.id}; reload the page and try again`)
    const location = node.element.sourceCodeLocation!
    if (change.html !== undefined) {
      if (node.kind !== 'text') throw new Error('Only text elements take new content')
      patches.push({
        start: location.startTag!.endOffset,
        end: location.endTag!.startOffset,
        text: sanitizeInline(change.html)
      })
    }
    if (change.attrs && Object.keys(change.attrs).length > 0) {
      if (change.attrs.src && !SAFE_URL.test(change.attrs.src)) throw new Error('Invalid image URL')
      if (change.attrs.href && !SAFE_URL.test(change.attrs.href))
        throw new Error('Invalid link URL')
      patches.push(...attrPatches(source, node.element, change.attrs))
    }
  }
  return patches
}
