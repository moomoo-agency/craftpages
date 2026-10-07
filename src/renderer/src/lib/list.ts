import { useEffect, useState } from 'react'

/** Rows per page in long lists (pages, posts). */
export const PAGE_SIZE = 25
/** Shorter lists show no search box: everything fits on the screen. */
const SEARCH_FROM = 10

/** Search and page per list, kept while the list is closed (e.g. while editing a page). */
const remembered = new Map<string, { query: string; page: number }>()

/** Lowercase without accents, so "pagina" finds "Pàgina". */
const fold = (text: string): string => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

interface FilteredList<T> {
  query: string
  setQuery: (query: string) => void
  page: number
  setPage: (page: number) => void
  /** The rows of the current page. */
  rows: T[]
  /** How many rows match the search. */
  matched: number
  pages: number
  /** Whether the list is long enough for a search box. */
  searchable: boolean
}

/**
 * One search across several texts of each item (e.g. title and file name), then pages
 * of PAGE_SIZE. `id` names the list, so its search and page survive leaving the view.
 */
export function useFilteredList<T>(
  id: string,
  items: T[],
  texts: (item: T) => (string | undefined)[]
): FilteredList<T> {
  const [saved, setSaved] = useState(() => ({
    id,
    ...(remembered.get(id) ?? { query: '', page: 1 })
  }))
  // Another project in the same view: its own search and page.
  const state = saved.id === id ? saved : { id, ...(remembered.get(id) ?? { query: '', page: 1 }) }
  const setState = (update: (s: typeof state) => typeof state): void =>
    setSaved(() => update(state))
  useEffect(() => {
    remembered.set(state.id, { query: state.query, page: state.page })
  }, [state.id, state.query, state.page])

  const words = fold(state.query).split(/\s+/).filter(Boolean)
  const matching = words.length
    ? items.filter((item) => {
        const haystack = fold(texts(item).filter(Boolean).join(' '))
        return words.every((word) => haystack.includes(word))
      })
    : items
  const pages = Math.max(1, Math.ceil(matching.length / PAGE_SIZE))
  // A shorter list (search, deleted rows) never leaves you on an empty page.
  const page = Math.min(state.page, pages)

  return {
    query: state.query,
    setQuery: (query) => setState((s) => ({ ...s, query, page: 1 })),
    page,
    setPage: (next) => setState((s) => ({ ...s, page: next })),
    rows: matching.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    matched: matching.length,
    pages,
    searchable: items.length > SEARCH_FROM || state.query !== ''
  }
}
