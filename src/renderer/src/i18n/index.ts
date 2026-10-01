import { Fragment, createElement, useMemo, useSyncExternalStore } from 'react'
import { en, type Catalog } from './en'
import { it } from './it'
import { uk } from './uk'
import type { Msg, Translation } from './types'

export type { Msg, Plural, Translation } from './types'

/**
 * UI translations. English is the source: `en/<namespace>.ts` defines every key, and the
 * other languages are typed against it, so a missing or extra key fails the typecheck.
 *
 *   const t = useT()
 *   t('common.save')                         → "Save"
 *   t('app.pagesCount', { count: 3 })        → "3 pages"   (plural forms by Intl.PluralRules)
 *   t('app.hello', { name })                 → "{name}" filled in
 *   tr('app.rich', { b: (s) => <b>{s}</b> }) → "<b>bold</b>" tags become elements
 */

export type Locale = 'en' | 'it' | 'uk'

export const LOCALES: { code: Locale; name: string; english: string }[] = [
  { code: 'en', name: 'English', english: 'English' },
  { code: 'it', name: 'Italiano', english: 'Italian' },
  { code: 'uk', name: 'Українська', english: 'Ukrainian' }
]

const CATALOGS: Record<Locale, Translation> = { en, it, uk }

/** Every key, as "namespace.key". */
export type Key = {
  [N in keyof Catalog]: `${N & string}.${keyof Catalog[N] & string}`
}[keyof Catalog]

export type Params = Record<string, string | number>

const STORAGE_KEY = 'craftpages.locale'

function initialLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && stored in CATALOGS) return stored as Locale
  } catch {
    // Storage unavailable: fall back to the OS language.
  }
  const os = navigator.language.slice(0, 2).toLowerCase()
  return os in CATALOGS ? (os as Locale) : 'en'
}

let current: Locale = initialLocale()
const listeners = new Set<() => void>()
document.documentElement.lang = current

export function getLocale(): Locale {
  return current
}

export function setLocale(locale: Locale): void {
  if (locale === current) return
  current = locale
  document.documentElement.lang = locale
  try {
    localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    // Not persisted; still applied for this session.
  }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * The BCP 47 tag for dates and numbers. English follows the OS region (en-GB, en-US…)
 * so dates keep the order people are used to.
 */
export function intlLocale(locale: Locale = current): string {
  if (locale === 'en') return navigator.language.startsWith('en') ? navigator.language : 'en'
  return locale
}

const pluralRules = new Map<Locale, Intl.PluralRules>()

function pick(message: Msg, locale: Locale, count: unknown): string {
  if (typeof message === 'string') return message
  let rules = pluralRules.get(locale)
  if (!rules) pluralRules.set(locale, (rules = new Intl.PluralRules(locale)))
  const form = typeof count === 'number' ? rules.select(count) : 'other'
  return message[form] ?? message.other
}

function lookup(key: Key, locale: Locale): Msg {
  const dot = key.indexOf('.')
  const namespace = key.slice(0, dot) as keyof Translation
  const name = key.slice(dot + 1)
  const table = CATALOGS[locale][namespace] as Record<string, Msg>
  return table[name] ?? (en[namespace] as Record<string, Msg>)[name] ?? key
}

function format(key: Key, params: Params | undefined, locale: Locale): string {
  const text = pick(lookup(key, locale), locale, params?.count)
  if (!params) return text
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = params[name]
    if (value === undefined) return whole
    return typeof value === 'number' ? value.toLocaleString(intlLocale(locale)) : value
  })
}

/** Translate outside React (event handlers, helpers). Components should prefer `useT`. */
export function translate(key: Key, params?: Params): string {
  return format(key, params, current)
}

type RichParams = Record<
  string,
  string | number | React.ReactNode | ((chunk: string) => React.ReactNode)
>

/**
 * A message with markup: `{name}` takes a string, number or element, and `<tag>text</tag>`
 * calls the function given for `tag` with the inner text. Tags don't nest.
 */
function formatRich(key: Key, params: RichParams, locale: Locale): React.ReactNode {
  const counted = typeof params.count === 'number' ? params.count : undefined
  const text = pick(lookup(key, locale), locale, counted)
  const parts: React.ReactNode[] = []
  const pattern = /<(\w+)>(.*?)<\/\1>|\{(\w+)\}/g
  let last = 0
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    const [whole, tag, inner, name] = match
    const value = params[tag ?? name]
    if (tag && typeof value === 'function') parts.push(value(inner))
    else if (tag) parts.push(inner)
    else if (value === undefined) parts.push(whole)
    else if (typeof value === 'number') parts.push(value.toLocaleString(intlLocale(locale)))
    else parts.push(value as React.ReactNode)
    last = match.index + whole.length
  }
  if (last < text.length) parts.push(text.slice(last))
  return createElement(Fragment, null, ...parts)
}

export interface Translator {
  (key: Key, params?: Params): string
  /** Rich variant: see `formatRich`. */
  rich: (key: Key, params: RichParams) => React.ReactNode
  locale: Locale
}

/** The translator for the current language; re-renders the component when it changes. */
export function useT(): Translator {
  const locale = useSyncExternalStore(subscribe, getLocale)
  return useMemo(
    () =>
      Object.assign((key: Key, params?: Params) => format(key, params, locale), {
        rich: (key: Key, params: RichParams) => formatRich(key, params, locale),
        locale
      }),
    [locale]
  )
}

/** The current language and a setter, for the language picker. */
export function useLocale(): [Locale, (locale: Locale) => void] {
  return [useSyncExternalStore(subscribe, getLocale), setLocale]
}
