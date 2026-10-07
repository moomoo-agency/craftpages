import { readFile } from 'fs/promises'
import { basename, extname, join, posix } from 'path'
import sharp from 'sharp'
import { hasDraft } from './drafts'
import {
  applyPatches,
  attr,
  attrPatches,
  parseWithLocations,
  walk,
  type Element,
  type Patch
} from './html/dom'
import { writeFiles, type FileWrite } from './history'
import { encodeImage, keepOriginal, shortHash, slug } from './images'
import { getSiteSettings } from './settings'
import { listFiles, resolveInWorkspace, type FileEntry } from './workspace'
import type { ImageEntry, MediaChangeResult, OptimizeResult, SiteSettings } from '../shared/types'

/**
 * The media library: every image of the site and where it's used, with
 * optimise / replace / delete that keep every reference (HTML attributes,
 * srcset, CSS url(), manifest JSON, full URLs) pointing at the right file.
 */

const IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.avif',
  '.svg',
  '.ico'
])
/** Formats the pipeline re-encodes (not vector, icons or animations). */
const RASTER = new Set(['.jpg', '.jpeg', '.png', '.webp'])
/** Names browsers and crawlers request by convention: never renamed. */
const WELL_KNOWN = /^(favicon|apple-touch-icon)[^/]*$/i
const REFERENCING = new Set(['.html', '.htm', '.css', '.webmanifest', '.json', '.xml'])
const IMAGE_TOKEN = /[^"'()\s,<>]+\.(?:jpe?g|png|gif|webp|avif|svg|ico)(?:[?#][^"'()\s,<>]*)?/gi

const dimensions = new Map<string, { key: string; width: number; height: number }>()

interface Reference {
  /** File the reference is in. */
  file: string
  start: number
  end: number
  /** Image file it points at (site-relative path). */
  target: string
  token: string
}

/** Resolves an image URL found in `file` to a site path, or null for other sites. */
function resolveToken(token: string, file: string, site: SiteSettings): string | null {
  let value = token.split(/[?#]/)[0]
  if (site.baseUrl && value.startsWith(site.baseUrl)) value = value.slice(site.baseUrl.length)
  if (/^[a-z][a-z0-9+.-]*:|^\/\//i.test(value)) return null
  const absolute = value.startsWith('/') ? value : posix.join(posix.dirname('/' + file), value)
  try {
    return decodeURI(posix.normalize(absolute)).replace(/^\/+/, '')
  } catch {
    return null
  }
}

async function textFiles(
  root: string,
  files: FileEntry[]
): Promise<{ path: string; text: string }[]> {
  return Promise.all(
    files
      .filter((file) => REFERENCING.has(extname(file.path).toLowerCase()))
      .map(async (file) => ({
        path: file.path,
        text: await readFile(join(root, file.path), 'utf8')
      }))
  )
}

function findReferences(
  texts: { path: string; text: string }[],
  images: Set<string>,
  site: SiteSettings
): Reference[] {
  const refs: Reference[] = []
  for (const { path, text } of texts) {
    for (const match of text.matchAll(IMAGE_TOKEN)) {
      const target = resolveToken(match[0], path, site)
      if (target && images.has(target)) {
        refs.push({
          file: path,
          start: match.index,
          end: match.index + match[0].length,
          target,
          token: match[0]
        })
      }
    }
  }
  return refs
}

/** The same kind of URL as `token` (full, root-relative or relative), pointing at `to`. */
function retarget(token: string, file: string, to: string, site: SiteSettings): string {
  // Query strings (cache busting) are dropped: the new name is content-hashed.
  if (site.baseUrl && token.startsWith(site.baseUrl)) return `${site.baseUrl}/${encodeURI(to)}`
  if (token.startsWith('/')) return `/${encodeURI(to)}`
  return encodeURI(posix.relative(posix.dirname('/' + file), '/' + to))
}

/** Writes that point every reference from one image to another. */
function rewriteWrites(
  texts: { path: string; text: string }[],
  refs: Reference[],
  moves: Map<string, string>,
  site: SiteSettings,
  /** The new file's size when its shape may differ (a replacement). */
  size?: { width: number; height: number }
): FileWrite[] {
  const byFile = new Map<string, Patch[]>()
  for (const ref of refs) {
    const to = moves.get(ref.target)
    if (!to) continue
    const patches = byFile.get(ref.file) ?? []
    patches.push({ start: ref.start, end: ref.end, text: retarget(ref.token, ref.file, to, site) })
    byFile.set(ref.file, patches)
  }
  if (size?.width && size.height) {
    // <img width height> keeps its width; the height follows the new shape so it isn't stretched.
    for (const [path, patches] of byFile) {
      if (!/\.html?$/.test(path)) continue
      const source = texts.find((t) => t.path === path)!.text
      walk(parseWithLocations(source), (element) => {
        if (element.tagName !== 'img') return true
        const target = resolveToken(attr(element, 'src') ?? '', path, site)
        const width = Number(attr(element, 'width'))
        if (!target || !moves.has(target) || !width || !Number(attr(element, 'height'))) return true
        const height = String(Math.round((width * size.height) / size.width))
        if (height !== attr(element, 'height'))
          patches.push(...attrPatches(source, element, { height }))
        return true
      })
    }
  }
  return [...byFile].map(([path, patches]) => ({
    path,
    content: applyPatches(texts.find((t) => t.path === path)!.text, patches)
  }))
}

async function sizeOf(root: string, file: FileEntry): Promise<{ width: number; height: number }> {
  const key = `${file.path}:${file.bytes}`
  const cached = dimensions.get(file.path)
  if (cached && cached.key === key) return cached
  let size = { key, width: 0, height: 0 }
  try {
    const meta = await sharp(join(root, file.path)).metadata()
    size = { key, width: meta.width ?? 0, height: meta.height ?? 0 }
  } catch {
    // Unreadable or unsupported: shown without dimensions.
  }
  dimensions.set(file.path, size)
  return size
}

/** Calls `found` for every <img> tag of an HTML page that has neither width nor height. */
function unsizedImages(
  path: string,
  source: string,
  site: SiteSettings,
  found: (element: Element, target: string) => void
): void {
  walk(parseWithLocations(source), (element) => {
    if (element.tagName !== 'img' || !element.sourceCodeLocation?.startTag) return true
    if (attr(element, 'width') !== undefined || attr(element, 'height') !== undefined) return true
    const target = resolveToken(attr(element, 'src') ?? '', path, site)
    if (target) found(element, target)
    return true
  })
}

/** Every image in the site with its size and which pages / stylesheets use it. */
export async function listImages(root: string, origin: string): Promise<ImageEntry[]> {
  const site = await getSiteSettings(root)
  const files = await listFiles(root)
  const images = files.filter((file) => IMAGE_EXTENSIONS.has(extname(file.path).toLowerCase()))
  const texts = await textFiles(root, files)
  const refs = findReferences(texts, new Set(images.map((i) => i.path)), site)
  const unsized = new Map<string, number>()
  for (const { path, text } of texts) {
    if (!/\.html?$/.test(path) || !/<img\b/i.test(text)) continue
    unsizedImages(path, text, site, (_element, target) =>
      unsized.set(target, (unsized.get(target) ?? 0) + 1)
    )
  }
  return Promise.all(
    images.map(async (file): Promise<ImageEntry> => {
      const size = await sizeOf(root, file)
      return {
        path: file.path,
        url: `${origin}/${encodeURI(file.path)}`,
        bytes: file.bytes,
        width: size.width,
        height: size.height,
        usedIn: [...new Set(refs.filter((ref) => ref.target === file.path).map((ref) => ref.file))],
        // Vector images may have no intrinsic size; nothing to write then.
        unsized: size.width && size.height ? (unsized.get(file.path) ?? 0) : 0
      }
    })
  )
}

/** A new file name next to the old one: hero.3f9a1c.jpg (an earlier hash is replaced). */
function siblingName(path: string, data: Buffer, ext: string, name?: string): string {
  const dir = posix.dirname(path)
  const base = name ?? slug(basename(path, extname(path)).replace(/\.[0-9a-f]{6}$/, ''))
  return `${dir === '.' ? '' : dir + '/'}${base}.${shortHash(data)}.${ext}`
}

/**
 * Icons and manifest entries declare their type (`type="image/png"`), so an
 * image referenced from a <link> tag or a JSON/XML file keeps its format.
 */
function fixedFormat(
  texts: { path: string; text: string }[],
  refs: Reference[],
  path: string
): boolean {
  return refs.some((ref) => {
    if (ref.target !== path) return false
    if (!/\.html?$/.test(ref.file)) return !ref.file.endsWith('.css')
    const text = texts.find((t) => t.path === ref.file)!.text
    const tag = text.slice(text.lastIndexOf('<', ref.start), ref.start)
    return /^<link\b/i.test(tag) && !tag.includes('>')
  })
}

const keepingFormat = (site: SiteSettings): SiteSettings => ({
  ...site,
  images: { ...site.images, pngToJpeg: false }
})

/** Pages with unsaved edits can't be rewritten underneath the editor. */
function blockedBy(refs: Reference[], path: string): string[] {
  return [...new Set(refs.filter((r) => r.target === path && hasDraft(r.file)).map((r) => r.file))]
}

/**
 * Re-encodes images through the pipeline. With `apply: false` it only reports
 * what would be saved. Applying writes the new files, points every reference at
 * them and removes the old ones, in one undoable step.
 */
export async function optimizeImages(
  root: string,
  paths: string[],
  apply: boolean
): Promise<OptimizeResult> {
  const site = await getSiteSettings(root)
  const files = await listFiles(root)
  const texts = await textFiles(root, files)
  const imageSet = new Set(
    files.filter((f) => IMAGE_EXTENSIONS.has(extname(f.path).toLowerCase())).map((f) => f.path)
  )
  const refs = findReferences(texts, imageSet, site)

  const result: OptimizeResult = { items: [], skipped: [], saved: 0, historyId: null }
  const writes: FileWrite[] = []
  const moves = new Map<string, string>()
  for (const path of paths) {
    if (!RASTER.has(extname(path).toLowerCase())) {
      result.skipped.push({ path, reason: 'Vector, icon or animated images are kept as they are.' })
      continue
    }
    if (WELL_KNOWN.test(path)) {
      result.skipped.push({ path, reason: 'Browsers ask for this name directly, so it keeps it.' })
      continue
    }
    const input = await readFile(resolveInWorkspace(root, path))
    const fixed = fixedFormat(texts, refs, path)
    const encoded = await encodeImage(input, fixed ? keepingFormat(site) : site)
    if (!encoded) {
      result.skipped.push({ path, reason: 'Kept as it is (animated).' })
      continue
    }
    const meta = await sharp(input).metadata()
    const smaller = encoded.data.length < input.length * 0.9
    // Scaling down is worth it on its own, unless the file comes out bigger.
    const narrower = (meta.width ?? 0) > encoded.width && encoded.data.length < input.length
    if (!smaller && !narrower) {
      result.skipped.push({ path, reason: 'Already well compressed.' })
      continue
    }
    const blocked = blockedBy(refs, path)
    if (blocked.length) {
      result.skipped.push({
        path,
        reason: `Unsaved edits on ${blocked.join(', ')}: save them first.`
      })
      continue
    }
    const newPath = siblingName(path, encoded.data, encoded.format)
    result.items.push({
      path,
      newPath,
      before: input.length,
      after: encoded.data.length,
      width: encoded.width,
      height: encoded.height
    })
    result.saved += input.length - encoded.data.length
    if (apply) {
      await keepOriginal(root, slug(basename(path, extname(path))), input, extname(path).slice(1))
      writes.push({ path: newPath, content: encoded.data }, { path, content: null })
      moves.set(path, newPath)
    }
  }
  if (apply && writes.length) {
    writes.push(...rewriteWrites(texts, refs, moves, site))
    result.historyId = await writeFiles(
      root,
      writes,
      `Media: optimise ${moves.size} image${moves.size === 1 ? '' : 's'}`
    )
  }
  return result
}

/** Replaces an image everywhere it's used with a new file (run through the pipeline). */
export async function replaceImage(
  root: string,
  path: string,
  file: string
): Promise<MediaChangeResult> {
  const site = await getSiteSettings(root)
  const files = await listFiles(root)
  const texts = await textFiles(root, files)
  const imageSet = new Set(
    files.filter((f) => IMAGE_EXTENSIONS.has(extname(f.path).toLowerCase())).map((f) => f.path)
  )
  const refs = findReferences(texts, imageSet, site)
  const blocked = blockedBy(refs, path)
  if (blocked.length)
    throw new Error(`Unsaved edits on ${blocked.join(', ')}: save or discard them first.`)

  if (WELL_KNOWN.test(path)) {
    throw new Error(`${path} is requested by name by browsers; replace the file itself.`)
  }
  const input = await readFile(file)
  const name = slug(basename(file, extname(file)))
  await keepOriginal(root, name, input, extname(file).slice(1).toLowerCase())
  const encoded = await encodeImage(
    input,
    fixedFormat(texts, refs, path) ? keepingFormat(site) : site
  )
  const data = encoded?.data ?? input
  const ext = encoded?.format ?? extname(file).slice(1).toLowerCase()
  const newPath = siblingName(path, data, ext, name)
  const moves = new Map([[path, newPath]])
  const shape = encoded ?? (await sharp(data).metadata())
  const rewrites = rewriteWrites(texts, refs, moves, site, {
    width: shape.width ?? 0,
    height: shape.height ?? 0
  })
  const historyId = await writeFiles(
    root,
    [{ path: newPath, content: data }, { path, content: null }, ...rewrites],
    `Media: replace ${path}`
  )
  return { path: newPath, files: rewrites.map((w) => w.path), historyId }
}

export async function deleteImage(root: string, path: string): Promise<MediaChangeResult> {
  const site = await getSiteSettings(root)
  const files = await listFiles(root)
  const refs = findReferences(await textFiles(root, files), new Set([path]), site)
  if (refs.length) {
    throw new Error(
      `Still used in ${[...new Set(refs.map((r) => r.file))].join(', ')}. Replace it there first.`
    )
  }
  const historyId = await writeFiles(root, [{ path, content: null }], `Media: delete ${path}`)
  return { path, files: [], historyId }
}

/**
 * Adds the missing width/height to <img> tags (from the image files), so the
 * page doesn't jump while images load. Tags with one of the two set are left
 * alone; pages with unsaved edits are skipped.
 */
export async function addImageDimensions(
  root: string,
  only?: string[]
): Promise<{ images: number; pages: string[]; skipped: string[] }> {
  const site = await getSiteSettings(root)
  const files = await listFiles(root)
  const byPath = new Map(files.map((file) => [file.path, file]))
  const chosen = only && new Set(only)
  const writes: FileWrite[] = []
  const skipped: string[] = []
  let images = 0
  for (const file of files) {
    if (!/\.html?$/.test(file.path)) continue
    const source = await readFile(join(root, file.path), 'utf8')
    const patches: Patch[] = []
    let found = 0
    const pending: Promise<void>[] = []
    unsizedImages(file.path, source, site, (element, target) => {
      const entry = byPath.get(target)
      if (!entry || (chosen && !chosen.has(target))) return
      pending.push(
        sizeOf(root, entry).then((size) => {
          if (size.width && size.height) {
            found += 1
            patches.push(
              ...attrPatches(source, element, {
                width: String(size.width),
                height: String(size.height)
              })
            )
          }
        })
      )
    })
    await Promise.all(pending)
    if (!patches.length) continue
    if (hasDraft(file.path)) {
      skipped.push(file.path)
      continue
    }
    images += found
    writes.push({ path: file.path, content: applyPatches(source, patches) })
  }
  if (writes.length) await writeFiles(root, writes, 'Media: add image sizes')
  return { images, pages: writes.map((w) => w.path), skipped }
}
