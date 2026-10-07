import { readFile } from 'fs/promises'
import { previewServer, serveCopyOf } from './editing'
import {
  applyPatches,
  attr,
  find,
  parseWithLocations,
  tagNameEndOffset,
  textContent,
  walk,
  type Document,
  type Element,
  type Patch
} from './html/dom'
import { bodyOf, locatorOf, pathFrom, resolveLocator } from './html/locator'
import { POINTER_SCRIPT_PATH } from './preview/server'
import { badgesIn } from './blog-render'
import { requireRoot } from './state'
import { resolveInWorkspace } from './workspace'
import type { ElementLocator, PickedElement, PointSession } from '../shared/types'

/**
 * Pointing mode: a page is served with every element in <body> numbered
 * (`data-cms-el`), page scripts removed, and a small script that reports what
 * the user clicks. Numbers map back to elements of the file's own parse, so a
 * pick becomes a locator into the real source.
 */

interface Session {
  document: Document
  body: Element
  elements: Map<number, Element>
  numberOf: Map<Element, number>
}

const sessions = new Map<string, Session>()

export async function startPointing(path: string): Promise<PointSession> {
  const root = requireRoot()
  const source = await readFile(resolveInWorkspace(root, path), 'utf8')
  const document = parseWithLocations(source)
  const body = bodyOf(document)
  if (!body) throw new Error(`${path} has no <body>`)

  const elements = new Map<number, Element>()
  const numberOf = new Map<Element, number>()
  const patches: Patch[] = []
  let next = 1
  walk(document, (element) => {
    const location = element.sourceCodeLocation
    if (element.tagName === 'script' && location?.endTag) {
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
    if (location?.startTag && pathFrom(body, element) && element !== body) {
      const n = next++
      elements.set(n, element)
      numberOf.set(element, n)
      const at = tagNameEndOffset(element)
      patches.push({ start: at, end: at, text: ` data-cms-el="${n}"` })
    }
    return true
  })

  const headEnd = find(document, (e) => e.tagName === 'head')?.sourceCodeLocation?.endTag
    ?.startOffset
  const inject = `<script src="${(await previewServer()).origin}${POINTER_SCRIPT_PATH}"></script>`
  if (headEnd !== undefined) patches.push({ start: headEnd, end: headEnd, text: inject })
  const served = (headEnd === undefined ? inject : '') + applyPatches(source, patches)

  const { key, url } = await serveCopyOf(path, served)
  sessions.set(key, { document, body, elements, numberOf })
  while (sessions.size > 10) sessions.delete(sessions.keys().next().value!)
  return { key, url }
}

function session(key: string): Session {
  const found = sessions.get(key)
  if (!found) throw new Error('This pointing session has expired. Reopen the page.')
  return found
}

export function pointAt(key: string, n: number): PickedElement {
  const { body, elements, numberOf } = session(key)
  const element = elements.get(n)
  if (!element) throw new Error('Unknown element')
  const parent = element.parentNode as Element
  return {
    n,
    locator: locatorOf(body, element),
    tag: element.tagName,
    text: textContent(element).replace(/\s+/g, ' ').trim().slice(0, 200),
    parent: numberOf.get(parent) ?? null,
    hasImage: element.tagName === 'img' || Boolean(find(element, (e) => e.tagName === 'img')),
    badges: badgesIn(element)?.length ?? 1
  }
}

export function resolveLocators(key: string, locators: ElementLocator[]): (number | null)[] {
  const { document, numberOf } = session(key)
  return locators.map((locator) => {
    const element = resolveLocator(document, locator)
    return (element && numberOf.get(element)) ?? null
  })
}

export function pathWithin(key: string, ancestor: number, n: number): number[] | null {
  const { elements } = session(key)
  const outer = elements.get(ancestor)
  const inner = elements.get(n)
  return outer && inner ? pathFrom(outer, inner) : null
}
