/**
 * Blog URL rules, shared by the generator (main) and the editor (renderer) so
 * both always agree on where a post lives.
 *
 * - Post URL: the permalink pattern with %postname% replaced by the slug,
 *   e.g. /blog/%postname%/, /%postname%/ (like WordPress) or /articles/%postname%/.
 * - List URL: its own setting (default /blog/), since with /%postname%/ there's
 *   no prefix to derive it from. Page 2+ live at <list>page/2/.
 */

export const DEFAULT_PERMALINK = '/blog/%postname%/'
export const DEFAULT_LIST_PATH = '/blog/'

/** Folder-style path: leading and trailing slash, no doubles. */
export function normalizePath(path: string): string {
  const clean = ('/' + path.trim() + '/').replace(/\/+/g, '/')
  return clean
}

export function normalizePermalink(pattern: string): string {
  const value = pattern.trim() || DEFAULT_PERMALINK
  if (!value.includes('%postname%'))
    throw new Error('The post URL pattern must contain %postname%.')
  return normalizePath(value)
}

export function postPath(permalink: string, slug: string): string {
  const pattern = permalink.includes('%postname%') ? permalink : DEFAULT_PERMALINK
  return normalizePath(pattern.replace('%postname%', slug))
}

/** The part of the permalink before the slug, e.g. "/blog/" or "/". */
export function postPrefix(permalink: string): string {
  const pattern = permalink.includes('%postname%') ? permalink : DEFAULT_PERMALINK
  return normalizePath(pattern.split('%postname%')[0])
}

export function listPath(list: string, page = 1): string {
  const root = normalizePath(list || DEFAULT_LIST_PATH)
  return page === 1 ? root : `${root}page/${page}/`
}

/** Site path → file in the site folder: /blog/x/ → blog/x/index.html */
export const fileOfPath = (path: string): string => path.replace(/^\/+/, '') + 'index.html'

/** "Hello, World! Ça va?" → "hello-world-ca-va" */
export function slugify(text: string): string {
  return (
    text
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80)
      .replace(/-+$/, '') || 'post'
  )
}

export const isValidSlug = (slug: string): boolean => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
