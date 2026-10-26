import { createHash } from 'crypto'
import { posix } from 'path'
import { gzipSync } from 'zlib'
import { minify as minifyCss } from 'csso'
import { minify as minifyJs } from 'terser'
import {
  applyPatches,
  attr,
  escapeAttr,
  parseWithLocations,
  walk,
  type Element,
  type Patch
} from '../html/dom'
import { log } from '../log'
import type { SiteSettings } from '../../shared/types'

/**
 * Publish-time speed work, done on the copy that is uploaded. The files in the site
 * folder stay exactly as written, so the site stays as easy to edit as before:
 *
 * - **minify**: CSS (csso, structure kept) and JavaScript (terser). A file that fails
 *   to minify is sent as it is; a publish never fails for this.
 * - **cache**: every stylesheet, font and image a page or stylesheet points at also goes
 *   up as `_v/<hash>/<path>`, its address changes whenever its content does, and pages and
 *   stylesheets point there. Those copies are cached by browsers for a year (`_headers`
 *   on Cloudflare, `.htaccess` on a server). The originals stay where they were, for
 *   anything that links to them from outside. JavaScript is never versioned: scripts
 *   find their sibling files from their own address (document.currentScript).
 * - **inlineCssKb**: stylesheets go straight into the pages that use them while their
 *   gzipped size fits that budget per page, so the first paint doesn't wait for them.
 *
 * The output keeps each reference's style: a root-absolute address stays root-absolute
 * (a 404 page is served at any address), a relative one stays relative (a site in a
 * server subfolder).
 */

/** Bumped whenever the same files and settings would give a different output. */
const OPTIMIZER_VERSION = 1

export const VERSIONED_DIR = '_v'

const LONG_CACHE = 'public, max-age=31536000, immutable'

/** Files that get a versioned copy when something points at them. */
const VERSIONABLE = /\.(css|woff2?|ttf|otf|eot|png|jpe?g|gif|webp|avif|svg|ico|mp4|webm)$/i
const isCss = (path: string): boolean => /\.css$/i.test(path)
const isJs = (path: string): boolean => /\.(m?js|cjs)$/i.test(path)
const isHtml = (path: string): boolean => /\.html?$/i.test(path)
const isMinified = (path: string): boolean => /\.min\.(css|m?js)$/i.test(path)

export type OptimizeSettings = SiteSettings['optimize']

/** Whether a publish with these settings changes anything at all. */
export const optimizing = (settings: OptimizeSettings): boolean =>
  settings.minify || settings.cache || settings.inlineCssKb > 0

/**
 * What the output depends on besides the files: kept with the deploy state, so changing
 * a speed setting shows up as something to publish. null when nothing is optimized.
 */
export function optimizeSignature(settings: OptimizeSettings, server: boolean): string | null {
  if (!optimizing(settings)) return null
  return JSON.stringify({
    v: OPTIMIZER_VERSION,
    minify: settings.minify,
    cache: settings.cache,
    inlineCssKb: settings.inlineCssKb,
    server
  })
}

/** One file of the published copy: new bytes, or the bytes of a file in the folder. */
export interface OutputFile {
  path: string
  /** Set when the bytes differ from the folder's file (or there is no such file). */
  content?: Buffer
  /** The folder file whose bytes go up, when `content` isn't set (a versioned image). */
  from?: string
}

export interface OptimizeInput {
  /** The files a publish sends, site-relative. */
  paths: string[]
  read: (path: string) => Promise<Buffer>
  settings: OptimizeSettings
  /** A server reads `.htaccess`; Cloudflare reads `_headers`. */
  server: boolean
}

const shortHash = (data: Buffer | string): string =>
  createHash('sha256').update(data).digest('hex').slice(0, 10)

// ---------- References ----------

interface Ref {
  /** The site file it points at. */
  path: string
  /** `/assets/x.css` rather than `../assets/x.css`. */
  absolute: boolean
  /** `?query#fragment` as written. */
  query: string
  fragment: string
}

const SCHEME = /^[a-z][a-z0-9+.-]*:/i

/** The site file a reference in `from` points at, or null for anything else. */
export function resolveRef(from: string, ref: string): Ref | null {
  const value = ref.trim()
  if (!value || value.startsWith('#') || value.startsWith('//') || SCHEME.test(value)) return null
  const hashAt = value.indexOf('#')
  const fragment = hashAt >= 0 ? value.slice(hashAt) : ''
  const withoutHash = hashAt >= 0 ? value.slice(0, hashAt) : value
  const queryAt = withoutHash.indexOf('?')
  const query = queryAt >= 0 ? withoutHash.slice(queryAt) : ''
  let path = queryAt >= 0 ? withoutHash.slice(0, queryAt) : withoutHash
  if (!path || path.endsWith('/')) return null
  try {
    path = decodeURI(path)
  } catch {
    return null
  }
  const absolute = path.startsWith('/')
  const joined = absolute
    ? posix.normalize(path.slice(1))
    : posix.normalize(posix.join(posix.dirname(from), path))
  if (joined.startsWith('../') || joined === '..' || joined.startsWith('/')) return null
  return { path: joined, absolute, query, fragment }
}

/** How `from` (served at that site path) writes the address of `target`. */
function addressOf(from: string, target: string, absolute: boolean): string {
  if (absolute) return encodeURI(`/${target}`)
  const relative = posix.relative(posix.dirname(from), target)
  return encodeURI(relative || posix.basename(target))
}

const URL_IN_CSS = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^'")\s]*))\s*\)/g
const IMPORT_IN_CSS = /@import\s+(["'])([^"']+)\1/g

/**
 * Rewrites every url() and @import in a stylesheet. `rewrite` gets the address as written
 * and returns its replacement, or null to leave it.
 */
function rewriteCss(css: string, rewrite: (ref: string) => string | null): string {
  const quote = (value: string): string => (/[\s"'()]/.test(value) ? JSON.stringify(value) : value)
  return css
    .replace(URL_IN_CSS, (whole, double: string, single: string, bare: string) => {
      const ref = double ?? single ?? bare ?? ''
      if (/^data:/i.test(ref)) return whole
      const next = rewrite(ref)
      return next === null ? whole : `url(${quote(next)})`
    })
    .replace(IMPORT_IN_CSS, (whole, mark: string, ref: string) => {
      const next = rewrite(ref)
      return next === null ? whole : `@import ${mark}${next}${mark}`
    })
}

/** srcset: comma-separated "url descriptor" candidates. */
function rewriteSrcset(value: string, rewrite: (ref: string) => string | null): string {
  return value
    .split(',')
    .map((candidate) => {
      const match = candidate.match(/^(\s*)(\S+)(.*)$/s)
      if (!match) return candidate
      const next = rewrite(match[2])
      return next === null ? candidate : `${match[1]}${next}${match[3]}`
    })
    .join(',')
}

// ---------- Minify ----------

async function minified(path: string, bytes: Buffer): Promise<Buffer> {
  if (isMinified(path)) return bytes
  const text = bytes.toString('utf8')
  try {
    if (isCss(path)) {
      // restructure: false keeps rule order and grouping, so nothing in the cascade moves.
      return Buffer.from(minifyCss(text, { restructure: false }).css)
    }
    if (isJs(path)) {
      const result = await minifyJs(text, {
        module: /\.mjs$/i.test(path),
        compress: { passes: 1 },
        mangle: true,
        format: { comments: 'some' }
      })
      if (result.code !== undefined) return Buffer.from(result.code)
    }
  } catch (error) {
    log.warn('publish', `Not minified (sent as written): ${path}`, error)
  }
  return bytes
}

// ---------- The published copy ----------

/** The files a publish sends, after minifying, versioning and inlining. */
export async function optimizeSite(input: OptimizeInput): Promise<OutputFile[]> {
  const { settings, server } = input
  const site = new Set(input.paths)
  const output = new Map<string, OutputFile>()
  const text = new Map<string, string>()

  // 1. Minify, and keep the text of everything later steps read.
  for (const path of input.paths) {
    if (!isCss(path) && !isJs(path) && !isHtml(path) && path !== '_headers') continue
    const bytes = await input.read(path)
    const next =
      settings.minify && (isCss(path) || isJs(path)) ? await minified(path, bytes) : bytes
    if (next !== bytes) output.set(path, { path, content: next })
    text.set(path, next.toString('utf8'))
  }

  // 2. Versioned copies: leaves first, a stylesheet once the files it points at have theirs.
  const versioned = new Map<string, string>()
  const visiting = new Set<string>()
  const PLACEHOLDER = 'x'.repeat(10)
  const versionOf = async (path: string): Promise<string | null> => {
    if (!settings.cache || !site.has(path) || !VERSIONABLE.test(path)) return null
    const known = versioned.get(path)
    if (known) return known
    if (visiting.has(path)) return null // stylesheets importing each other: left as they are
    visiting.add(path)
    try {
      let target: string
      if (isCss(path)) {
        // Where the copy is served decides its relative addresses; only the depth matters.
        const servedAt = `${VERSIONED_DIR}/${PLACEHOLDER}/${path}`
        const css = await rewriteCssAsync(text.get(path) ?? '', async (ref) => {
          const found = resolveRef(path, ref)
          const copy = found && (await versionOf(found.path))
          return copy ? addressOf(servedAt, copy, found.absolute) + found.fragment : null
        })
        target = `${VERSIONED_DIR}/${shortHash(css)}/${path}`
        output.set(target, { path: target, content: Buffer.from(css) })
      } else {
        target = `${VERSIONED_DIR}/${shortHash(await input.read(path))}/${path}`
        output.set(target, { path: target, from: path })
      }
      versioned.set(path, target)
      return target
    } finally {
      visiting.delete(path)
    }
  }

  // A stylesheet's addresses, rebased onto the page it's inlined into.
  const rebasedCss = async (cssPath: string, page: string, absolute: boolean): Promise<string> =>
    rewriteCssAsync(text.get(cssPath) ?? '', async (ref) => {
      const found = resolveRef(cssPath, ref)
      if (!found) return null
      const copy = await versionOf(found.path)
      if (copy) return addressOf(page, copy, absolute || found.absolute) + found.fragment
      // Unversioned: the same file, written from the page's folder (or from the root).
      return addressOf(page, found.path, absolute || found.absolute) + found.query + found.fragment
    })

  // 3. Pages.
  const budget = settings.inlineCssKb * 1024
  for (const page of input.paths.filter(isHtml)) {
    const source = text.get(page)
    if (source === undefined) continue
    const document = parseWithLocations(source)
    // A <base> changes what every relative address means: such a page is left as it is.
    let hasBase = false
    walk(document, (element) => {
      if (element.tagName === 'base') hasBase = true
    })
    if (hasBase) continue

    const patches: Patch[] = []
    let inlined = 0
    const pageRef = async (ref: string): Promise<string | null> => {
      const found = resolveRef(page, ref)
      const copy = found && (await versionOf(found.path))
      return copy ? addressOf(page, copy, found.absolute) + found.fragment : null
    }
    const setAttr = async (
      element: Element,
      name: string,
      rewrite: (value: string) => Promise<string>
    ): Promise<void> => {
      const value = attr(element, name)
      const location = element.sourceCodeLocation?.attrs?.[name]
      if (value === undefined || !location) return
      const next = await rewrite(value)
      if (next !== value)
        patches.push({
          start: location.startOffset,
          end: location.endOffset,
          text: `${name}="${escapeAttr(next)}"`
        })
    }

    const elements: Element[] = []
    walk(document, (element) => {
      elements.push(element)
    })
    for (const element of elements) {
      const tag = element.tagName
      const rel = (attr(element, 'rel') ?? '').toLowerCase().split(/\s+/)
      if (tag === 'link' && rel.includes('stylesheet') && budget > 0) {
        const href = attr(element, 'href') ?? ''
        const found = resolveRef(page, href)
        const location = element.sourceCodeLocation
        const css = found ? text.get(found.path) : undefined
        if (
          found &&
          css !== undefined &&
          location?.startTag &&
          !attr(element, 'disabled') &&
          attr(element, 'title') === undefined &&
          !/@import/i.test(css)
        ) {
          const size = gzipSync(css).length
          if (inlined + size <= budget) {
            inlined += size
            const body = (await rebasedCss(found.path, page, found.absolute)).replace(
              /<\/style/gi,
              '<\\/style'
            )
            const media = attr(element, 'media')
            const open =
              media && media !== 'all' ? `<style media="${escapeAttr(media)}">` : '<style>'
            patches.push({
              start: location.startTag.startOffset,
              end: location.startTag.endOffset,
              text: `${open}${body}</style>`
            })
            continue
          }
        }
      }
      if (!settings.cache) continue
      if (
        tag === 'link' &&
        rel.some((r) =>
          ['stylesheet', 'preload', 'icon', 'apple-touch-icon', 'mask-icon'].includes(r)
        )
      )
        await setAttr(element, 'href', async (value) => (await pageRef(value)) ?? value)
      if (['img', 'source', 'video', 'audio', 'track'].includes(tag))
        await setAttr(element, 'src', async (value) => (await pageRef(value)) ?? value)
      if (tag === 'img' || tag === 'source') {
        const value = attr(element, 'srcset')
        if (value !== undefined) {
          const refs = new Map<string, string>()
          for (const candidate of value.split(',')) {
            const url = candidate.trim().split(/\s+/)[0]
            if (url) {
              const next = await pageRef(url)
              if (next) refs.set(url, next)
            }
          }
          await setAttr(element, 'srcset', async (v) =>
            rewriteSrcset(v, (url) => refs.get(url) ?? null)
          )
        }
      }
      if (tag === 'video')
        await setAttr(element, 'poster', async (value) => (await pageRef(value)) ?? value)
      if (attr(element, 'style')?.includes('url('))
        await setAttr(element, 'style', (value) => rewriteCssAsync(value, pageRef))
      if (tag === 'style') {
        const node = element.childNodes[0] as
          | { value?: string; sourceCodeLocation?: { startOffset: number; endOffset: number } }
          | undefined
        if (node?.value?.includes('url(') && node.sourceCodeLocation) {
          const next = await rewriteCssAsync(node.value, pageRef)
          if (next !== node.value)
            patches.push({
              start: node.sourceCodeLocation.startOffset,
              end: node.sourceCodeLocation.endOffset,
              text: next
            })
        }
      }
    }
    if (patches.length) {
      try {
        output.set(page, { path: page, content: Buffer.from(applyPatches(source, patches)) })
      } catch (error) {
        log.warn('publish', `Not optimized (sent as written): ${page}`, error)
      }
    }
  }

  // 4. A year of caching for the versioned copies.
  if (settings.cache && versioned.size) {
    if (server) {
      const htaccess = `${VERSIONED_DIR}/.htaccess`
      output.set(htaccess, {
        path: htaccess,
        content: Buffer.from(
          `# Written by CraftPages: these copies change address when they change.\n<IfModule mod_headers.c>\n  Header set Cache-Control "${LONG_CACHE}"\n</IfModule>\n`
        )
      })
    } else {
      const current = text.get('_headers') ?? ''
      const rule = `/${VERSIONED_DIR}/*\n  Cache-Control: ${LONG_CACHE}\n`
      output.set('_headers', {
        path: '_headers',
        content: Buffer.from(
          `${current.replace(/\s*$/, '')}${current.trim() ? '\n\n' : ''}# Added by CraftPages when publishing: versioned copies.\n${rule}`
        )
      })
    }
  }

  // Everything else goes up as it is.
  const files: OutputFile[] = input.paths.map((path) => output.get(path) ?? { path, from: path })
  for (const [path, file] of output) if (!site.has(path)) files.push(file)
  return files
}

/** rewriteCss with an async rewrite: the addresses are collected first, then replaced. */
async function rewriteCssAsync(
  css: string,
  rewrite: (ref: string) => Promise<string | null>
): Promise<string> {
  const refs = new Set<string>()
  rewriteCss(css, (ref) => {
    refs.add(ref)
    return null
  })
  const answers = new Map<string, string | null>()
  for (const ref of refs) answers.set(ref, await rewrite(ref))
  return rewriteCss(css, (ref) => answers.get(ref) ?? null)
}
