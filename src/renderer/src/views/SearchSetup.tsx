import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Notice } from '../components/Field'
import SearchIconForm from '../components/SearchIconForm'
import { useT, type Key } from '../i18n'
import { errorMessage } from '../lib/api'
import type {
  IconPosition,
  PickedElement,
  PointSession,
  SearchChange,
  SearchIconOptions,
  SearchState
} from '../../../shared/types'

interface Props {
  /** add: pick a spot, then the look. restyle: only the look, of the icons already placed. */
  mode: 'add' | 'restyle'
  state: SearchState
  icon: SearchIconOptions
  onDone: (change: SearchChange, icon: SearchIconOptions) => void
  onCancel: () => void
}

const POSITIONS: { id: IconPosition; label: Key; inside?: boolean }[] = [
  { id: 'after', label: 'search.positionAfter' },
  { id: 'before', label: 'search.positionBefore' },
  { id: 'end', label: 'search.positionEnd', inside: true },
  { id: 'start', label: 'search.positionStart', inside: true }
]

const VOID = new Set(['img', 'input', 'br', 'hr', 'meta', 'link', 'source', 'wbr', 'area', 'col'])
const WIDTHS = { desktop: 1280, mobile: 390 }
const ICON_SELECTOR = '.craftpages-search-icon'

/**
 * Adding search, as one guided flow on the real page: click where the icon goes,
 * adjust its look, and see it in place before anything is written.
 */
export default function SearchSetup({
  mode,
  state,
  icon: initial,
  onDone,
  onCancel
}: Props): React.JSX.Element {
  const t = useT()
  const pages = state.pages.map((p) => p.path)
  const firstWithIcon = state.pages.find((p) => p.triggers > 0)?.path
  const [page, setPage] = useState(
    mode === 'restyle' && firstWithIcon
      ? firstWithIcon
      : pages.includes('index.html')
        ? 'index.html'
        : pages[0]
  )
  const [step, setStep] = useState<'where' | 'look'>(mode === 'add' ? 'where' : 'look')
  const [viewport, setViewport] = useState<keyof typeof WIDTHS>('desktop')
  const [session, setSession] = useState<PointSession | null>(null)
  const [ready, setReady] = useState(false)
  const [picked, setPicked] = useState<PickedElement | null>(null)
  const [position, setPosition] = useState<IconPosition>('after')
  const [scope, setScope] = useState<'all' | 'page'>('all')
  const [icon, setIcon] = useState(initial)
  const [markup, setMarkup] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [fit, setFit] = useState({ scale: 1, height: 600 })
  const stage = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLIFrameElement>(null)
  const sessionRef = useRef(session)
  useEffect(() => {
    sessionRef.current = session
  })

  useEffect(() => {
    let cancelled = false
    window.api.startPointing(page).then(
      (next) => !cancelled && setSession(next),
      (e) => setError(errorMessage(e))
    )
    return () => {
      cancelled = true
    }
  }, [page])

  // The page renders at a real desktop width, scaled down to fit.
  useLayoutEffect(() => {
    const element = stage.current
    if (!element) return
    const measure = (): void => {
      const scale = Math.min(1, (element.clientWidth - 24) / WIDTHS[viewport])
      setFit({ scale, height: (element.clientHeight - 24) / scale })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [viewport])

  useEffect(() => {
    let cancelled = false
    window.api.searchIconMarkup(icon).then(
      (html) => {
        if (cancelled) return
        setMarkup(html)
        setError(null)
      },
      (e) => !cancelled && setError(errorMessage(e))
    )
    return () => {
      cancelled = true
    }
  }, [icon])

  // Live preview inside the page.
  useEffect(() => {
    const post = (message: Record<string, unknown>): void =>
      frame.current?.contentWindow?.postMessage({ target: 'sitecms', ...message }, '*')
    if (!ready || !markup) return
    if (mode === 'restyle') {
      post({ type: 'restyle', selector: ICON_SELECTOR, html: markup })
    } else {
      post({
        type: 'marks',
        marks: picked ? [{ n: picked.n, label: t('search.markLabel') }] : []
      })
      post({ type: 'preview-insert', n: picked?.n ?? null, position, html: markup })
    }
  }, [ready, markup, picked, position, mode, t])

  useEffect(() => {
    const onMessage = (event: MessageEvent): void => {
      if (event.source !== frame.current?.contentWindow) return
      const data = event.data as { source?: string; type?: string; n?: number }
      if (data?.source !== 'sitecms') return
      if (data.type === 'ready') setReady(true)
      if (data.type !== 'picked' || typeof data.n !== 'number' || mode !== 'add') return
      const key = sessionRef.current?.key
      if (!key) return
      window.api.pointAt(key, data.n).then(
        (next) => {
          setError(null)
          setPicked(next)
          if (VOID.has(next.tag)) setPosition((p) => (p === 'start' || p === 'end' ? 'after' : p))
        },
        (e) => setError(errorMessage(e))
      )
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [mode])

  const switchPage = (next: string): void => {
    setSession(null)
    setReady(false)
    setPicked(null)
    setPage(next)
  }

  const widen = async (): Promise<void> => {
    if (!session || picked?.parent == null) return
    setPicked(await window.api.pointAt(session.key, picked.parent))
  }

  const finish = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      if (mode === 'restyle') {
        onDone(await window.api.updateSearchIcons(icon), icon)
        return
      }
      if (!picked) return
      onDone(
        await window.api.placeSearchIcon(
          page,
          picked.locator,
          position,
          scope,
          icon,
          state.enabled ? null : state.box
        ),
        icon
      )
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const skipIcon = async (): Promise<void> => {
    setBusy(true)
    try {
      onDone(await window.api.enableSearch(state.box), icon)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const width = WIDTHS[viewport]
  const primary =
    mode === 'restyle'
      ? t('search.applyAll')
      : state.enabled
        ? t('search.placeIcon')
        : t('search.addSearchSite')

  return (
    <div className="pointer search-setup">
      <div className="search-setup__stage-wrap">
        <div className="search-setup__toolbar">
          <select
            value={page}
            onChange={(e) => switchPage(e.target.value)}
            aria-label={t('search.pageSelect')}
          >
            {pages.map((path) => (
              <option key={path} value={path}>
                {path}
              </option>
            ))}
          </select>
          <div className="segmented" role="radiogroup" aria-label={t('search.screenSize')}>
            {(['desktop', 'mobile'] as const).map((value) => (
              <button
                key={value}
                role="radio"
                aria-checked={viewport === value}
                className={viewport === value ? 'is-active' : ''}
                onClick={() => setViewport(value)}
              >
                {value === 'desktop' ? t('search.desktop') : t('search.mobile')}
              </button>
            ))}
          </div>
        </div>
        <div className="search-setup__stage" ref={stage}>
          {session ? (
            <iframe
              key={session.key}
              ref={frame}
              src={session.url}
              title={t('search.setupFrame', { page })}
              sandbox="allow-scripts"
              style={{
                width,
                height: fit.height,
                transform: `scale(${fit.scale})`
              }}
            />
          ) : (
            <p className="muted">{t('search.opening', { page })}</p>
          )}
        </div>
      </div>

      <aside className="pointer__panel">
        <header>
          <h2 className="search-setup__title">
            {mode === 'restyle'
              ? t('search.setupRestyle')
              : state.enabled
                ? t('search.setupAddIcon')
                : t('search.setupAdd')}
          </h2>
          <button className="btn btn--ghost btn--small" onClick={onCancel}>
            {t('common.cancel')}
          </button>
        </header>

        {mode === 'add' && (
          <ol className="setup-steps" aria-label={t('search.steps')}>
            <li className={step === 'where' ? 'is-current' : 'is-done'}>
              <button
                className="link"
                aria-current={step === 'where' ? 'step' : undefined}
                onClick={() => setStep('where')}
              >
                {t('search.stepWhere')}
                {step !== 'where' && (
                  <>
                    <span aria-hidden="true"> ✓</span>
                    <span className="visually-hidden"> {t('search.stepDone')}</span>
                  </>
                )}
              </button>
            </li>
            <li className={step === 'look' ? 'is-current' : ''}>
              <button
                className="link"
                aria-current={step === 'look' ? 'step' : undefined}
                disabled={!picked}
                onClick={() => setStep('look')}
              >
                {t('search.stepLook')}
              </button>
            </li>
          </ol>
        )}

        {step === 'where' ? (
          <>
            <div className="pointer__prompt">
              <strong>{t('search.whereTitle')}</strong>
              <p className="muted small">{t('search.whereHint')}</p>
            </div>
            {picked && (
              <>
                <div className="pointer__pick">
                  <span className="mono">{picked.locator.hint}</span>
                  <div className="pointer__pick-actions">
                    <button className="link" disabled={picked.parent == null} onClick={widen}>
                      {t('search.selectParent')}
                    </button>
                  </div>
                </div>
                <fieldset className="radio-list">
                  <legend className="field__label">{t('search.positionLegend')}</legend>
                  {POSITIONS.map((option) => (
                    <label key={option.id} className="check">
                      <input
                        type="radio"
                        name="position"
                        checked={position === option.id}
                        disabled={option.inside && VOID.has(picked.tag)}
                        onChange={() => setPosition(option.id)}
                      />
                      {t(option.label)}
                    </label>
                  ))}
                </fieldset>
                <fieldset className="radio-list">
                  <legend className="field__label">{t('search.scopeLegend')}</legend>
                  <label className="check">
                    <input
                      type="radio"
                      name="scope"
                      checked={scope === 'all'}
                      onChange={() => setScope('all')}
                    />
                    {t('search.scopeAll')}
                  </label>
                  <label className="check">
                    <input
                      type="radio"
                      name="scope"
                      checked={scope === 'page'}
                      onChange={() => setScope('page')}
                    />
                    {t('search.scopePage')}
                  </label>
                </fieldset>
              </>
            )}
            {!state.enabled && (
              <p className="muted small">
                {t.rich('search.ownTrigger', {
                  link: (chunk) => (
                    <button className="link" disabled={busy} onClick={skipIcon}>
                      {chunk}
                    </button>
                  ),
                  attr: <code>data-craftpages-search</code>
                })}
              </p>
            )}
          </>
        ) : (
          <>
            {mode === 'restyle' && !firstWithIcon && (
              <Notice kind="info">{t('search.noIconsYet')}</Notice>
            )}
            <SearchIconForm icon={icon} icons={state.icons} onChange={setIcon} />
          </>
        )}

        {error && (
          <div role="alert">
            <Notice kind="error">{error}</Notice>
          </div>
        )}
        <div className="setup-actions">
          {step === 'where' ? (
            <button className="btn btn--primary" disabled={!picked} onClick={() => setStep('look')}>
              {t('search.nextLook')}
            </button>
          ) : (
            <>
              {mode === 'add' && (
                <button className="btn" onClick={() => setStep('where')}>
                  {t('common.back')}
                </button>
              )}
              <button
                className="btn btn--primary"
                disabled={busy || !markup || (mode === 'add' && !picked)}
                onClick={finish}
              >
                {busy ? t('common.saving') : primary}
              </button>
            </>
          )}
        </div>
      </aside>
    </div>
  )
}
