import type { SiteSettings } from '../../shared/types'

/**
 * Files left out of publishing (Project settings → Deploy → Never upload). A pattern without
 * a slash matches file names anywhere (`.DS_Store`); one with a slash matches the path
 * from the site root (`drafts/**`, `/about/index.html`).
 */

function globToRegExp(glob: string): RegExp {
  const pattern = glob
    .split('**')
    .map((part) =>
      part
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '[^/]*')
        .replace(/\?/g, '[^/]')
    )
    .join('.*')
  return new RegExp(`^${pattern}$`)
}

/** The first pattern that leaves `path` out, or null when it is published. */
export function excludedBy(patterns: string[], path: string): string | null {
  for (const raw of patterns) {
    const pattern = raw.trim()
    if (!pattern) continue
    const byName = !pattern.includes('/')
    const regexp = globToRegExp(pattern.replace(/^\/+/, ''))
    if (regexp.test(byName ? path.slice(path.lastIndexOf('/') + 1) : path)) return pattern
  }
  return null
}

export function excluder(patterns: string[]): (path: string) => boolean {
  return (path) => excludedBy(patterns, path) !== null
}

/** The pattern the page switch writes: the exact path, rooted so it never matches by name. */
export const pagePattern = (path: string): string => `/${path}`

export const isPublished = (site: SiteSettings, path: string): boolean =>
  excludedBy(site.deploy.exclude, path) === null
