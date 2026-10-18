import { mkdir, readFile, stat, writeFile } from 'fs/promises'
import { basename, extname, join } from 'path'
import sharp from 'sharp'
import type { FileWrite } from './history'
import { shortHash, slug } from './images'
import { APP_DIR } from './settings'
import type { SiteSettings } from '../shared/types'

/**
 * Share images for posts. Facebook, LinkedIn and X show a 1.91:1 card and crop anything
 * else their own way (or drop images over a few MB), so an image that doesn't already fit
 * gets a 1200×630 JPEG crop next to it, made once:
 *
 * - The crop is named after the source's content hash, so it is built once per image and a
 *   synced copy of the site finds it already there.
 * - Hashing needs the bytes, so `.sitecms/media/social.json` remembers each source's hash and
 *   size by path + size + mtime. A blog regeneration then costs one `stat` per post.
 */

export const WIDTH = 1200
export const HEIGHT = 630
/** Sources this close to 1.91:1, small enough and in a format every network reads, are used as they are. */
const FITS = { minRatio: 1.8, maxRatio: 2.05, minWidth: 600, maxWidth: 2400, maxBytes: 1024 * 1024 }
const CACHE = join(APP_DIR, 'media', 'social.json')
const VERSION = 1

export interface SocialImage {
  /** Site path (`/assets/…`) or an absolute URL. */
  src: string
  width?: number
  height?: number
}

interface Source {
  size: number
  mtime: number
  hash: string
  width: number
  height: number
  format: string
}

interface Cache {
  version: number
  sources: Record<string, Source>
  /** Crops made (or found) here: only these are ever removed, never other files in the folder. */
  crops: string[]
}

const socialDir = (site: SiteSettings): string => `${site.images.dir}/og`

export class SocialImages {
  private cache: Cache = { version: VERSION, sources: {}, crops: [] }
  private loaded = false
  private dirty = false
  /** Crops to write, by path. */
  readonly writes = new Map<string, FileWrite>()
  /** Every crop a post uses, written now or already there. */
  readonly used = new Set<string>()

  constructor(
    private readonly root: string,
    private readonly site: SiteSettings,
    /** Preview: never crop, use the source. */
    private readonly dryRun = false
  ) {}

  /**
   * The share image for this source (a site path), cropping it if it needs to be. `focus`
   * places the crop (see `PostRecord.shareFocus`); without one, sharp picks the busy part.
   */
  async resolve(
    src: string | null | undefined,
    focus?: readonly [number, number] | null
  ): Promise<SocialImage | null> {
    if (!src) return null
    if (!src.startsWith('/') || this.dryRun) return { src }
    const path = decodeURI(src.slice(1).split(/[?#]/)[0])
    const source = await this.source(path)
    if (!source) return { src }
    const ratio = source.width / source.height
    if (
      (source.format === 'jpeg' || source.format === 'png') &&
      ratio >= FITS.minRatio &&
      ratio <= FITS.maxRatio &&
      source.width >= FITS.minWidth &&
      source.width <= FITS.maxWidth &&
      source.size <= FITS.maxBytes
    ) {
      return { src, width: source.width, height: source.height }
    }
    const at = focusOf(focus)
    // A placed crop is another file: the name hashes the place too.
    const hash = at ? shortHash(Buffer.from(`${source.hash}@${at.join(',')}`)) : source.hash
    const crop = `${socialDir(this.site)}/${slug(basename(path, extname(path)))}.${hash}.jpg`
    this.used.add(crop)
    if (!this.cache.crops.includes(crop)) {
      this.cache.crops.push(crop)
      this.dirty = true
    }
    if (!this.writes.has(crop) && !(await exists(join(this.root, crop)))) {
      const input = await readFile(join(this.root, path))
      const image = sharp(input, { failOn: 'none' }).rotate()
      if (at) {
        // Scale to cover 1200×630, then cut where `object-position` shows it in the editor.
        const meta = await sharp(input).metadata()
        const [w, h] =
          (meta.orientation ?? 1) >= 5 ? [meta.height!, meta.width!] : [meta.width!, meta.height!]
        const scale = Math.max(WIDTH / w, HEIGHT / h)
        const rw = Math.max(WIDTH, Math.round(w * scale))
        const rh = Math.max(HEIGHT, Math.round(h * scale))
        image.resize(rw, rh).extract({
          left: Math.round(at[0] * (rw - WIDTH)),
          top: Math.round(at[1] * (rh - HEIGHT)),
          width: WIDTH,
          height: HEIGHT
        })
      } else {
        image.resize(WIDTH, HEIGHT, { fit: 'cover', position: sharp.strategy.attention })
      }
      const data = await image
        .flatten({ background: '#ffffff' })
        .jpeg({ quality: 82, mozjpeg: true })
        .toBuffer()
      this.writes.set(crop, { path: crop, content: data })
    }
    return { src: `/${crop}`, width: WIDTH, height: HEIGHT }
  }

  /** Crops no post uses any more; forgotten here, so the caller should delete them. */
  takeUnused(): string[] {
    const unused = this.cache.crops.filter((crop) => !this.used.has(crop))
    if (unused.length) {
      this.cache.crops = this.cache.crops.filter((crop) => this.used.has(crop))
      this.dirty = true
    }
    return unused
  }

  /** Saves what was learned about the sources (call once, after resolving). */
  async save(): Promise<void> {
    if (!this.dirty) return
    await mkdir(join(this.root, APP_DIR, 'media'), { recursive: true })
    await writeFile(join(this.root, CACHE), JSON.stringify(this.cache))
    this.dirty = false
  }

  private async source(path: string): Promise<Source | null> {
    if (!this.loaded) {
      this.loaded = true
      try {
        const cache = JSON.parse(await readFile(join(this.root, CACHE), 'utf8')) as Cache
        if (cache.version === VERSION && cache.sources && Array.isArray(cache.crops)) {
          this.cache = cache
        }
      } catch {
        // No cache yet, or unreadable: it's rebuilt.
      }
    }
    let info
    try {
      info = await stat(join(this.root, path))
    } catch {
      return null
    }
    const known = this.cache.sources[path]
    if (known && known.size === info.size && known.mtime === info.mtimeMs) return known
    try {
      const data = await readFile(join(this.root, path))
      const meta = await sharp(data).metadata()
      if (!meta.width || !meta.height || !meta.format) return null
      // Hash the crop recipe too, so a change to it makes new files instead of reusing old ones.
      const source: Source = {
        size: info.size,
        mtime: info.mtimeMs,
        hash: shortHash(Buffer.concat([data, Buffer.from(`${WIDTH}x${HEIGHT}:v${VERSION}`)])),
        width: meta.width,
        height: meta.height,
        format: meta.format
      }
      this.cache.sources[path] = source
      this.dirty = true
      return source
    } catch {
      // Not an image sharp can read: shared as it is.
      return null
    }
  }
}

/** A focus worth placing a crop by, rounded so tiny drags don't make new files; else null. */
export function focusOf(
  focus: readonly [number, number] | null | undefined
): [number, number] | null {
  if (!focus || focus.length !== 2 || !focus.every((n) => Number.isFinite(n))) return null
  return [round(focus[0]), round(focus[1])]
}

const round = (n: number): number => Math.round(Math.min(1, Math.max(0, n)) * 100) / 100

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}
