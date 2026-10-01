import { attr, children, isElement, parseWithLocations, textContent, type Element } from './dom'

/** Maps a source offset to its 1-based line number. */
function lineIndex(source: string): (offset: number) => number {
  const starts = [0]
  for (let i = 0; i < source.length; i++) if (source.charCodeAt(i) === 10) starts.push(i + 1)
  return (offset) => {
    let low = 0
    let high = starts.length - 1
    while (low < high) {
      const mid = (low + high + 1) >> 1
      if (starts[mid] <= offset) low = mid
      else high = mid - 1
    }
    return low + 1
  }
}

function label(element: Element): string {
  const id = attr(element, 'id')
  const classes = (attr(element, 'class') ?? '').trim().split(/\s+/).filter(Boolean)
  return element.tagName + (id ? `#${id}` : '') + classes.map((name) => `.${name}`).join('')
}

/**
 * A compact, indented tree of a page's `<body>` with source line numbers, so an
 * AI can find the markup it wants to change without reading the whole file.
 */
export function pageOutline(source: string, maxDepth = 8): string {
  const document = parseWithLocations(source)
  const html = document.childNodes.filter(isElement)[0]
  const body = html && children(html).find((element) => element.tagName === 'body')
  if (!body) return '(no <body>)'

  const lineOf = lineIndex(source)
  const lines: string[] = []
  const visit = (element: Element, depth: number): void => {
    if (['script', 'style', 'svg', 'noscript'].includes(element.tagName)) {
      const location = element.sourceCodeLocation
      if (location)
        lines.push(`${'  '.repeat(depth)}${element.tagName} (L${lineOf(location.startOffset)})`)
      return
    }
    const location = element.sourceCodeLocation
    const text = textContent(element).replace(/\s+/g, ' ').trim()
    const kids = children(element)
    const leaf = kids.length === 0 || depth >= maxDepth
    const preview = leaf && text ? ` "${text.length > 70 ? text.slice(0, 67) + '…' : text}"` : ''
    const extra = depth >= maxDepth && kids.length > 0 ? ` [+${kids.length} children]` : ''
    const line = location ? ` (L${lineOf(location.startOffset)})` : ''
    lines.push(`${'  '.repeat(depth)}${label(element)}${line}${preview}${extra}`)
    if (!leaf) kids.forEach((kid) => visit(kid, depth + 1))
  }
  visit(body, 0)
  return lines.join('\n')
}
