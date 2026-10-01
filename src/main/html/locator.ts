import { attr, children, isElement, textContent, type Document, type Element } from './dom'
import type { ElementLocator } from '../../shared/types'

export function bodyOf(document: Document): Element | null {
  const html = document.childNodes.filter(isElement)[0]
  return (html && children(html).find((element) => element.tagName === 'body')) ?? null
}

function parentElement(element: Element): Element | null {
  const parent = element.parentNode
  return parent && 'tagName' in parent ? (parent as Element) : null
}

/** Element-child indices from `ancestor` down to `element`; null if it isn't inside. */
export function pathFrom(ancestor: Element, element: Element): number[] | null {
  const path: number[] = []
  for (let node: Element | null = element; node !== ancestor; node = parentElement(node)) {
    const parent = node && parentElement(node)
    if (!node || !parent) return null
    path.unshift(children(parent).indexOf(node))
  }
  return path
}

export function follow(start: Element, path: number[]): Element | null {
  let node: Element | undefined = start
  for (const index of path) node = node && children(node)[index]
  return node ?? null
}

const classesOf = (element: Element): string[] =>
  (attr(element, 'class') ?? '').split(/\s+/).filter(Boolean)

export function describe(element: Element): string {
  const id = attr(element, 'id')
  const classes = classesOf(element)
  const text = textContent(element).replace(/\s+/g, ' ').trim()
  const name = element.tagName + (id ? `#${id}` : '') + (classes[0] ? `.${classes[0]}` : '')
  return text ? `${name} “${text.length > 40 ? text.slice(0, 38) + '…' : text}”` : name
}

export function locatorOf(body: Element, element: Element): ElementLocator {
  const id = attr(element, 'id')
  return {
    path: pathFrom(body, element) ?? [],
    tag: element.tagName,
    ...(id ? { id } : {}),
    classes: classesOf(element),
    hint: describe(element)
  }
}

/**
 * Finds a located element again: by path when the tag still matches, else by
 * id, else by the first element with the same tag and classes.
 */
export function resolveLocator(document: Document, locator: ElementLocator): Element | null {
  const body = bodyOf(document)
  if (!body) return null
  const byPath = follow(body, locator.path)
  if (byPath && byPath.tagName === locator.tag) return byPath
  const matches: Element[] = []
  const visit = (element: Element): void => {
    if (element.tagName === locator.tag) matches.push(element)
    children(element).forEach(visit)
  }
  visit(body)
  if (locator.id) {
    const byId = matches.find((element) => attr(element, 'id') === locator.id)
    if (byId) return byId
  }
  if (locator.classes.length) {
    return (
      matches.find((element) => {
        const classes = classesOf(element)
        return locator.classes.every((name) => classes.includes(name))
      }) ?? null
    )
  }
  return null
}
