import type { Catalog } from './en'

/** Plural forms, chosen with Intl.PluralRules (Ukrainian uses one / few / many). */
export interface Plural {
  zero?: string
  one?: string
  two?: string
  few?: string
  many?: string
  other: string
}

export type Msg = string | Plural

/** A language: the same namespaces and keys as English. */
export type Translation = { [N in keyof Catalog]: { [K in keyof Catalog[N]]: Msg } }
