import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Notice } from '../components/Field'
import { useT, type Key } from '../i18n'
import { errorMessage } from '../lib/api'
import type { FormsForm, IconPosition, PickedElement, PointSession } from '../../../shared/types'

interface Props {
  form: FormsForm
  domain: string
  pages: string[]
  onDone: (result: { path: string; historyId: string }) => void
  onCancel: () => void
}

const POSITIONS: { id: IconPosition; label: Key; inside?: boolean }[] = [
  { id: 'after', label: 'forms.positionAfter' },
  { id: 'before', label: 'forms.positionBefore' },
  { id: 'end', label: 'forms.positionEnd', inside: true },
  { id: 'start', label: 'forms.positionStart', inside: true }
]
const VOID = new Set(['img', 'input', 'br', 'hr', 'meta', 'link', 'source', 'wbr', 'area', 'col'])
const WIDTH = 1280

const escape = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * Where a form goes, on the real page: click a spot, see a stand-in card there,
 * insert. The card is only for placing; the page gets the CraftForms snippet.
 */
export default function FormPlacer({
  form,
  domain,
  pages,
  onDone,
  onCancel
}: Props): React.JSX.Element {
  const t = useT()
  const [page, setPage] = useState(pages.includes('index.html') ? 'index.html' : pages[0])
  const [session, setSession] = useState<PointSession | null>(null)
  const [ready, setReady] = useState(false)
  const [picked, setPicked] = useState<PickedElement | null>(null)
  const [position, setPosition] = useState<IconPosition>('after')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [fit, setFit] = useState({ scale: 1, height: 600 })
  /** The form's own markup and styles, shown in place; the dashed card until it arrives (or if it can't). */
  const [markup, setMarkup] = useState<string | null>(null)
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

  useLayoutEffect(() => {
    const element = stage.current
    if (!element) return
    const measure = (): void => {
      const scale = Math.min(1, (element.clientWidth - 24) / WIDTH)
      setFit({ scale, height: (element.clientHeight - 24) / scale })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let live = true
    window.api.formPreviewMarkup(form.id).then(
      (html) => live && setMarkup(html),
      () => null
    )
    return () => {
      live = false
    }
  }, [form.id])

  // The form (or a stand-in card) shown in place while choosing.
  useEffect(() => {
    if (!ready) return
    const post = (message: Record<string, unknown>): void =>
      frame.current?.contentWindow?.postMessage({ target: 'sitecms', ...message }, '*')
    const card =
      `<div style="margin:16px 0;padding:28px 20px;border:2px dashed #2f6fed;border-radius:10px;` +
      `background:rgba(47,111,237,.06);font:15px/1.5 system-ui,sans-serif;color:#1d3c7a;text-align:center">` +
      `<strong>${escape(form.title)}</strong><br><small>${escape(t('forms.cardNote', { domain }))}</small></div>`
    post({ type: 'marks', marks: picked ? [{ n: picked.n, label: t('forms.markLabel') }] : [] })
    post({ type: 'preview-insert', n: picked?.n ?? null, position, html: markup ?? card })
  }, [ready, picked, position, form.title, domain, markup, t])

  useEffect(() => {
    const onMessage = (event: MessageEvent): void => {
      if (event.source !== frame.current?.contentWindow) return
      const data = event.data as { source?: string; type?: string; n?: number }
      if (data?.source !== 'sitecms') return
      if (data.type === 'ready') setReady(true)
      if (data.type !== 'picked' || typeof data.n !== 'number') return
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
  }, [])

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

  const insert = async (): Promise<void> => {
    if (!picked) return
    setBusy(true)
    setError(null)
    try {
      onDone(await window.api.insertForm(page, picked.locator, position, form.id, domain))
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pointer search-setup">
      <div className="search-setup__stage-wrap">
        <div className="search-setup__toolbar">
          <select
            value={page}
            onChange={(e) => switchPage(e.target.value)}
            aria-label={t('forms.pageSelect')}
          >
            {pages.map((path) => (
              <option key={path} value={path}>
                {path}
              </option>
            ))}
          </select>
        </div>
        <div className="search-setup__stage" ref={stage}>
          {session ? (
            <iframe
              key={session.key}
              ref={frame}
              src={session.url}
              title={t('forms.placeFrame', { page })}
              sandbox="allow-scripts"
              style={{ width: WIDTH, height: fit.height, transform: `scale(${fit.scale})` }}
            />
          ) : (
            <p className="muted">{t('common.loading')}</p>
          )}
        </div>
      </div>

      <aside className="pointer__panel">
        <header>
          <h2 className="search-setup__title">{t('forms.placeTitle', { form: form.title })}</h2>
          <button className="btn btn--ghost btn--small" onClick={onCancel}>
            {t('common.cancel')}
          </button>
        </header>
        <div className="pointer__prompt">
          <strong>{t('forms.whereTitle')}</strong>
          <p className="muted small">{t('forms.whereHint')}</p>
        </div>
        {picked && (
          <>
            <div className="pointer__pick">
              <span className="mono">{picked.locator.hint}</span>
              <div className="pointer__pick-actions">
                <button className="link" disabled={picked.parent == null} onClick={widen}>
                  {t('forms.selectParent')}
                </button>
              </div>
            </div>
            <fieldset className="radio-list">
              <legend className="field__label">{t('forms.positionLegend')}</legend>
              {POSITIONS.map((option) => (
                <label key={option.id} className="check">
                  <input
                    type="radio"
                    name="form-position"
                    checked={position === option.id}
                    disabled={option.inside && VOID.has(picked.tag)}
                    onChange={() => setPosition(option.id)}
                  />
                  {t(option.label)}
                </label>
              ))}
            </fieldset>
          </>
        )}
        <p className="muted small">{t('forms.loadsOnly', { domain })}</p>
        {error && (
          <div role="alert">
            <Notice kind="error">{error}</Notice>
          </div>
        )}
        <div className="setup-actions">
          <button className="btn btn--primary" disabled={!picked || busy} onClick={insert}>
            {busy ? t('forms.inserting') : t('forms.insertHere')}
          </button>
        </div>
      </aside>
    </div>
  )
}
