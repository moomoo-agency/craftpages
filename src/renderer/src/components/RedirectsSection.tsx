import { useEffect, useId, useRef, useState } from 'react'
import { Explainer, Notice, Section } from './Field'
import { ListSearch, NoMatches, Pagination } from './ListControls'
import { useFilteredList } from '../lib/list'
import { useNotes } from '../lib/notes'
import { useT, type Key } from '../i18n'
import { errorMessage } from '../lib/api'
import type { RedirectsState, SiteRedirect, Workspace } from '../../../shared/types'

interface Row extends SiteRedirect {
  /** Stable while editing (rows come and go). */
  id: number
}

const WARNING: Record<RedirectsState['warnings'][number]['code'], Key> = {
  'page-exists': 'tools.warnPageExists',
  'target-missing': 'tools.warnTargetMissing',
  chain: 'tools.warnChain'
}

/** Old address → new address, kept in _redirects (and .htaccess for a server). */
export default function RedirectsSection({
  workspace
}: {
  workspace: Workspace
}): React.JSX.Element | null {
  const t = useT()
  const id = useId()
  const [state, setState] = useState<RedirectsState | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const nextId = useRef(0)

  const toRows = (rules: SiteRedirect[]): Row[] =>
    rules.map((rule) => ({ ...rule, id: nextId.current++ }))

  const reload = async (): Promise<void> => {
    const next = await window.api.getRedirects()
    setState(next)
    setRows(toRows(next.rules))
  }
  const { busy, run, show } = useNotes(reload)

  useEffect(() => {
    window.api.getRedirects().then(
      (next) => {
        setState(next)
        setRows(next.rules.map((rule) => ({ ...rule, id: nextId.current++ })))
      },
      (e) => setLoadError(errorMessage(e))
    )
  }, [workspace])

  const list = useFilteredList(
    `redirects:${workspace.folder}`,
    rows,
    (row) => [row.from, row.to],
    15
  )

  if (loadError) return <Notice kind="error">{loadError}</Notice>
  if (!state) return null

  const saved = JSON.stringify(state.rules)
  const current = JSON.stringify(rows.map(({ from, to, status }) => ({ from, to, status })))
  const changed = saved !== current
  const update = (rowId: number, patch: Partial<SiteRedirect>): void =>
    setRows(rows.map((row) => (row.id === rowId ? { ...row, ...patch } : row)))
  const warningsFor = (row: Row): RedirectsState['warnings'] => {
    // Warnings belong to the saved list; a row edited since has none until saved.
    const index = state.rules.findIndex((rule) => rule.from === row.from && rule.to === row.to)
    return index < 0 ? [] : state.warnings.filter((w) => w.index === index)
  }

  const add = (): void => {
    setRows([...rows, { from: '/', to: '/', status: 301, id: nextId.current++ }])
    list.setQuery('')
    list.setPage(Math.max(0, Math.ceil((rows.length + 1) / list.pageSize) - 1))
  }

  return (
    <Section
      title={t('tools.redirectsTitle')}
      description={t(
        state.htaccess ? 'tools.redirectsWhereServer' : 'tools.redirectsWhereCloudflare'
      )}
      actions={
        <>
          <button className="btn" onClick={add} disabled={busy}>
            {t('tools.redirectAdd')}
          </button>
          <button
            className="btn btn--primary"
            disabled={busy || !changed}
            onClick={() =>
              run('redirects', async () => {
                const historyId = await window.api.saveRedirects(
                  rows.map(({ from, to, status }) => ({ from, to, status }))
                )
                return historyId
                  ? { kind: 'success', text: t('tools.redirectsSaved'), undo: historyId }
                  : { kind: 'info', text: t('search.nothingChanged') }
              })
            }
          >
            {t('common.save')}
          </button>
        </>
      }
    >
      {rows.length === 0 ? (
        <p className="muted">{t('tools.redirectsNone')}</p>
      ) : (
        <>
          {list.searchable && (
            <ListSearch
              value={list.query}
              onChange={list.setQuery}
              label={t('tools.redirectsSearch')}
            />
          )}
          {list.query && list.matched === 0 && (
            <NoMatches query={list.query} onClear={() => list.setQuery('')} />
          )}
          <table className="list redirects">
            <thead>
              <tr>
                <th scope="col">{t('tools.redirectFrom')}</th>
                <th scope="col">{t('tools.redirectTo')}</th>
                <th scope="col">{t('tools.redirectKind')}</th>
                <th scope="col">
                  <span className="visually-hidden">{t('tools.redirectRemove')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <input
                      className="mono"
                      value={row.from}
                      aria-label={t('tools.redirectFrom')}
                      onChange={(e) => update(row.id, { from: e.target.value })}
                    />
                    {warningsFor(row).map((warning, i) => (
                      <div key={i} className="field__hint redirects__warning">
                        {t(WARNING[warning.code], { detail: warning.detail ?? '' })}
                      </div>
                    ))}
                  </td>
                  <td>
                    <input
                      className="mono"
                      value={row.to}
                      aria-label={t('tools.redirectTo')}
                      onChange={(e) => update(row.id, { to: e.target.value })}
                    />
                  </td>
                  <td>
                    <select
                      value={row.status}
                      aria-label={t('tools.redirectKind')}
                      onChange={(e) =>
                        update(row.id, { status: Number(e.target.value) as 301 | 302 })
                      }
                    >
                      <option value={301}>{t('tools.redirect301')}</option>
                      <option value={302}>{t('tools.redirect302')}</option>
                    </select>
                  </td>
                  <td className="num">
                    <button
                      className="btn btn--small"
                      aria-label={t('tools.redirectRemoveLabel', { from: row.from })}
                      onClick={() => setRows(rows.filter((r) => r.id !== row.id))}
                    >
                      {t('tools.redirectRemove')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination
            page={list.page}
            pages={list.pages}
            total={list.matched}
            onPage={list.setPage}
            pageSize={list.pageSize}
          />
        </>
      )}
      {changed && <p className="muted small">{t('tools.redirectsUnsaved')}</p>}
      {(state.blog > 0 || state.other > 0) && (
        <p className="muted small" id={`${id}-others`}>
          {[
            state.blog ? t('tools.redirectsBlog', { count: state.blog }) : '',
            state.other ? t('tools.redirectsOther', { count: state.other }) : ''
          ]
            .filter(Boolean)
            .join(' ')}
        </p>
      )}
      <Explainer title={t('tools.redirectsHowTitle')}>
        <p>
          {t.rich('tools.redirectsHowFolder', {
            a: <code>/old/*</code>,
            b: <code>/new/:splat</code>
          })}
        </p>
        <p>{t('tools.redirectsHowKinds')}</p>
      </Explainer>
      {show('redirects')}
    </Section>
  )
}
