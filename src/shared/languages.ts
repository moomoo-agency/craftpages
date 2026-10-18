import type { PostRecord, SiteLanguage, SiteSettings } from './types'

/**
 * Languages of a site: one folder per language. Whatever is at the root (path '') is the
 * default language; the others live in their folders (`en/`, `pt-br/`).
 */

/** BCP 47-ish: "it", "pt-BR", "zh-Hant". */
export const LANGUAGE_CODE = /^[a-z]{2,3}(-[a-z0-9]{2,8})*$/i

/** A language folder: "en/", "pt-br/", "intl/en/" (no leading slash, one trailing). */
export const LANGUAGE_FOLDER = /^[a-z0-9_-]+(\/[a-z0-9_-]+)*\/$/i

/** "en", "/en", "en/" → "en/"; '' stays the root. */
export function normalizeFolder(folder: string): string {
  const clean = folder
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '')
  return clean ? `${clean}/` : ''
}

export const rootLanguage = (languages: SiteLanguage[]): SiteLanguage | undefined =>
  languages.find((language) => language.path === '')

/** The language a page belongs to, by its folder (the deepest match), or null with no languages set. */
export function languageOfPath(path: string, languages: SiteLanguage[]): SiteLanguage | null {
  let found: SiteLanguage | null = null
  for (const language of languages) {
    if (!language.path) continue
    if (path.startsWith(language.path) && (!found || language.path.length > found.path.length))
      found = language
  }
  return found ?? rootLanguage(languages) ?? null
}

/** `lang="en-US"` on a page of an "en" site is fine; `lang="it"` isn't. */
export function sameLanguage(pageLang: string, code: string): boolean {
  const a = pageLang.trim().toLowerCase()
  const b = code.trim().toLowerCase()
  if (!a) return false
  if (a === b) return true
  // A region on the page alone is more specific, not different.
  return !b.includes('-') && a.split('-')[0] === b
}

/** Language names in the language itself, for the picker and labels. */
export const LANGUAGE_NAMES: Record<string, string> = {
  ar: 'العربية',
  bg: 'Български',
  ca: 'Català',
  cs: 'Čeština',
  da: 'Dansk',
  de: 'Deutsch',
  el: 'Ελληνικά',
  en: 'English',
  'en-gb': 'English (UK)',
  'en-us': 'English (US)',
  es: 'Español',
  et: 'Eesti',
  fi: 'Suomi',
  fr: 'Français',
  he: 'עברית',
  hi: 'हिन्दी',
  hr: 'Hrvatski',
  hu: 'Magyar',
  id: 'Bahasa Indonesia',
  it: 'Italiano',
  ja: '日本語',
  ka: 'ქართული',
  kk: 'Қазақ тілі',
  ko: '한국어',
  lt: 'Lietuvių',
  lv: 'Latviešu',
  nl: 'Nederlands',
  no: 'Norsk',
  pl: 'Polski',
  pt: 'Português',
  'pt-br': 'Português (Brasil)',
  ro: 'Română',
  ru: 'Русский',
  sk: 'Slovenčina',
  sl: 'Slovenščina',
  sr: 'Српски',
  sv: 'Svenska',
  th: 'ไทย',
  tr: 'Türkçe',
  uk: 'Українська',
  vi: 'Tiếng Việt',
  'zh-hans': '简体中文',
  'zh-hant': '繁體中文'
}

export const languageName = (code: string): string =>
  LANGUAGE_NAMES[code.toLowerCase()] ?? LANGUAGE_NAMES[code.toLowerCase().split('-')[0]] ?? code

/** A non-root language by code, or undefined (the root language, or no such language). */
export const folderLanguage = (
  languages: SiteLanguage[],
  code: string | undefined
): SiteLanguage | undefined =>
  code ? languages.find((language) => language.code === code && language.path) : undefined

/**
 * The site as one language's blog sees it: the blog's addresses inside the language's folder
 * (/en/blog/…), its title and date language. The root language gets the site as it is.
 */
export function siteForLanguage(site: SiteSettings, code: string | undefined): SiteSettings {
  const language = folderLanguage(site.languages, code)
  if (!language) return site
  const prefix = '/' + language.path.replace(/\/$/, '')
  return {
    ...site,
    locale: language.code,
    blog: {
      ...site.blog,
      permalink: prefix + site.blog.permalink,
      listPath: prefix + site.blog.listPath,
      title: language.blogTitle?.trim() || site.blog.title
    }
  }
}

/** A post's language view of the site. */
export const siteForPost = (site: SiteSettings, post: Pick<PostRecord, 'lang'>): SiteSettings =>
  siteForLanguage(site, post.lang)

/** The id posts that translate each other share. */
export const postGroup = (post: Pick<PostRecord, 'id' | 'translationOf'>): string =>
  post.translationOf || post.id
