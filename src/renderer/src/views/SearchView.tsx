import { useEffect, useId, useRef, useState } from 'react'
import { Field, Notice, Section } from '../components/Field'
import { ColorField } from '../components/SearchIconForm'
import { translate, useT, type Key } from '../i18n'
import { copyText, errorMessage, formatBytes } from '../lib/api'
import SearchSetup from './SearchSetup'
import type {
  SearchBoxOptions,
  SearchChange,
  SearchIconOptions,
  SearchPageState,
  SearchState,
  Workspace
} from '../../../shared/types'

interface Props {
  workspace: Workspace | null
}

type Status = { kind: 'error' | 'success' | 'info'; text: string; undo?: string } | null

const EXCLUDED: Record<Exclude<SearchPageState['excluded'], ''>, Key | null> = {
  '404': 'search.excluded404',
  // A technical term: shown as is.
  noindex: null,
  meta: 'search.excludedMeta'
}

/** The notice after a change: what was done, how many pages, what was skipped (and why). */
function summary(change: SearchChange, done: string): Status {
  // Skip reasons come from the main process, in English.
  const skipped = change.skipped.length
    ? translate('search.skipped', {
        list: change.skipped.map((s) => `${s.path} (${s.reason})`).join('; ')
      })
    : ''
  if (!change.pages.length && !change.historyId) {
    return {
      kind: change.skipped.length ? 'error' : 'info',
      text: [translate('search.nothingChanged'), skipped].filter(Boolean).join(' ')
    }
  }
  const pages = change.pages.length
    ? translate('search.pagesUpdated', { count: change.pages.length })
    : ''
  return {
    kind: 'success',
    text: [done, pages, skipped].filter(Boolean).join(' '),
    undo: change.historyId ?? undefined
  }
}

/** Site search: add it, the icon that opens it, the box's options, what's indexed. */
export default function SearchView({ workspace }: Props): React.JSX.Element {
  const t = useT()
  const id = useId()
  const [state, setState] = useState<SearchState | null>(null)
  const [box, setBox] = useState<SearchBoxOptions | null>(null)
  const [icon, setIcon] = useState<SearchIconOptions | null>(null)
  const [markup, setMarkup] = useState('')
  const [setup, setSetup] = useState<'add' | 'restyle' | null>(null)
  const [tryUrl, setTryUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<Record<string, Status>>({})
  const tryRef = useRef<HTMLDivElement>(null)

  const note = (section: string, value: Status): void =>
    setStatus((s) => ({ ...s, [section]: value }))

  const reload = async (): Promise<void> => {
    const next = await window.api.getSearch()
    setState(next)
    setBox(next.box)
    setIcon(next.icon)
  }

  useEffect(() => {
    if (!workspace) return
    window.api.getSearch().then(
      (next) => {
        setState(next)
        setBox(next.box)
        setIcon(next.icon)
      },
      (e) => note('search', { kind: 'error', text: errorMessage(e) })
    )
  }, [workspace])

  useEffect(() => {
    if (!icon) return
    let cancelled = false
    window.api.searchIconMarkup(icon).then(
      (html) => !cancelled && setMarkup(html),
      () => !cancelled && setMarkup('')
    )
    return () => {
      cancelled = true
    }
  }, [icon])

  useEffect(() => {
    if (tryUrl) tryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [tryUrl])

  if (!workspace) {
    return (
      <div className="empty">
        <h2>{t('search.title')}</h2>
        <p>{t('common.noProject')}</p>
      </div>
    )
  }
  if (!state || !box || !icon) return <div className="muted">{t('common.loading')}</div>

  if (setup) {
    return (
      <SearchSetup
        mode={setup}
        state={state}
        icon={icon}
        onCancel={() => setSetup(null)}
        onDone={(change, look) => {
          const wasOn = state.enabled
          setSetup(null)
          setIcon(look)
          note(
            'search',
            summary(
              change,
              t(
                setup === 'restyle'
                  ? 'search.iconsRestyled'
                  : wasOn
                    ? 'search.iconAdded'
                    : 'search.searchAdded'
              )
            )
          )
          reload()
        }}
      />
    )
  }

  const run = async (section: string, task: () => Promise<Status>): Promise<void> => {
    setBusy(true)
    note(section, null)
    try {
      note(section, await task())
      await reload()
    } catch (e) {
      note(section, { kind: 'error', text: errorMessage(e) })
    } finally {
      setBusy(false)
    }
  }

  const undo = (section: string, id: string): Promise<void> =>
    run(section, async () => {
      await window.api.revertHistory(id)
      return { kind: 'info', text: t('search.undone') }
    })

  const show = (section: string): React.ReactNode => {
    const current = status[section]
    return (
      current && (
        <div role={current.kind === 'error' ? 'alert' : 'status'}>
          <Notice kind={current.kind}>
            {current.text}{' '}
            {current.undo && (
              <button className="link" onClick={() => undo(section, current.undo!)}>
                {t('common.undo')}
              </button>
            )}
          </Notice>
        </div>
      )
    )
  }

  const tryIt = async (): Promise<void> => {
    // The hash makes the loader open the box as soon as the page is ready.
    setTryUrl(`${await window.api.interactUrl('index.html')}#craftpages-search`)
  }

  if (!state.enabled) {
    return (
      <div className="search-view">
        <section className="panel search-intro">
          <div className="search-intro__text">
            <h2>{t('search.introTitle')}</h2>
            <p>{t('search.introText')}</p>
            <ul className="search-intro__points">
              <li>{t('search.introServerless')}</li>
              <li>{t('search.introKeyboard')}</li>
              <li>{t('search.introClean')}</li>
            </ul>
            <button className="btn btn--primary btn--large" onClick={() => setSetup('add')}>
              {t('search.introAdd')}
            </button>
          </div>
        </section>
        {show('search')}
      </div>
    )
  }

  const withScript = state.pages.filter((p) => p.script).length
  const missing = state.pages.length - withScript
  const triggers = state.pages.reduce((sum, p) => sum + p.triggers, 0)
  const pagesWithTriggers = state.pages.filter((p) => p.triggers > 0).length

  return (
    <div className="search-view">
      <Section
        title={t('search.onTitle')}
        description={
          <>
            {t('search.installedOn', { with: withScript, count: state.pages.length })}{' '}
            {state.index
              ? t('search.indexInfo', {
                  count: state.index.pages,
                  size: formatBytes(state.index.bytes)
                })
              : t('search.rebuiltAlways')}
          </>
        }
        actions={
          <>
            <button className="btn btn--primary" onClick={tryIt}>
              {t('search.tryIt')}
            </button>
            <button
              className="btn"
              disabled={busy}
              onClick={() =>
                run('search', async () => {
                  const index = await window.api.rebuildSearchIndex()
                  return {
                    kind: 'success',
                    text: t('search.indexRebuilt', {
                      count: index.pages,
                      size: formatBytes(index.bytes)
                    })
                  }
                })
              }
            >
              {t('search.rebuildIndex')}
            </button>
            <button
              className="btn btn--danger-outline"
              disabled={busy}
              onClick={() =>
                run('search', async () =>
                  summary(await window.api.disableSearch(), t('search.searchRemoved'))
                )
              }
            >
              {t('search.turnOff')}
            </button>
          </>
        }
      >
        {missing > 0 && (
          <Notice kind="info">
            {t.rich('search.missing', {
              count: missing,
              link: (chunk) => (
                <button
                  className="link"
                  disabled={busy}
                  onClick={() =>
                    run('search', async () =>
                      summary(await window.api.enableSearch(box), t('search.searchAdded'))
                    )
                  }
                >
                  {chunk}
                </button>
              )
            })}
          </Notice>
        )}
        {show('search')}
        {tryUrl && (
          <div className="search-try" ref={tryRef}>
            <div className="search-try__bar">
              <span className="muted small">{t('search.tryHelp')}</span>
              <button className="link" onClick={() => setTryUrl(null)}>
                {t('search.closePreview')}
              </button>
            </div>
            <iframe
              key={tryUrl}
              src={tryUrl}
              title={t('search.tryFrame')}
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        )}
      </Section>

      <Section
        title={t('search.iconTitle')}
        description={
          triggers
            ? t('search.triggersSummary', { triggers, count: pagesWithTriggers })
            : t('search.noTriggers')
        }
        actions={
          <>
            <button className="btn" onClick={() => setSetup('add')}>
              {triggers ? t('search.addAnotherIcon') : t('search.addIcon')}
            </button>
            <button className="btn" disabled={!triggers} onClick={() => setSetup('restyle')}>
              {t('search.changeLook')}
            </button>
          </>
        }
      >
        <div className="search-icon-summary">
          {/* A picture of the icon: its buttons are inert so they don't take focus. */}
          <div className="search-icon__frames" role="img" aria-label={t('search.iconPreview')}>
            {/* Markup generated by the app; custom SVG is sanitized in the main process. */}
            <div
              className="search-icon__stage"
              inert
              dangerouslySetInnerHTML={{ __html: markup }}
            />
            <div
              className="search-icon__stage search-icon__stage--dark"
              inert
              dangerouslySetInnerHTML={{ __html: markup }}
            />
          </div>
          <div className="search-icon-summary__text">
            <p className="muted small">
              {t.rich('search.iconOwn', { attr: <code>data-craftpages-search</code> })}
            </p>
            <button className="btn btn--small" disabled={!markup} onClick={() => copyText(markup)}>
              {t('search.copyMarkup')}
            </button>
          </div>
        </div>
      </Section>

      <Section
        title={t('search.boxTitle')}
        description={t('search.boxDescription')}
        actions={
          <button
            className="btn btn--primary"
            disabled={busy}
            onClick={() =>
              run('box', async () => {
                const result = summary(await window.api.enableSearch(box), t('search.boxSaved'))
                if (tryUrl) await tryIt()
                return result
              })
            }
          >
            {t('common.save')}
          </button>
        }
      >
        <div className="grid-2">
          <ColorField
            label={t('search.accent')}
            hint={t('search.accentHint')}
            value={box.accent}
            onChange={(value) => setBox({ ...box, accent: value })}
          />
          <div className="field">
            <span className="field__label" id={`${id}-theme`}>
              {t('search.theme')}
            </span>
            <div
              className="segmented"
              role="radiogroup"
              aria-labelledby={`${id}-theme`}
              aria-describedby={`${id}-theme-hint`}
            >
              {(['auto', 'light', 'dark'] as const).map((theme) => (
                <button
                  key={theme}
                  role="radio"
                  aria-checked={box.theme === theme}
                  className={box.theme === theme ? 'is-active' : ''}
                  onClick={() => setBox({ ...box, theme })}
                >
                  {theme === 'auto'
                    ? t('search.themeAuto')
                    : theme === 'light'
                      ? t('search.themeLight')
                      : t('search.themeDark')}
                </button>
              ))}
            </div>
            <span className="field__hint" id={`${id}-theme-hint`}>
              {t('search.themeHint')}
            </span>
          </div>
          <Field
            label={t('search.placeholder')}
            hint={t('search.placeholderHint', { text: 'Search this site' })}
          >
            <input
              value={box.placeholder}
              onChange={(e) => setBox({ ...box, placeholder: e.target.value })}
            />
          </Field>
          <Field
            label={t('search.emptyText')}
            hint={t('search.emptyTextHint', { text: 'No results for' })}
          >
            <input value={box.empty} onChange={(e) => setBox({ ...box, empty: e.target.value })} />
          </Field>
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={box.shortcut}
            onChange={(e) => setBox({ ...box, shortcut: e.target.checked })}
          />
          {t('search.shortcut')}
        </label>
        <fieldset className="field search-fieldset" aria-describedby={`${id}-suggest-hint`}>
          <legend className="field__label">{t('search.suggested')}</legend>
          <span className="field__hint" id={`${id}-suggest-hint`}>
            {t('search.suggestedHint')}
          </span>
          <div className="search-suggest">
            {state.pages
              .filter((p) => !p.excluded)
              .map((p) => (
                <label key={p.url} className="check">
                  <input
                    type="checkbox"
                    checked={box.suggest.includes(p.url)}
                    onChange={(e) =>
                      setBox({
                        ...box,
                        suggest: e.target.checked
                          ? [...box.suggest, p.url]
                          : box.suggest.filter((url) => url !== p.url)
                      })
                    }
                  />
                  <span>
                    {p.title} <span className="mono muted small">{p.url}</span>
                  </span>
                </label>
              ))}
          </div>
        </fieldset>
        {show('box')}
      </Section>

      <Section
        title={t('search.indexedTitle')}
        description={t.rich('search.indexedDescription', {
          attr: <code>data-craftpages-search-ignore</code>
        })}
      >
        <table className="list">
          <thead>
            <tr>
              <th scope="col">{t('search.colPage')}</th>
              <th scope="col">{t('search.colInSearch')}</th>
              <th scope="col" className="num">
                {t('search.colTriggers')}
              </th>
            </tr>
          </thead>
          <tbody>
            {state.pages.map((p, i) => (
              <tr key={p.path}>
                <td id={`${id}-page-${i}`}>
                  {p.title}
                  <div className="mono muted small">{p.url}</div>
                </td>
                <td>
                  {p.excluded && p.excluded !== 'meta' ? (
                    <span className="muted">
                      {t('search.excludedNo', {
                        reason: EXCLUDED[p.excluded] ? t(EXCLUDED[p.excluded]!) : p.excluded
                      })}
                    </span>
                  ) : (
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={!p.excluded}
                        disabled={busy}
                        aria-describedby={`${id}-page-${i}`}
                        onChange={(e) =>
                          run('pages', async () =>
                            summary(
                              await window.api.setSearchExcluded(p.path, !e.target.checked),
                              t(e.target.checked ? 'search.pageSearchable' : 'search.pageLeftOut', {
                                path: p.path
                              })
                            )
                          )
                        }
                      />
                      {p.excluded ? t('common.no') : t('common.yes')}
                    </label>
                  )}
                </td>
                <td className="num">{p.triggers || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted small">
          {t.rich('search.leaveOutHelp', { meta: <code>craftpages:search</code> })}
        </p>
        {show('pages')}
      </Section>
    </div>
  )
}
