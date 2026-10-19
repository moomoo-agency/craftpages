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

/** The address visitors use for a page file: index.html → /, about/index.html → /about/. */
export const addressOfFile = (file: string): string =>
  '/' + file.replace(/^\/+/, '').replace(/(^|\/)index\.html?$/i, '$1')

/**
 * Cyrillic → Latin, by the Ukrainian national transliteration (2010), plus the Russian
 * letters it lacks. Є, Ї, Й, Ю, Я are spelled differently at the start of a word.
 */
const CYRILLIC: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'h',
  ґ: 'g',
  д: 'd',
  е: 'e',
  є: 'ie',
  ж: 'zh',
  з: 'z',
  и: 'y',
  і: 'i',
  ї: 'i',
  й: 'i',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'kh',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'shch',
  ь: '',
  ю: 'iu',
  я: 'ia',
  ё: 'e',
  ы: 'y',
  э: 'e',
  ъ: ''
}
const CYRILLIC_INITIAL: Record<string, string> = { є: 'ye', ї: 'yi', й: 'y', ю: 'yu', я: 'ya' }

function transliterate(text: string): string {
  return text.replace(/[а-яёєіїґ]/g, (letter, offset: number) => {
    const initial = offset === 0 || !/[\p{L}'’]/u.test(text[offset - 1])
    return (initial && CYRILLIC_INITIAL[letter]) || CYRILLIC[letter]
  })
}

/** "Hello, World! Ça va?" → "hello-world-ca-va", "Привіт, світе" → "pryvit-svite" */
export function slugify(text: string): string {
  return (
    transliterate(text.toLowerCase())
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
