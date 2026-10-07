import {
  applyPatches,
  attr,
  attrPatches,
  children,
  escapeText,
  isElement,
  textContent,
  walk,
  type Element,
  type Patch
} from './dom'

/**
 * Pagination in the template's own markup. The pagination the user pointed at is read as
 * an example: its items (an <li>, or the link itself) are sorted into a page number, the
 * current page, previous / next (enabled or disabled) and "…", and the list is rebuilt
 * for each page from those examples. Only links, numbers and the current-page markers
 * change, so the template's CSS keeps working: Bootstrap's li.page-item.active > a.page-link,
 * WordPress's a.page-numbers / span.current / span.dots, a plain "Older posts" link…
 */

export interface PaginationPage {
  page: number
  total: number
  urlOf: (page: number) => string
}

type Kind = 'number' | 'current' | 'prev' | 'next' | 'dots'

interface Item {
  /** The repeated unit: the <li> around the link, or the link itself. */
  item: Element
  /** The link or span inside it that carries the text and the href. */
  control: Element
  kind: Kind
  disabled: boolean
}

const STATE = /^(is-)?(current|active|selected)$/
const DISABLED = /^(is-)?disabled$/

const classes = (element: Element): string[] =>
  (attr(element, 'class') ?? '').split(/\s+/).filter(Boolean)

const hasClass = (element: Element, pattern: RegExp): boolean =>
  classes(element).some((name) => pattern.test(name))

/** Links, and text-only elements such as <span class="current">2</span>. */
function controlsIn(root: Element): Element[] {
  const found: Element[] = []
  walk(root, (element) => {
    if (element.tagName === 'a' || element.tagName === 'button') {
      found.push(element)
      return false
    }
    const text = textContent(element).trim()
    if (children(element).length === 0 && text && text.length <= 24) {
      found.push(element)
      return false
    }
    return true
  })
  return found
}

/** The highest ancestor of `control` (below `root`) that holds no other control. */
function itemOf(control: Element, root: Element, controls: Set<Element>): Element {
  let item = control
  for (;;) {
    const parent = item.parentNode
    if (!parent || !isElement(parent) || parent === root) return item
    let others = false
    walk(parent, (element) => {
      if (element !== control && controls.has(element)) others = true
      return !others
    })
    if (others) return item
    item = parent
  }
}

function classify(item: Element, control: Element): Item {
  const text = textContent(control).trim()
  const hint = [
    attr(control, 'rel'),
    attr(control, 'aria-label'),
    attr(control, 'title'),
    ...classes(control),
    ...classes(item),
    text
  ]
    .join(' ')
    .toLowerCase()
  const link = control.tagName === 'a' && attr(control, 'href') !== undefined
  const disabled =
    hasClass(item, DISABLED) ||
    hasClass(control, DISABLED) ||
    attr(control, 'aria-disabled') === 'true'
  const current =
    attr(control, 'aria-current') !== undefined ||
    attr(item, 'aria-current') !== undefined ||
    hasClass(item, STATE) ||
    hasClass(control, STATE)

  let kind: Kind
  if (/^\d+$/.test(text)) kind = current || !link ? 'current' : 'number'
  else if (/^(…|\.\.\.?)$/.test(text)) kind = 'dots'
  else if (/^[«‹←<]/.test(text) || /\b(prev|previous|newer)\b/.test(hint)) kind = 'prev'
  else if (/[»›→>]$/.test(text) || /\b(next|older)\b/.test(hint)) kind = 'next'
  else kind = 'number'
  return {
    item,
    control,
    kind,
    disabled: disabled || ((kind === 'prev' || kind === 'next') && !link)
  }
}

const SWAP: Record<string, string> = {
  previous: 'next',
  prev: 'next',
  next: 'previous',
  newer: 'older',
  older: 'newer',
  '«': '»',
  '»': '«',
  '‹': '›',
  '›': '‹',
  '←': '→',
  '→': '←'
}

/**
 * The other direction: "Older posts →" → "← Newer posts", "Next" → "Previous". For class
 * names and rel (`token`), "next" becomes the conventional "prev".
 */
function mirror(text: string, token = false): string {
  const out = text.replace(/\b(previous|prev|next|newer|older)\b|[«»‹›←→]/gi, (word) => {
    const lower = word.toLowerCase()
    const swap = token && lower === 'next' ? 'prev' : SWAP[lower]
    return word[0] !== word[0].toLowerCase() ? swap[0].toUpperCase() + swap.slice(1) : swap
  })
  if (token) return out
  // Arrows sit on the other side of the words.
  return out.replace(/^(.*?)\s*([←‹«])$/, '$2 $1').replace(/^([→›»])\s*(.*)$/, '$2 $1')
}

/** Page numbers to show: all of them, or the first, the last and the current with its neighbours. */
export function pageList(page: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const shown = [...new Set([1, page - 1, page, page + 1, total])]
    .filter((n) => n >= 1 && n <= total)
    .sort((a, b) => a - b)
  const out: (number | null)[] = []
  shown.forEach((n, i) => {
    if (i > 0 && n - shown[i - 1] > 1) out.push(n - shown[i - 1] === 2 ? n - 1 : null)
    out.push(n)
  })
  return out
}

interface Change {
  href?: string | null
  /** Plain text for the control. */
  text?: string
  /** Raw HTML for the control (e.g. an arrow icon taken from another item). */
  inner?: string
  current?: boolean
  ariaLabel?: string
  /** Built from the other direction's link: flip its prev / next classes and rel. */
  mirrored?: boolean
}

/**
 * The inner HTML of the pagination element for one list page, or null when the example
 * can't be read (the caller then falls back to simple links).
 */
export function renderPagination(
  source: string,
  root: Element,
  paging: PaginationPage
): string | null {
  const rootLocation = root.sourceCodeLocation
  if (!rootLocation?.startTag || !rootLocation.endTag) return null
  const controls = controlsIn(root)
  if (!controls.length) return null
  const set = new Set(controls)
  const items = controls.map((control) => classify(itemOf(control, root, set), control))

  // The items share a parent (the <ul>, or the pagination element itself).
  const container = items[0].item.parentNode as Element
  if (!items.every((entry) => entry.item.parentNode === container)) return null
  const containerLocation = container.sourceCodeLocation
  if (!containerLocation?.startTag || !containerLocation.endTag) return null

  const sample = (kind: Kind, disabled = false): Item | undefined =>
    items.find((entry) => entry.kind === kind && entry.disabled === disabled)
  const number = sample('number')
  const current = sample('current')
  const prev = sample('prev')
  const next = sample('next')
  const dots = sample('dots')
  if (!number && !current && !prev && !next) return null

  const render = (from: Item, change: Change): string => {
    const { item, control } = from
    const location = item.sourceCodeLocation!
    const patches: Patch[] = []
    const attrs = new Map<Element, Record<string, string | null>>()
    const set = (element: Element, values: Record<string, string | null>): void => {
      attrs.set(element, { ...attrs.get(element), ...values })
    }
    if (change.href !== undefined) set(control, { href: change.href })
    if (change.ariaLabel !== undefined) set(control, { 'aria-label': change.ariaLabel })
    if (change.current === true) set(control, { 'aria-current': 'page' })
    if (change.current === false) {
      for (const element of new Set([item, control])) {
        set(element, { 'aria-current': null })
        if (hasClass(element, STATE))
          set(element, {
            class: classes(element)
              .filter((name) => !STATE.test(name))
              .join(' ')
          })
      }
    }
    if (change.mirrored) {
      for (const element of new Set([item, control])) {
        const cls = attr(element, 'class')
        if (cls && /\b(prev|previous|next)\b/.test(cls)) set(element, { class: mirror(cls, true) })
        const rel = attr(element, 'rel')
        if (rel) set(element, { rel: mirror(rel, true) })
        const label = attr(element, 'aria-label')
        if (label) set(element, { 'aria-label': mirror(label) })
      }
    }
    for (const [element, values] of attrs) patches.push(...attrPatches(source, element, values))
    const controlLocation = control.sourceCodeLocation
    if ((change.text !== undefined || change.inner !== undefined) && controlLocation?.endTag) {
      patches.push({
        start: controlLocation.startTag!.endOffset,
        end: controlLocation.endTag.startOffset,
        text: change.inner ?? escapeText(change.text!)
      })
    }
    const shifted = patches.map((patch) => ({
      ...patch,
      start: patch.start - location.startOffset,
      end: patch.end - location.startOffset
    }))
    return applyPatches(source.slice(location.startOffset, location.endOffset), shifted)
  }

  const innerOf = (entry: Item): string => {
    const location = entry.control.sourceCodeLocation
    return location?.startTag && location.endTag
      ? source.slice(location.startTag.endOffset, location.endTag.startOffset)
      : escapeText(textContent(entry.control))
  }

  /**
   * An enabled previous / next link: its own example, else a page-number item with the
   * disabled example's arrow, else the other direction's link with plain words.
   */
  const step = (
    example: Item | undefined,
    disabledExample: Item | undefined,
    opposite: Item | undefined,
    to: number
  ): string | null => {
    if (example) return render(example, { href: paging.urlOf(to) })
    if (number && disabledExample)
      return render(number, {
        href: paging.urlOf(to),
        inner: innerOf(disabledExample),
        ariaLabel: attr(disabledExample.control, 'aria-label') ?? undefined
      })
    if (opposite)
      return render(opposite, {
        href: paging.urlOf(to),
        text: mirror(textContent(opposite.control).trim()),
        mirrored: true
      })
    return null
  }
  /** Previous / next where there is nowhere to go: the disabled example, else nothing. */
  const stop = (disabledExample: Item | undefined): string | null =>
    disabledExample ? render(disabledExample, {}) : null

  const { page, total } = paging
  const out: (string | null)[] = []
  out.push(page > 1 ? step(prev, sample('prev', true), next, page - 1) : stop(sample('prev', true)))
  if (number || current) {
    for (const n of pageList(page, total)) {
      if (n === null) {
        out.push(
          dots
            ? render(dots, {})
            : render((number ?? current)!, { href: null, text: '…', current: false })
        )
      } else if (n === page) {
        out.push(
          current
            ? render(current, {
                text: String(n),
                ...(current.control.tagName === 'a' && { href: paging.urlOf(n) })
              })
            : render(number!, { href: paging.urlOf(n), text: String(n), current: true })
        )
      } else {
        out.push(
          number
            ? render(number, { href: paging.urlOf(n), text: String(n) })
            : current!.control.tagName === 'a'
              ? render(current!, { href: paging.urlOf(n), text: String(n), current: false })
              : null
        )
      }
    }
  }
  out.push(
    page < total ? step(next, sample('next', true), prev, page + 1) : stop(sample('next', true))
  )

  // Keep the template's indentation: the whitespace before the first item separates them all.
  const first = items[0].item.sourceCodeLocation!
  const last = items[items.length - 1].item.sourceCodeLocation!
  const before = source.slice(containerLocation.startTag.endOffset, first.startOffset)
  const after = source.slice(last.endOffset, containerLocation.endTag.startOffset)
  const between =
    items.length > 1
      ? source.slice(first.endOffset, items[1].item.sourceCodeLocation!.startOffset)
      : ''
  const gap = /^\s+$/.test(between) ? between : before.match(/\s*$/)?.[0] || ' '
  const list = before + out.filter((html): html is string => html !== null).join(gap) + after

  if (container === root) return list
  // Items sit in a nested container (nav > ul > li): rebuild that, keep the rest.
  const rootInner = source.slice(rootLocation.startTag.endOffset, rootLocation.endTag.startOffset)
  const offset = rootLocation.startTag.endOffset
  return applyPatches(rootInner, [
    {
      start: containerLocation.startTag.endOffset - offset,
      end: containerLocation.endTag.startOffset - offset,
      text: list
    }
  ])
}
