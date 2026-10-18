import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Explainer, Field, Notice } from '../components/Field'
import { useT, type Key } from '../i18n'
import { errorMessage } from '../lib/api'
import type {
  IconPosition,
  PickedElement,
  PointSession,
  SearchChange,
  SiteLanguage,
  SwitcherLook,
  SwitcherState
} from '../../../shared/types'

interface Props {
  /** add: pick a spot, then the look. restyle: only the look, of the switchers already placed. */
  mode: 'add' | 'restyle'
  pages: string[]
  languages: SiteLanguage[]
  state: SwitcherState
  onDone: (change: SearchChange) => void
  onCancel: () => void
}

const POSITIONS: { id: IconPosition; label: Key; inside?: boolean }[] = [
  { id: 'end', label: 'search.positionEnd', inside: true },
  { id: 'after', label: 'search.positionAfter' },
  { id: 'before', label: 'search.positionBefore' },
  { id: 'start', label: 'search.positionStart', inside: true }
]
const DISPLAYS: { id: SwitcherLook['display']; label: Key }[] = [
  { id: 'text', label: 'languages.displayText' },
  { id: 'flag', label: 'languages.displayFlag' },
  { id: 'both', label: 'languages.displayBoth' }
]

const VOID = new Set(['img', 'input', 'br', 'hr', 'meta', 'link', 'source', 'wbr', 'area', 'col'])
const WIDTHS = { desktop: 1280, mobile: 390 }
const SELECTOR = '.craftpages-languages'

/**
 * Adding the language switcher, on the real page: click where it goes, choose how it looks
 * (text, flags or both; each language's label and flag), and see it in place before anything
 * is written.
 */
export default function SwitcherSetup({
  mode,
  pages,
  languages: initialLanguages,
  state,
  onDone,
  onCancel
}: Props): React.JSX.Element {
  const t = useT()
  const [page, setPage] = useState(
    mode === 'restyle' && state.pages[0]
      ? state.pages[0]
      : pages.includes('index.html')
        ? 'index.html'
        : pages[0]
  )
  const [step, setStep] = useState<'where' | 'look'>(mode === 'add' ? 'where' : 'look')
  const [viewport, setViewport] = useState<keyof typeof WIDTHS>('desktop')
  const [session, setSession] = useState<PointSession | null>(null)
  const [ready, setReady] = useState(false)
  const [picked, setPicked] = useState<PickedElement | null>(null)
  const [position, setPosition] = useState<IconPosition>('end')
  const [scope, setScope] = useState<'all' | 'page'>('all')
  const [look, setLook] = useState<SwitcherLook>(state.look)
  const [languages, setLanguages] = useState(initialLanguages)
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
  const flagSrc = useMemo(
    () =>
      new Map(
        state.flags.map((flag) => [
          flag.id,
          `data:image/svg+xml;charset=utf-8,${encodeURIComponent(flag.svg)}`
        ])
      ),
    [state.flags]
  )

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
    window.api.switcherPreview(page, look, languages).then(
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
  }, [page, look, languages])

  // Live preview inside the page.
  useEffect(() => {
    const post = (message: Record<string, unknown>): void =>
      frame.current?.contentWindow?.postMessage({ target: 'sitecms', ...message }, '*')
    if (!ready || !markup) return
    if (mode === 'restyle') {
      post({ type: 'restyle', selector: SELECTOR, html: markup })
    } else {
      post({
        type: 'marks',
        marks: picked ? [{ n: picked.n, label: t('languages.markLabel') }] : []
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

  const setLanguage = (code: string, patch: Partial<SiteLanguage>): void =>
    setLanguages((list) => list.map((l) => (l.code === code ? { ...l, ...patch } : l)))

  const finish = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      // Labels and flags first: the switchers are written from the saved languages.
      if (JSON.stringify(languages) !== JSON.stringify(initialLanguages))
        await window.api.saveLanguages(languages)
      if (mode === 'restyle') {
        onDone(await window.api.restyleSwitchers(look))
        return
      }
      if (!picked) return
      onDone(await window.api.placeSwitcher(page, picked.locator, position, scope, look))
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const width = WIDTHS[viewport]

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
              style={{ width, height: fit.height, transform: `scale(${fit.scale})` }}
            />
          ) : (
            <p className="muted">{t('search.opening', { page })}</p>
          )}
        </div>
      </div>

      <aside className="pointer__panel">
        <header>
          <h2 className="search-setup__title">
            {mode === 'restyle' ? t('languages.switcherRestyle') : t('languages.switcherAdd')}
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
              <strong>{t('languages.whereTitle')}</strong>
              <p className="muted small">{t('languages.whereHint')}</p>
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
                  <legend className="field__label">{t('languages.switcherPosition')}</legend>
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
                    {t('languages.scopeAll')}
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
          </>
        ) : (
          <div className="switcher-look">
            <fieldset className="radio-list">
              <legend className="field__label">{t('languages.displayLegend')}</legend>
              {DISPLAYS.map((option) => (
                <label key={option.id} className="check">
                  <input
                    type="radio"
                    name="display"
                    checked={look.display === option.id}
                    onChange={() => setLook({ ...look, display: option.id })}
                  />
                  {t(option.label)}
                </label>
              ))}
            </fieldset>
            <div className="grid-2">
              <Field label={t('languages.sizeLabel')} hint={t('languages.sizeHint')}>
                <input
                  type="number"
                  min={1}
                  max={64}
                  // 0 is stored for "the site's own size": shown as an empty field.
                  value={look.size || ''}
                  placeholder={t('languages.sizePlaceholder')}
                  onChange={(e) => setLook({ ...look, size: Number(e.target.value) || 0 })}
                />
              </Field>
              <Field label={t('languages.gapLabel')}>
                <input
                  type="number"
                  min={0}
                  max={48}
                  value={look.gap}
                  onChange={(e) => setLook({ ...look, gap: Number(e.target.value) })}
                />
              </Field>
            </div>
            <table className="list switcher-look__languages">
              <thead>
                <tr>
                  <th scope="col">{t('languages.colLanguage')}</th>
                  {look.display !== 'flag' && <th scope="col">{t('languages.labelCol')}</th>}
                  {look.display !== 'text' && <th scope="col">{t('languages.flagCol')}</th>}
                </tr>
              </thead>
              <tbody>
                {languages.map((language) => (
                  <tr key={language.code}>
                    <td>{language.name}</td>
                    {look.display !== 'flag' && (
                      <td>
                        <input
                          aria-label={t('languages.labelFor', { language: language.name })}
                          value={language.label ?? ''}
                          placeholder={language.code.toUpperCase()}
                          onChange={(e) => setLanguage(language.code, { label: e.target.value })}
                        />
                      </td>
                    )}
                    {look.display !== 'text' && (
                      <td>
                        <div className="switcher-look__flag">
                          {flagSrc.get(
                            language.flag || state.defaultFlags[language.code] || ''
                          ) && (
                            <img
                              src={flagSrc.get(
                                language.flag || state.defaultFlags[language.code] || ''
                              )}
                              alt=""
                              width={24}
                              height={16}
                            />
                          )}
                          <select
                            aria-label={t('languages.flagFor', { language: language.name })}
                            value={language.flag ?? ''}
                            onChange={(e) =>
                              setLanguage(language.code, { flag: e.target.value || undefined })
                            }
                          >
                            <option value="">{t('languages.flagDefault')}</option>
                            {state.flags.map((flag) => (
                              <option key={flag.id} value={flag.id}>
                                {flag.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            <Explainer>{t('languages.switcherExplain')}</Explainer>
          </div>
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
                {busy
                  ? t('common.saving')
                  : mode === 'restyle'
                    ? t('search.applyAll')
                    : t('languages.switcherPlace')}
              </button>
            </>
          )}
        </div>
      </aside>
    </div>
  )
}
