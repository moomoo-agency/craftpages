import { posix } from 'path'
import type { SiteSettings } from '../shared/types'

/** Site addresses ↔ files, the way static hosts serve them. */

/** Site path of a page file: about/index.html → /about/, contact.html → /contact */
export function urlOfPage(path: string): string {
  if (path === 'index.html') return '/'
  if (path.endsWith('/index.html')) return '/' + path.slice(0, -'index.html'.length)
  return '/' + path.replace(/\.html?$/, '')
}

/**
 * Where a link points inside the site: a file path (with the #fragment),
 * or null for external links, mailto: and the like.
 */
export function resolveLink(
  href: string,
  fromPath: string,
  site: SiteSettings
): { path: string; hash: string } | null {
  let value = href.trim()
  if (!value || /^(mailto:|tel:|javascript:|data:)/i.test(value)) return null
  if (site.baseUrl && value.startsWith(site.baseUrl))
    value = value.slice(site.baseUrl.length) || '/'
  if (/^[a-z][a-z0-9+.-]*:|^\/\//i.test(value)) return null
  const [withoutHash, hash = ''] = value.split('#')
  const pathPart = withoutHash.split('?')[0]
  if (!pathPart) return { path: fromPath, hash } // same-page anchor
  const base = posix.dirname('/' + fromPath)
  const absolute = pathPart.startsWith('/') ? pathPart : posix.join(base, pathPart)
  return { path: decodeURI(posix.normalize(absolute)).replace(/^\/+/, ''), hash }
}

/** The file a site path is served from (Cloudflare Pages rules), or null. */
export function fileFor(path: string, files: Set<string>): string | null {
  const clean = path.replace(/\/+$/, '')
  const candidates =
    path.endsWith('/') || !clean
      ? [`${clean ? clean + '/' : ''}index.html`]
      : [clean, `${clean}.html`, `${clean}/index.html`]
  return candidates.find((candidate) => files.has(candidate)) ?? null
}
