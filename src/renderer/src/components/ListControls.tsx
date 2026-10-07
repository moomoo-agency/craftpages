import { useT } from '../i18n'
import { PAGE_SIZE } from '../lib/list'

/** The search box above a list. */
export function ListSearch({
  value,
  onChange,
  label
}: {
  value: string
  onChange: (value: string) => void
  label: string
}): React.JSX.Element {
  return (
    <div className="list-search">
      <input
        type="search"
        placeholder={label}
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && value && onChange('')}
      />
    </div>
  )
}

/** "Nothing matches" for a search with no results. */
export function NoMatches({
  query,
  onClear
}: {
  query: string
  onClear: () => void
}): React.JSX.Element {
  const t = useT()
  return (
    <p className="muted list-empty">
      {t('common.noMatches', { query })}{' '}
      <button className="link" onClick={onClear}>
        {t('common.clearSearch')}
      </button>
    </p>
  )
}

/** Page numbers to show: the first, the last and the current one with its neighbours. */
function pageNumbers(page: number, pages: number): (number | null)[] {
  const shown = [...new Set([1, page - 1, page, page + 1, pages])]
    .filter((n) => n >= 1 && n <= pages)
    .sort((a, b) => a - b)
  const out: (number | null)[] = []
  shown.forEach((n, i) => {
    if (i > 0 && n - shown[i - 1] > 1) out.push(n - shown[i - 1] === 2 ? n - 1 : null)
    out.push(n)
  })
  return out
}

/** "Showing 26–50 of 132" with Previous / page numbers / Next. Hidden on a single page. */
export function Pagination({
  page,
  pages,
  total,
  onPage
}: {
  page: number
  pages: number
  total: number
  onPage: (page: number) => void
}): React.JSX.Element | null {
  const t = useT()
  if (pages <= 1) return null
  return (
    <nav className="pagination" aria-label={t('common.pagination')}>
      <span className="muted small" aria-live="polite">
        {t('common.showing', {
          from: (page - 1) * PAGE_SIZE + 1,
          to: Math.min(page * PAGE_SIZE, total),
          total
        })}
      </span>
      <span className="pagination__buttons">
        <button className="btn btn--small" disabled={page === 1} onClick={() => onPage(page - 1)}>
          <span aria-hidden="true">← </span>
          {t('common.previous')}
        </button>
        {pageNumbers(page, pages).map((n, i) =>
          n === null ? (
            <span key={`gap-${i}`} className="pagination__gap" aria-hidden="true">
              …
            </span>
          ) : (
            <button
              key={n}
              className={`btn btn--small pagination__page${n === page ? ' is-current' : ''}`}
              aria-label={t('common.goToPage', { n })}
              aria-current={n === page ? 'page' : undefined}
              onClick={() => onPage(n)}
            >
              {n}
            </button>
          )
        )}
        <button
          className="btn btn--small"
          disabled={page === pages}
          onClick={() => onPage(page + 1)}
        >
          {t('common.next')}
          <span aria-hidden="true"> →</span>
        </button>
      </span>
    </nav>
  )
}
