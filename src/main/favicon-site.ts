import { readFile } from 'fs/promises'
import { join } from 'path'
import sharp from 'sharp'
import { hasDraft } from './drafts'
import { writeFiles, type FileWrite } from './history'
import {
  applyPatches,
  attr,
  find,
  parseWithLocations,
  walk,
  type Element,
  type Patch
} from './html/dom'
import { getSiteSettings } from './settings'
import { listFiles, resolveInWorkspace } from './workspace'
import type { FaviconState, SiteChange } from '../shared/types'

/**
 * The site's icon, made from one image: favicon.ico (16, 32 and 48 px) for browsers and
 * search results, the SVG itself when the image is one, apple-touch-icon.png for home
 * screens, and 192/512 px icons with a web manifest for Android. The <link> tags go in
 * every page's <head>, in place of the icon tags that were there.
 */

const ICO = 'favicon.ico'
const SVG = 'favicon.svg'
const APPLE = 'apple-touch-icon.png'
const MANIFEST = 'site.webmanifest'
const ICON_192 = 'icon-192.png'
const ICON_512 = 'icon-512.png'
const OURS = `/${ICO}`

/** rel values of the tags replaced: every flavour of page icon. */
const ICON_REL = /(^|\s)(icon|shortcut|apple-touch-icon|apple-touch-icon-precomposed)(\s|$)/i

interface Page {
  path: string
  source: string
  head: Element | null
}

async function readPages(root: string): Promise<Page[]> {
  const files = (await listFiles(root)).filter((file) => /\.html?$/i.test(file.path))
  return Promise.all(
    files.map(async (file) => {
      const source = await readFile(join(root, file.path), 'utf8')
      const document = parseWithLocations(source)
      return { path: file.path, source, head: find(document, (e) => e.tagName === 'head') }
    })
  )
}

function iconLinks(head: Element | null): Element[] {
  const found: Element[] = []
  if (!head) return found
  walk(head, (e) => {
    if (e.tagName === 'link' && ICON_REL.test(attr(e, 'rel') ?? '')) found.push(e)
  })
  return found
}

function manifestLink(head: Element | null): Element | null {
  return (
    head &&
    find(head, (e) => e.tagName === 'link' && /(^|\s)manifest(\s|$)/i.test(attr(e, 'rel') ?? ''))
  )
}

const isOurs = (links: Element[]): boolean => links.some((e) => attr(e, 'href') === OURS)

async function exists(root: string, path: string): Promise<boolean> {
  return readFile(resolveInWorkspace(root, path)).then(
    () => true,
    () => false
  )
}

export async function faviconState(root: string): Promise<FaviconState> {
  const pages = await readPages(root)
  const home = pages.find((page) => page.path === 'index.html') ?? pages[0]
  const homeLinks = iconLinks(home?.head ?? null)
  const icon = homeLinks.find((e) => /(^|\s)icon(\s|$)/i.test(attr(e, 'rel') ?? '')) ?? homeLinks[0]
  const ours = isOurs(homeLinks)
  return {
    icon: icon ? (attr(icon, 'href') ?? null) : null,
    ours,
    hasIco: await exists(root, ICO),
    pages: pages.length,
    // With ours in place, a page without it was added later; otherwise, pages with no icon.
    missing: pages
      .filter((page) => (ours ? !isOurs(iconLinks(page.head)) : !iconLinks(page.head).length))
      .map((page) => page.path)
  }
}

/** An .ico holding PNG images, as every browser since Vista-era IE reads them. */
function icoFile(images: { size: number; png: Buffer }[]): Buffer {
  const header = Buffer.alloc(6 + images.length * 16)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)
  let offset = header.length
  images.forEach(({ size, png }, i) => {
    const entry = 6 + i * 16
    header.writeUInt8(size >= 256 ? 0 : size, entry)
    header.writeUInt8(size >= 256 ? 0 : size, entry + 1)
    header.writeUInt8(0, entry + 2)
    header.writeUInt8(0, entry + 3)
    header.writeUInt16LE(1, entry + 4)
    header.writeUInt16LE(32, entry + 6)
    header.writeUInt32LE(png.length, entry + 8)
    header.writeUInt32LE(offset, entry + 12)
    offset += png.length
  })
  return Buffer.concat([header, ...images.map((image) => image.png)])
}

/** Square, transparent around the image; nothing is cropped. */
function square(
  source: Buffer,
  svgSize: number | null,
  size: number,
  background?: string
): Promise<Buffer> {
  // An SVG is drawn at the density that makes its longer side the size asked for.
  const density = svgSize ? Math.min(2400, Math.max(1, Math.ceil((72 * size) / svgSize))) : 0
  let image = sharp(source, density ? { density } : {}).resize(size, size, {
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 }
  })
  if (background) image = image.flatten({ background })
  return image.png().toBuffer()
}

/** The tags written in each <head>; one per line, indented like the line they replace. */
function tags(svg: boolean, manifest: boolean, indent: string): string {
  return [
    `<link rel="icon" href="${OURS}" sizes="48x48">`,
    svg && `<link rel="icon" href="/${SVG}" type="image/svg+xml">`,
    `<link rel="apple-touch-icon" href="/${APPLE}">`,
    manifest && `<link rel="manifest" href="/${MANIFEST}">`
  ]
    .filter(Boolean)
    .join(`\n${indent}`)
}

/** Patches one page: our tags where its first icon tag was (or before </head>). */
function pagePatches(page: Page, svg: boolean): Patch[] | null {
  if (!page.head) return null
  const links = iconLinks(page.head)
  const manifest = manifestLink(page.head)
  // A manifest of the site's own stays; ours comes only where there's none (or it's ours).
  const ownManifest = manifest && attr(manifest, 'href') !== `/${MANIFEST}`
  const addManifest = !ownManifest
  const removed = [...links, ...(manifest && !ownManifest ? [manifest] : [])]
  const patches: Patch[] = []
  for (const element of removed) {
    const location = element.sourceCodeLocation!
    let start = location.startOffset
    while (start > 0 && /[ \t]/.test(page.source[start - 1])) start--
    const end =
      page.source[location.endOffset] === '\n' ? location.endOffset + 1 : location.endOffset
    patches.push({ start, end, text: '' })
  }
  const first = removed.sort(
    (a, b) => a.sourceCodeLocation!.startOffset - b.sourceCodeLocation!.startOffset
  )[0]
  if (first) {
    const firstStart = first.sourceCodeLocation!.startOffset
    const at = patches.find((p) => p.start <= firstStart && p.end > firstStart)!
    const indent = page.source.slice(at.start, firstStart)
    at.text = `${indent}${tags(svg, addManifest, indent)}\n`
  } else {
    const headEnd = page.head.sourceCodeLocation?.endTag?.startOffset
    if (headEnd === undefined) return null
    patches.push({ start: headEnd, end: headEnd, text: `  ${tags(svg, addManifest, '  ')}\n` })
  }
  return patches
}

/** Makes the icon files from a site image and puts the tags on every page. */
export async function setFavicon(
  root: string,
  imagePath: string,
  background: string
): Promise<SiteChange> {
  const source = await readFile(resolveInWorkspace(root, imagePath.replace(/^\/+/, '')))
  const isSvg = /\.svg$/i.test(imagePath)
  const meta = await sharp(source, isSvg ? { density: 72 } : {}).metadata()
  if (!meta.width || !meta.height) throw new Error('That file is not an image CraftPages can read.')
  const svgSize = isSvg ? Math.max(meta.width, meta.height) : null
  const site = await getSiteSettings(root)
  const pages = await readPages(root)

  const writes: FileWrite[] = []
  const skipped: SiteChange['skipped'] = []
  for (const page of pages) {
    const patches = pagePatches(page, isSvg)
    if (!patches) {
      skipped.push({ path: page.path, reason: 'No <head> to put the icon in.' })
      continue
    }
    const next = applyPatches(page.source, patches)
    if (next === page.source) continue
    if (hasDraft(page.path)) {
      skipped.push({ path: page.path, reason: 'Unsaved edits: save or discard them first.' })
      continue
    }
    writes.push({ path: page.path, content: next })
  }
  const pageCount = writes.length

  writes.push({
    path: ICO,
    content: icoFile(
      await Promise.all(
        [16, 32, 48].map(async (size) => ({ size, png: await square(source, svgSize, size) }))
      )
    )
  })
  if (isSvg) writes.push({ path: SVG, content: source })
  // Home screens show transparency as black: the touch icon gets a background.
  writes.push({ path: APPLE, content: await square(source, svgSize, 180, background || '#ffffff') })
  writes.push({ path: ICON_192, content: await square(source, svgSize, 192) })
  writes.push({ path: ICON_512, content: await square(source, svgSize, 512) })
  const manifest = {
    name: site.siteName || undefined,
    icons: [
      { src: `/${ICON_192}`, sizes: '192x192', type: 'image/png' },
      { src: `/${ICON_512}`, sizes: '512x512', type: 'image/png' }
    ]
  }
  writes.push({ path: MANIFEST, content: JSON.stringify(manifest, null, 2) + '\n' })

  const historyId = await writeFiles(root, writes, 'Site icon')
  return {
    pages: writes.slice(0, pageCount).map((write) => write.path),
    skipped,
    historyId
  }
}

/** Adds the icon tags to pages that don't have them yet (pages made after the icon). */
export async function addFaviconToPages(root: string): Promise<SiteChange> {
  const pages = await readPages(root)
  const svg = await exists(root, SVG)
  const writes: FileWrite[] = []
  const skipped: SiteChange['skipped'] = []
  for (const page of pages) {
    if (isOurs(iconLinks(page.head))) continue
    const patches = pagePatches(page, svg)
    if (!patches) continue
    if (hasDraft(page.path)) {
      skipped.push({ path: page.path, reason: 'Unsaved edits: save or discard them first.' })
      continue
    }
    writes.push({ path: page.path, content: applyPatches(page.source, patches) })
  }
  const historyId = writes.length ? await writeFiles(root, writes, 'Site icon on new pages') : null
  return { pages: writes.map((write) => write.path), skipped, historyId }
}
