import {
  applyPatches,
  attr,
  attrPatches,
  children,
  escapeAttr,
  escapeText,
  find,
  isElement,
  parseWithLocations,
  textContent,
  type Element,
  type Patch
} from './dom'
import type { PageSeo } from '../../shared/types'

type MetaField = Exclude<keyof PageSeo, 'title'>

/** How each field is stored in `<head>`: which tag, which attribute identifies it, which holds the value. */
const FIELDS: Record<MetaField, { tag: string; key: string; name: string; value: string }> = {
  description: { tag: 'meta', key: 'name', name: 'description', value: 'content' },
  canonical: { tag: 'link', key: 'rel', name: 'canonical', value: 'href' },
  robots: { tag: 'meta', key: 'name', name: 'robots', value: 'content' },
  ogTitle: { tag: 'meta', key: 'property', name: 'og:title', value: 'content' },
  ogDescription: { tag: 'meta', key: 'property', name: 'og:description', value: 'content' },
  ogImage: { tag: 'meta', key: 'property', name: 'og:image', value: 'content' }
}

function headOf(source: string): Element {
  const html = parseWithLocations(source).childNodes.filter(isElement)[0]
  const head = html && children(html).find((element) => element.tagName === 'head')
  if (!head) throw new Error('This page has no <head>')
  return head
}

function findField(head: Element, field: MetaField): Element | null {
  const spec = FIELDS[field]
  return find(
    head,
    (element) =>
      element.tagName === spec.tag &&
      (attr(element, spec.key) ?? '').toLowerCase().split(/\s+/).includes(spec.name)
  )
}

export function readSeo(source: string): PageSeo {
  const head = headOf(source)
  const title = find(head, (element) => element.tagName === 'title')
  const seo = { title: title ? textContent(title).trim() : '' } as PageSeo
  for (const field of Object.keys(FIELDS) as MetaField[]) {
    const element = findField(head, field)
    seo[field] = element ? (attr(element, FIELDS[field].value) ?? '') : ''
  }
  return seo
}

/** Patches `<head>` in place: changes existing tags, adds missing ones, removes emptied ones. */
export function writeSeo(source: string, seo: PageSeo): string {
  const head = headOf(source)
  const current = readSeo(source)
  const patches: Patch[] = []
  const additions: string[] = []

  if (seo.title !== current.title) {
    const title = find(head, (element) => element.tagName === 'title')
    const location = title?.sourceCodeLocation
    if (location?.startTag && location.endTag) {
      patches.push({
        start: location.startTag.endOffset,
        end: location.endTag.startOffset,
        text: escapeText(seo.title)
      })
    } else if (!title && seo.title) {
      additions.push(`<title>${escapeText(seo.title)}</title>`)
    }
  }

  for (const field of Object.keys(FIELDS) as MetaField[]) {
    const value = seo[field].trim()
    if (value === current[field]) continue
    const spec = FIELDS[field]
    const element = findField(head, field)
    const location = element?.sourceCodeLocation
    if (element && location) {
      if (value) {
        patches.push(...attrPatches(source, element, { [spec.value]: value }))
      } else {
        // Remove the tag and the line break after it.
        let end = location.endOffset
        if (source[end] === '\r') end++
        if (source[end] === '\n') end++
        let start = location.startOffset
        while (start > 0 && /[ \t]/.test(source[start - 1])) start--
        patches.push({ start, end, text: '' })
      }
    } else if (value) {
      additions.push(
        `<${spec.tag} ${spec.key}="${spec.name}" ${spec.value}="${escapeAttr(value)}">`
      )
    }
  }

  if (additions.length > 0) {
    const location = head.sourceCodeLocation
    const lastChild = [...head.childNodes].reverse().find((node) => node.sourceCodeLocation)
    const at = location?.endTag?.startOffset ?? lastChild?.sourceCodeLocation?.endOffset
    if (at === undefined) throw new Error('Could not find where <head> ends')
    // Match the indentation of the head's last tag, inserting on its own line when `</head>` is.
    const lastElement = [...children(head)].reverse()[0]
    const indentOf = (offset: number): string =>
      source.slice(source.lastIndexOf('\n', offset - 1) + 1, offset).match(/^[ \t]*/)![0]
    const childIndent = lastElement?.sourceCodeLocation
      ? indentOf(lastElement.sourceCodeLocation.startOffset)
      : ''
    const lineStart = source.lastIndexOf('\n', at - 1) + 1
    const ownLine = /^[ \t]*$/.test(source.slice(lineStart, at))
    const text = additions.map((line) => `${childIndent}${line}\n`).join('')
    const start = ownLine ? lineStart : at
    patches.push({ start, end: start, text })
  }

  return applyPatches(source, patches)
}
