import { readFile } from 'fs/promises'
import { join, posix } from 'path'
import { writeFiles, type FileWrite } from './history'
import {
  attrPatches,
  applyPatches,
  attr,
  parseWithLocations,
  walk,
  type Element,
  type Patch
} from './html/dom'
import { listFiles } from './workspace'
import type { ExternalFonts, SelfHostResult } from '../shared/types'

/**
 * Fonts a site loads from Google Fonts or Bunny Fonts, and bringing them home: the font
 * files go into `assets/fonts/`, with a stylesheet that declares them, and every page
 * (and stylesheet) that linked the service links that file instead.
 *
 * Why: a font service costs the first paint two extra connections (its stylesheet's
 * host, then its files' host) before any text shows. Served by the site itself, the
 * fonts come over the connection the page already has. Both services' fonts are free to
 * self-host (Open Font License or Apache).
 *
 * One history entry, so Undo puts every file back.
 */

const SERVICES = [
  { name: 'Google Fonts', css: 'fonts.googleapis.com', files: ['fonts.gstatic.com'] },
  { name: 'Bunny Fonts', css: 'fonts.bunny.net', files: ['fonts.bunny.net'] }
] as const

const FONTS_DIR = 'assets/fonts'

// The services pick the font format from the browser: this asks for woff2.
const BROWSER =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const serviceOf = (url: string): (typeof SERVICES)[number] | null => {
  try {
    const { hostname, pathname } = new URL(url.startsWith('//') ? `https:${url}` : url)
    return SERVICES.find((s) => s.css === hostname && /^\/css2?$/.test(pathname)) ?? null
  } catch {
    return null
  }
}

/** The family names a service URL asks for: css2 (`family=A:wght@4..7`) and css (`A:400|B`). */
export function familiesOf(url: string): string[] {
  try {
    const params = new URL(url.startsWith('//') ? `https:${url}` : url).searchParams
    return params
      .getAll('family')
      .flatMap((value) => value.split('|'))
      .map((value) => value.split(':')[0].replace(/\+/g, ' ').trim())
      .filter(Boolean)
  } catch {
    return []
  }
}

const decode = (value: string): string => value.replace(/&amp;/g, '&')

/** A font stylesheet's address in a <link> or an @import. */
const LINK_RE = /<link\b[^>]*>/gi
const IMPORT_RE =
  /@import\s+(?:url\(\s*)?["']?((?:https?:)?\/\/fonts\.(?:googleapis\.com|bunny\.net)\/css2?\?[^"')\s;]+)/gi

/** Every font-service stylesheet the site links, with the pages and stylesheets that link it. */
export async function detectExternalFonts(root: string): Promise<ExternalFonts[]> {
  const found = new Map<string, ExternalFonts>()
  const note = (url: string, file: string, kind: 'pages' | 'stylesheets'): void => {
    const service = serviceOf(url)
    if (!service) return
    const entry = found.get(url) ?? {
      url,
      service: service.name,
      families: familiesOf(url),
      pages: [],
      stylesheets: []
    }
    if (!entry[kind].includes(file)) entry[kind].push(file)
    found.set(url, entry)
  }
  for (const file of await listFiles(root)) {
    const html = /\.html?$/i.test(file.path)
    if (!html && !/\.css$/i.test(file.path)) continue
    const text = await readFile(join(root, file.path), 'utf8')
    if (html)
      for (const tag of text.match(LINK_RE) ?? []) {
        const href = tag.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1]
        if (href && /\bstylesheet\b/i.test(tag)) note(decode(href), file.path, 'pages')
      }
    for (const match of text.matchAll(IMPORT_RE))
      note(decode(match[1]), file.path, html ? 'pages' : 'stylesheets')
  }
  return [...found.values()]
}

interface FontFace {
  /** The @font-face block as the service wrote it. */
  block: string
  family: string
  weight: string
  style: string
  subset: string
  src: string
}

/** The @font-face blocks of a service stylesheet, each with its subset comment. */
function parseFaces(css: string): FontFace[] {
  const faces: FontFace[] = []
  const re = /(?:\/\*\s*([\w-]+)\s*\*\/\s*)?@font-face\s*\{([^}]*)\}/g
  let index = 0
  for (const match of css.matchAll(re)) {
    const body = match[2]
    const get = (name: string): string =>
      body.match(new RegExp(`${name}\\s*:\\s*([^;]+);?`, 'i'))?.[1].trim() ?? ''
    const src = body.match(/url\(\s*["']?([^"')]+)["']?\s*\)/i)?.[1]
    if (!src) continue
    faces.push({
      block: match[0].replace(/^\/\*[^*]*\*\/\s*/, ''),
      family: get('font-family').replace(/^["']|["']$/g, ''),
      weight: get('font-weight') || '400',
      style: get('font-style') || 'normal',
      subset: match[1] ?? `part${++index}`,
      src
    })
  }
  return faces
}

const slug = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/** The address of `target` as written from `from` (both site paths). */
const relativeFrom = (from: string, target: string): string =>
  posix.relative(posix.dirname(from), target) || posix.basename(target)

/** A patch that removes an element and the whitespace line it sat on. */
function removeElement(source: string, element: Element): Patch {
  const location = element.sourceCodeLocation!
  let start = location.startOffset
  while (start > 0 && /[ \t]/.test(source[start - 1])) start -= 1
  if (source[start - 1] === '\n') start -= 1
  return { start, end: location.endOffset, text: '' }
}

/**
 * Downloads the fonts one service stylesheet declares, writes them and a stylesheet for
 * them into assets/fonts/, and points every page and stylesheet that linked the service
 * at that file.
 */
export async function selfHostFonts(root: string, url: string): Promise<SelfHostResult> {
  const service = serviceOf(url)
  if (!service) throw new Error('That isn’t a Google Fonts or Bunny Fonts stylesheet.')
  const usage = (await detectExternalFonts(root)).find((entry) => entry.url === url)
  if (!usage) throw new Error('No page links that font stylesheet any more.')

  const response = await fetch(url.startsWith('//') ? `https:${url}` : url, {
    headers: { 'User-Agent': BROWSER, Accept: 'text/css,*/*;q=0.1' }
  })
  if (!response.ok) throw new Error(`${service.name} answered HTTP ${response.status}.`)
  const css = await response.text()
  const faces = parseFaces(css)
  if (!faces.length) throw new Error(`${service.name} sent no fonts for that address.`)

  // One file per font file the service serves: a variable font's weights share one file,
  // named for the range it covers (onest-latin-400-700.woff2).
  const weights = new Map<string, number[]>()
  for (const face of faces)
    weights.set(face.src, [
      ...(weights.get(face.src) ?? []),
      ...face.weight.split(/\s+/).map(Number)
    ])
  const writes: FileWrite[] = []
  const names = new Map<string, string>()
  const taken = new Set<string>()
  for (const face of faces) {
    if (names.has(face.src)) continue
    const host = new URL(face.src).hostname
    if (!(service.files as readonly string[]).includes(host))
      throw new Error(`${service.name} pointed at a font on another site (${host}).`)
    const ext = face.src.match(/\.(woff2|woff|ttf|otf)(?:$|\?)/i)?.[1].toLowerCase() ?? 'woff2'
    const range = (weights.get(face.src) ?? []).filter(Number.isFinite)
    const low = Math.min(...range)
    const high = Math.max(...range)
    const weight = range.length ? (low === high ? `${low}` : `${low}-${high}`) : slug(face.weight)
    const base = [
      slug(face.family),
      face.subset,
      weight,
      face.style !== 'normal' ? slug(face.style) : ''
    ]
      .filter(Boolean)
      .join('-')
    let name = `${base}.${ext}`
    for (let n = 2; taken.has(name); n++) name = `${base}-${n}.${ext}`
    taken.add(name)
    const file = await fetch(face.src, { headers: { 'User-Agent': BROWSER } })
    if (!file.ok) throw new Error(`Couldn’t download a font file (HTTP ${file.status}).`)
    writes.push({ path: `${FONTS_DIR}/${name}`, content: Buffer.from(await file.arrayBuffer()) })
    names.set(face.src, name)
  }

  // The service's own declarations (font-display, unicode-range…), pointing at the copies.
  const sheetName = `${slug(service.name)}${(await existingSheet(root, service.name)) ? `-${Date.now().toString(36)}` : ''}.css`
  const sheet = `${FONTS_DIR}/${sheetName}`
  const families = [...new Set(faces.map((face) => face.family))]
  const declarations = faces
    .map((face) => {
      const subset = face.subset.startsWith('part') ? '' : `/* ${face.subset} */\n`
      return subset + face.block.replace(face.src, names.get(face.src)!)
    })
    .join('\n')
  writes.push({
    path: sheet,
    content:
      `/* ${families.join(', ')}: from ${service.name}, self-hosted by CraftPages.\n` +
      ` * Source: ${url}\n * Free to self-host (Open Font License / Apache License). */\n` +
      declarations +
      '\n'
  })

  // Pages: the service's <link> becomes the copy's, written like the page's other
  // stylesheet links (root-absolute or relative); its preconnects go when nothing else uses them.
  const hosts = [service.css, ...service.files]
  for (const page of usage.pages) {
    const source = await readFile(join(root, page), 'utf8')
    const document = parseWithLocations(source)
    const patches: Patch[] = []
    const links: Element[] = []
    walk(document, (element) => {
      if (element.tagName === 'link') links.push(element)
    })
    const rootAbsolute = links.some(
      (link) =>
        /\bstylesheet\b/i.test(attr(link, 'rel') ?? '') &&
        /^\/(?!\/)/.test(attr(link, 'href') ?? '')
    )
    const address = rootAbsolute ? `/${sheet}` : relativeFrom(page, sheet)
    for (const link of links) {
      const href = attr(link, 'href')
      if (href !== undefined && decode(href) === url)
        patches.push(...attrPatches(source, link, { href: address }))
    }
    let text = applyPatches(source, patches)
    text = text.replace(IMPORT_RE, (whole, found: string) =>
      decode(found) === url ? whole.replace(found, address) : whole
    )
    // Preconnect hints name a host, not a stylesheet: they go once no service stylesheet is left.
    if (!/\/\/fonts\.(?:googleapis\.com|bunny\.net)\/css/.test(text)) {
      const after = parseWithLocations(text)
      const hints: Patch[] = []
      walk(after, (element) => {
        if (element.tagName !== 'link') return
        const rel = (attr(element, 'rel') ?? '').toLowerCase()
        const href = attr(element, 'href') ?? ''
        if (/(preconnect|dns-prefetch)/.test(rel) && hosts.some((host) => href.includes(host)))
          hints.push(removeElement(text, element))
      })
      text = applyPatches(text, hints)
    }
    if (text !== source) writes.push({ path: page, content: text })
  }
  for (const stylesheet of usage.stylesheets) {
    const source = await readFile(join(root, stylesheet), 'utf8')
    const text = source.replace(IMPORT_RE, (whole, found: string) =>
      decode(found) === url ? whole.replace(found, relativeFrom(stylesheet, sheet)) : whole
    )
    if (text !== source) writes.push({ path: stylesheet, content: text })
  }

  const historyId = await writeFiles(root, writes, `Fonts: self-hosted ${families.join(', ')}`)
  return {
    historyId,
    stylesheet: sheet,
    fontFiles: names.size,
    pages: usage.pages.length + usage.stylesheets.length
  }
}

/** Whether a stylesheet for this service is already in assets/fonts (another link). */
async function existingSheet(root: string, service: string): Promise<boolean> {
  try {
    await readFile(join(root, FONTS_DIR, `${slug(service)}.css`))
    return true
  } catch {
    return false
  }
}
