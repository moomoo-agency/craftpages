import { parse, type DefaultTreeAdapterMap } from 'parse5'

export type Document = DefaultTreeAdapterMap['document']
export type Element = DefaultTreeAdapterMap['element']
export type ChildNode = DefaultTreeAdapterMap['childNode']
export type ParentNode = DefaultTreeAdapterMap['parentNode']

export interface Patch {
  start: number
  end: number
  text: string
}

/** Parses with source offsets. The offsets index into the same string that was passed in. */
export function parseWithLocations(html: string): Document {
  return parse(html, { sourceCodeLocationInfo: true })
}

export function isElement(node: { nodeName: string }): node is Element {
  return 'tagName' in node
}

export function children(node: ParentNode): Element[] {
  return node.childNodes.filter(isElement)
}

/** Depth-first walk. Return `false` from the visitor to skip an element's children. */
export function walk(node: ParentNode, visit: (element: Element) => boolean | void): void {
  for (const child of node.childNodes) {
    if (!isElement(child)) continue
    if (visit(child) === false) continue
    walk('content' in child ? (child.content as ParentNode) : child, visit)
  }
}

export function find(node: ParentNode, match: (element: Element) => boolean): Element | null {
  let found: Element | null = null
  walk(node, (element) => {
    if (found) return false
    if (match(element)) {
      found = element
      return false
    }
    return true
  })
  return found
}

export function attr(element: Element, name: string): string | undefined {
  return element.attrs.find((a) => a.name === name)?.value
}

export function textContent(node: ChildNode | ParentNode): string {
  if (node.nodeName === '#text') return (node as DefaultTreeAdapterMap['textNode']).value
  if (!('childNodes' in node)) return ''
  return node.childNodes.map((child) => textContent(child)).join('')
}

/** Replaces `[start, end)` ranges, working from the end so earlier offsets stay valid. */
export function applyPatches(source: string, patches: Patch[]): string {
  const sorted = [...patches].sort((a, b) => a.start - b.start || a.end - b.end)
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].start < sorted[i - 1].end) {
      throw new Error('Two edits overlap in the same part of the file')
    }
  }
  let out = source
  for (let i = sorted.length - 1; i >= 0; i--) {
    const { start, end, text } = sorted[i]
    out = out.slice(0, start) + text + out.slice(end)
  }
  return out
}

export function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

export function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Offset where a new attribute can be inserted into an element's start tag. */
export function attrInsertOffset(source: string, element: Element): number {
  const tag = element.sourceCodeLocation!.startTag!
  let end = tag.endOffset - 1 // the '>'
  if (source[end - 1] === '/') end -= 1
  while (end > tag.startOffset && /\s/.test(source[end - 1])) end -= 1
  return end
}

/** Offset just after the tag name in an element's start tag. */
export function tagNameEndOffset(element: Element): number {
  return element.sourceCodeLocation!.startTag!.startOffset + 1 + element.tagName.length
}

/**
 * Patches that set (or with `null`, remove) attributes on an element, keeping
 * every other byte of the start tag as it was.
 */
export function attrPatches(
  source: string,
  element: Element,
  values: Record<string, string | null>
): Patch[] {
  const locations = element.sourceCodeLocation?.attrs ?? {}
  const patches: Patch[] = []
  let inserts = ''
  for (const [name, value] of Object.entries(values)) {
    if (!/^[a-z][a-z0-9_:.-]*$/.test(name) || name.startsWith('on')) {
      throw new Error(`Attribute not allowed: ${name}`)
    }
    const location = locations[name]
    if (location) {
      if (value === null) {
        let start = location.startOffset
        while (start > 0 && /\s/.test(source[start - 1])) start -= 1
        patches.push({ start, end: location.endOffset, text: '' })
      } else {
        patches.push({
          start: location.startOffset,
          end: location.endOffset,
          text: `${name}="${escapeAttr(value)}"`
        })
      }
    } else if (value !== null) {
      inserts += ` ${name}="${escapeAttr(value)}"`
    }
  }
  if (inserts) {
    const at = attrInsertOffset(source, element)
    patches.push({ start: at, end: at, text: inserts })
  }
  return patches
}
