import { createHash } from 'crypto'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { basename, extname, join } from 'path'
import sharp, { type Sharp } from 'sharp'
import { writeFiles } from './history'
import { APP_DIR } from './settings'
import type { ProcessedImage, SiteSettings } from '../shared/types'

export const shortHash = (data: Buffer): string =>
  createHash('sha1').update(data).digest('hex').slice(0, 6)

export function slug(name: string): string {
  return (
    name
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'image'
  )
}

export interface Encoded {
  format: string
  data: Buffer
  width: number
  height: number
}

/**
 * The image pipeline, in memory: auto-rotate, strip metadata (camera GPS
 * included), cap the width, recompress, and PNG → JPEG when the image has no
 * real transparency and the JPEG is smaller. Returns null for vector and
 * animated images, which are kept as they are.
 */
export async function encodeImage(input: Buffer, site: SiteSettings): Promise<Encoded | null> {
  const meta = await sharp(input).metadata()
  if (meta.format === 'svg' || (meta.pages ?? 1) > 1) return null
  const { images } = site
  const { isOpaque } = await sharp(input).stats()
  const base = (): Sharp =>
    sharp(input, { failOn: 'none' })
      .rotate()
      .resize({ width: images.maxWidth, withoutEnlargement: true })
  const encode = async (format: 'jpg' | 'png' | 'webp'): Promise<Encoded> => {
    const pipeline =
      format === 'webp'
        ? base().webp({ quality: images.quality })
        : format === 'png'
          ? base().png({ compressionLevel: 9, adaptiveFiltering: true })
          : base()
              .flatten({ background: '#ffffff' })
              .jpeg({ quality: images.quality, mozjpeg: true })
    const { data, info } = await pipeline.toBuffer({ resolveWithObject: true })
    return { format, data, width: info.width, height: info.height }
  }

  if (meta.format === 'webp') return encode('webp')
  if (meta.format === 'jpeg' || (isOpaque && meta.format !== 'png')) return encode('jpg')
  if (meta.format === 'png' && isOpaque && images.pngToJpeg) {
    // Photos saved as PNG shrink a lot as JPEG; flat graphics (screenshots, diagrams) often
    // don't. Encode both and keep the smaller.
    const [jpg, png] = await Promise.all([encode('jpg'), encode('png')])
    return jpg.data.length <= png.data.length ? jpg : png
  }
  return encode('png')
}

/** Keeps the untouched original, so re-processing never compounds losses. */
export async function keepOriginal(
  root: string,
  name: string,
  input: Buffer,
  ext: string
): Promise<void> {
  const originals = join(root, APP_DIR, 'media', 'originals')
  await mkdir(originals, { recursive: true })
  await writeFile(join(originals, `${name}.${shortHash(input)}.${ext || 'bin'}`), input)
}

/**
 * Imports a file into the site: runs the pipeline and writes it under a
 * content-hashed name in the images folder. The original is kept in
 * `.sitecms/media/originals/`.
 */
export async function importImage(
  root: string,
  site: SiteSettings,
  file: string
): Promise<ProcessedImage> {
  const input = await readFile(file)
  const name = slug(basename(file, extname(file)))
  const originalExt = extname(file).slice(1).toLowerCase()
  await keepOriginal(root, name, input, originalExt)

  const encoded = await encodeImage(input, site)
  if (!encoded) {
    // Vector and animated images go in as they are.
    const meta = await sharp(input).metadata()
    const ext = meta.format === 'svg' ? 'svg' : originalExt
    return write(
      root,
      site.images.dir,
      name,
      ext,
      input,
      meta.width ?? 0,
      meta.height ?? 0,
      input.length
    )
  }
  const { format, data, width, height } = encoded
  return write(root, site.images.dir, name, format, data, width, height, input.length)
}

async function write(
  root: string,
  dir: string,
  name: string,
  ext: string,
  data: Buffer,
  width: number,
  height: number,
  originalBytes: number
): Promise<ProcessedImage> {
  const path = `${dir}/${name}.${shortHash(data)}.${ext}`
  await writeFiles(root, [{ path, content: data }], `Image ${path}`)
  return { src: `/${path}`, width, height, bytes: data.length, originalBytes, format: ext }
}
