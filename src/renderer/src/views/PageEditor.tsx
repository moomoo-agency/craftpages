import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon, arrowLeft, desktop, tablet, mobile, external } from '@wordpress/icons'
import { Field, Notice } from '../components/Field'
import MediaPicker from '../components/MediaPicker'
import { errorMessage } from '../lib/api'
import { useT, type Key } from '../i18n'
import type {
  ComponentScope,
  EditSession,
  ImageEntry,
  ListEdits,
  NodeChange,
  PageSeo
} from '../../../shared/types'

export type EditorMode = 'edit' | 'interact'
export type Viewport = 'desktop' | 'tablet' | 'mobile'

const WIDTHS: { id: Viewport; label: Key; width: string; icon: React.JSX.Element }[] = [
  { id: 'desktop', label: 'pages.viewportDesktop', width: '100%', icon: desktop },
  { id: 'tablet', label: 'pages.viewportTablet', width: '820px', icon: tablet },
  { id: 'mobile', label: 'pages.viewportMobile', width: '390px', icon: mobile }
]

interface ImageInfo {
  id: string
  src: string
  alt: string
  width: number
  height: number
}

/** Messages the editor script inside the iframe posts to us. */
type FrameMessage =
  | { source: 'sitecms'; type: 'ready'; editable: number }
  | { source: 'sitecms'; type: 'draft'; changes: NodeChange[]; lists: ListEdits }
  | { source: 'sitecms'; type: 'select'; selector: string; tag: string; text: string; html: string }
  | ({ source: 'sitecms'; type: 'image' } & ImageInfo)
  | { source: 'sitecms'; type: 'component'; id: string | null }
  | { source: 'sitecms'; type: 'shortcut'; key: 'save' }

interface Props {
  path: string
  title: string
  /** Scroll to and highlight this shared component once the page loads. */
  focusComponent?: string
  /** Changes whenever drafts were saved or discarded elsewhere; the page reloads. */
  reloadToken: number
  hasDrafts: boolean
  baseUrl: string
  /** Kept by the app so it survives switching pages. */
  mode: EditorMode
  onModeChange: (mode: EditorMode) => void
  viewport: Viewport
  onViewportChange: (viewport: Viewport) => void
  onBack: () => void
  onSaveAll: () => void
}

/** Where an image URL used on the site can be previewed locally. */
function localPreview(value: string, baseUrl: string, origin: string): string | null {
  if (!value || !origin) return null
  if (baseUrl && value.startsWith(baseUrl + '/')) return origin + value.slice(baseUrl.length)
  if (value.startsWith('/')) return origin + value
  return null
}

export default function PageEditor({
  path,
  title,
  focusComponent,
  reloadToken,
  hasDrafts,
  baseUrl,
  mode,
  onModeChange,
  viewport,
  onViewportChange,
  onBack,
  onSaveAll
}: Props): React.JSX.Element {
  const t = useT()
  const frame = useRef<HTMLIFrameElement>(null)
  const [session, setSession] = useState<EditSession | null>(null)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [interactUrl, setInteractUrl] = useState<string | null>(null)
  const [allowExternal, setAllowExternal] = useState(false)
  const [panel, setPanel] = useState<'none' | 'image' | 'seo'>('none')
  const [image, setImage] = useState<ImageInfo | null>(null)
  const [picker, setPicker] = useState<'image' | 'og' | null>(null)
  const [component, setComponent] = useState<string | null>(null)
  const [scopes, setScopes] = useState<Record<string, ComponentScope>>({})
  const [seo, setSeo] = useState<PageSeo | null>(null)
  const [origin, setOrigin] = useState('')
  const [message, setMessage] = useState<{
    kind: 'error' | 'success' | 'info'
    text: string
  } | null>(null)

  /** Starts a fresh editing session: the file as it is now, with its drafts re-applied. */
  const load = useCallback(
    (): Promise<void> =>
      window.api.editPage(path).then(
        (next) => {
          setSession(next)
          setImage(null)
          setComponent(null)
          setScopes(Object.fromEntries(next.components.map((c) => [c.id, c.scope])))
          if (next.warning) setMessage({ kind: 'info', text: next.warning })
        },
        (error) => setMessage({ kind: 'error', text: errorMessage(error) })
      ),
    [path]
  )

  useEffect(() => {
    load()
  }, [load, reloadToken])

  // Interact shows the page with drafts applied; refetch after saves / discards too.
  useEffect(() => {
    if (mode === 'interact') window.api.interactUrl(path).then(setInteractUrl)
  }, [mode, path, reloadToken])

  useEffect(() => {
    window.api.previewUrl('').then((url) => setOrigin(new URL(url).origin))
    return () => {
      window.api.reportSelection(null)
      window.api.setAllowExternalScripts(false)
    }
  }, [])

  const post = (payload: Record<string, unknown>): void =>
    frame.current?.contentWindow?.postMessage({ target: 'sitecms', ...payload }, '*')

  const sessionRef = useRef(session)
  const onSaveAllRef = useRef(onSaveAll)
  useEffect(() => {
    sessionRef.current = session
    onSaveAllRef.current = onSaveAll
  })

  useEffect(() => {
    const onMessage = (event: MessageEvent): void => {
      if (event.source !== frame.current?.contentWindow) return
      const data = event.data as FrameMessage
      const current = sessionRef.current
      if (!data || data.source !== 'sitecms' || !current) return
      switch (data.type) {
        case 'ready':
          post({
            type: 'apply',
            own: current.own,
            inherited: current.inherited,
            lists: current.lists
          })
          if (focusComponent) post({ type: 'focus-component', id: focusComponent })
          break
        case 'draft':
          window.api
            .setDraft(current.path, current.hash, data.changes, data.lists)
            .catch((error) => setMessage({ kind: 'error', text: errorMessage(error) }))
          break
        case 'select':
          window.api.reportSelection({
            path,
            selector: data.selector,
            tag: data.tag,
            text: data.text,
            html: data.html
          })
          break
        case 'image':
          setImage({
            id: data.id,
            src: data.src,
            alt: data.alt,
            width: data.width,
            height: data.height
          })
          setPanel('image')
          break
        case 'component':
          setComponent(data.id)
          break
        case 'shortcut':
          onSaveAllRef.current()
          break
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [path, focusComponent])

  const switchMode = async (next: EditorMode): Promise<void> => {
    if (next === mode) return
    if (next === 'interact') {
      post({ type: 'deselect' })
      setPanel('none')
    } else {
      await load()
    }
    onModeChange(next)
  }

  const toggleExternal = async (allow: boolean): Promise<void> => {
    await window.api.setAllowExternalScripts(allow)
    setAllowExternal(allow)
    // Reload so scripts that were blocked get another chance to load.
    if (interactUrl) setInteractUrl(`${interactUrl.split('?')[0]}?t=${Date.now()}`)
  }

  const setScope = async (id: string, scope: ComponentScope): Promise<void> => {
    setScopes((current) => ({ ...current, [id]: scope }))
    await window.api.setComponentScope(path, id, scope)
  }

  // ---------- SEO (a draft like everything else) ----------

  const seoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const openSeo = async (): Promise<void> => {
    if (panel === 'seo') return setPanel('none')
    try {
      const state = await window.api.getPageSeo(path)
      setSeo(state.draft ?? state.file)
      setPanel('seo')
    } catch (error) {
      setMessage({ kind: 'error', text: errorMessage(error) })
    }
  }

  const setSeoField = (key: keyof PageSeo, value: string): void => {
    setSeo((current) => {
      if (!current) return current
      const next = { ...current, [key]: value }
      if (seoTimer.current) clearTimeout(seoTimer.current)
      seoTimer.current = setTimeout(() => {
        window.api
          .setSeoDraft(path, next)
          .catch((error) => setMessage({ kind: 'error', text: errorMessage(error) }))
      }, 250)
      return next
    })
  }

  const pickImage = (picked: ImageEntry): void => {
    const target = picker
    setPicker(null)
    const src = `/${picked.path}`
    if (target === 'og') {
      setSeoField('ogImage', baseUrl ? baseUrl + src : src)
      return
    }
    if (!image) return
    post({
      type: 'set-image',
      id: image.id,
      attrs: {
        src,
        width: String(picked.width),
        height: String(picked.height),
        // Old responsive candidates would still point at the previous image.
        srcset: null,
        sizes: null
      }
    })
    setImage({ ...image, src, width: picked.width, height: picked.height })
  }

  const frameWidth = WIDTHS.find((w) => w.id === viewport)!.width
  const activeComponent = session?.components.find((c) => c.id === component)
  const ogPreview = seo ? localPreview(seo.ogImage, baseUrl, origin) : null
  const shared = activeComponent && scopes[activeComponent.id] !== 'page'

  const closeButton = (
    <button
      className="btn btn--ghost btn--icon btn--small"
      aria-label={t('pages.closePanel')}
      title={t('pages.closePanel')}
      onClick={() => setPanel('none')}
    >
      <span aria-hidden="true">×</span>
    </button>
  )

  return (
    <div className="page-editor">
      <div className="page-editor__bar">
        <button
          className="btn btn--ghost btn--icon"
          onClick={onBack}
          aria-label={t('pages.backToPages')}
          title={t('pages.backToPages')}
        >
          <Icon icon={arrowLeft} size={18} />
        </button>
        <div className="page-editor__title">
          <h2 title={title}>{title}</h2>
          <span className="muted mono" title={path}>
            {path}
          </span>
        </div>

        <div className="segmented" role="radiogroup" aria-label={t('pages.modeLabel')}>
          {(['edit', 'interact'] as const).map((option) => (
            <button
              key={option}
              role="radio"
              aria-checked={mode === option}
              className={mode === option ? 'is-active' : ''}
              title={t(option === 'edit' ? 'pages.modeEditTip' : 'pages.modeInteractTip')}
              onClick={() => switchMode(option)}
            >
              {t(option === 'edit' ? 'pages.modeEdit' : 'pages.modeInteract')}
            </button>
          ))}
        </div>

        <div
          className="segmented segmented--icons"
          role="radiogroup"
          aria-label={t('pages.viewportLabel')}
        >
          {WIDTHS.map((option) => (
            <button
              key={option.id}
              role="radio"
              aria-checked={viewport === option.id}
              aria-label={t(option.label)}
              data-tip={t(option.label)}
              className={viewport === option.id ? 'is-active' : ''}
              onClick={() => onViewportChange(option.id)}
            >
              <Icon icon={option.icon} size={20} />
            </button>
          ))}
        </div>

        <div className="page-editor__actions">
          <button
            className="btn btn--ghost btn--icon"
            aria-label={t('pages.openInBrowser')}
            title={t('pages.openInBrowser')}
            onClick={async () => window.api.openExternal(await window.api.interactUrl(path))}
          >
            <Icon icon={external} size={18} />
          </button>
          <button
            className={`btn${panel === 'seo' ? ' is-active' : ''}`}
            aria-pressed={panel === 'seo'}
            onClick={openSeo}
            disabled={mode !== 'edit'}
          >
            SEO
          </button>
          {hasDrafts &&
            (confirmDiscard ? (
              <span
                className="draft-bar__confirm"
                role="group"
                aria-label={t('pages.confirmDiscardPage')}
              >
                <span className="small">{t('pages.confirmDiscardPage')}</span>
                <button
                  className="btn btn--small btn--danger"
                  autoFocus
                  onClick={async () => {
                    setConfirmDiscard(false)
                    await window.api.discardDrafts(path)
                    setPanel('none')
                    await load()
                  }}
                >
                  {t('common.discard')}
                </button>
                <button className="btn btn--small" onClick={() => setConfirmDiscard(false)}>
                  {t('common.cancel')}
                </button>
              </span>
            ) : (
              <button
                className="btn btn--danger-outline"
                title={t('pages.discardPageTip')}
                onClick={() => setConfirmDiscard(true)}
              >
                {t('pages.discardPage')}
              </button>
            ))}
        </div>
      </div>

      {mode === 'edit' && activeComponent && (
        <div className={`component-bar${shared ? ' component-bar--shared' : ''}`}>
          <span>
            {t.rich('pages.sharedBar', {
              count: activeComponent.pages.length,
              name: <strong>{activeComponent.label}</strong>
            })}
          </span>
          <div className="segmented" role="radiogroup" aria-label={t('pages.scopeLabel')}>
            <button
              role="radio"
              aria-checked={shared}
              className={shared ? 'is-active' : ''}
              onClick={() => setScope(activeComponent.id, 'all')}
            >
              {t('pages.scopeAll', { count: activeComponent.pages.length })}
            </button>
            <button
              role="radio"
              aria-checked={!shared}
              className={!shared ? 'is-active' : ''}
              onClick={() => setScope(activeComponent.id, 'page')}
            >
              {t('pages.scopePage')}
            </button>
          </div>
          {shared && <span className="component-bar__hint">{t('pages.scopeHint')}</span>}
        </div>
      )}

      {mode === 'interact' && (
        <div className="component-bar">
          <span>{t('pages.interactBar')}</span>
          <label className="check check--inline">
            <input
              type="checkbox"
              checked={allowExternal}
              onChange={(e) => toggleExternal(e.target.checked)}
            />
            {t('pages.allowExternal')}
          </label>
        </div>
      )}

      {message && (
        <div className="page-editor__message" role={message.kind === 'error' ? 'alert' : 'status'}>
          <Notice kind={message.kind}>
            <span>{message.text}</span>
            <button className="link" onClick={() => setMessage(null)}>
              {t('common.dismiss')}
            </button>
          </Notice>
        </div>
      )}

      <div className="page-editor__body">
        <div className="page-editor__stage">
          {mode === 'edit' && session && (
            <iframe
              ref={frame}
              key={session.key}
              src={session.url}
              title={t('pages.frameEdit', { path })}
              style={{ width: frameWidth }}
              // No allow-same-origin: the page can't reach the app, only postMessage.
              sandbox="allow-scripts"
            />
          )}
          {mode === 'interact' && interactUrl && (
            <iframe
              key={interactUrl}
              src={interactUrl}
              title={t('pages.framePreview', { path })}
              style={{ width: frameWidth }}
              sandbox="allow-scripts allow-forms allow-popups allow-modals"
            />
          )}
        </div>

        {mode === 'edit' && panel === 'image' && image && (
          <aside className="side-panel" aria-labelledby="side-panel-image">
            <header>
              <h3 id="side-panel-image">{t('pages.imagePanel')}</h3>
              {closeButton}
            </header>
            <div className="image-preview">
              {session && <img src={new URL(image.src, session.url).href} alt="" />}
            </div>
            <div className="side-panel__meta">
              <span className="mono">{image.src}</span>
              <span>{t('pages.imageSize', { width: image.width, height: image.height })}</span>
            </div>
            <button className="btn btn--accent btn--block" onClick={() => setPicker('image')}>
              {t('pages.changeImage')}
            </button>
            <Field label={t('pages.altText')} hint={t('pages.altHint')}>
              <textarea
                rows={3}
                value={image.alt}
                onChange={(e) => {
                  setImage({ ...image, alt: e.target.value })
                  post({ type: 'set-image', id: image.id, attrs: { alt: e.target.value } })
                }}
              />
            </Field>
          </aside>
        )}

        {mode === 'edit' && panel === 'seo' && seo && (
          <aside className="side-panel" aria-labelledby="side-panel-seo">
            <header>
              <h3 id="side-panel-seo">SEO</h3>
              {closeButton}
            </header>
            <div className="snippet" role="group" aria-label={t('pages.searchPreview')}>
              <span className="snippet__url">{seo.canonical || path}</span>
              <span className="snippet__title">{seo.title || t('pages.untitled')}</span>
              <span className="snippet__desc">{seo.description || t('pages.noDescription')}</span>
            </div>
            <Field
              label={t('pages.seoTitle')}
              hint={t('pages.charCount', { count: seo.title.length, min: 30, max: 60 })}
            >
              <input value={seo.title} onChange={(e) => setSeoField('title', e.target.value)} />
            </Field>
            <Field
              label={t('pages.metaDescription')}
              hint={t('pages.charCount', { count: seo.description.length, min: 70, max: 160 })}
            >
              <textarea
                rows={4}
                value={seo.description}
                onChange={(e) => setSeoField('description', e.target.value)}
              />
            </Field>
            <Field label={t('pages.canonical')}>
              <input
                value={seo.canonical}
                onChange={(e) => setSeoField('canonical', e.target.value)}
              />
            </Field>
            <Field label={t('pages.robots')} hint={t('pages.robotsHint')}>
              <input value={seo.robots} onChange={(e) => setSeoField('robots', e.target.value)} />
            </Field>
            <Field label={t('pages.ogTitle')}>
              <input value={seo.ogTitle} onChange={(e) => setSeoField('ogTitle', e.target.value)} />
            </Field>
            <Field label={t('pages.ogDescription')}>
              <textarea
                rows={3}
                value={seo.ogDescription}
                onChange={(e) => setSeoField('ogDescription', e.target.value)}
              />
            </Field>
            <div className="field" role="group" aria-labelledby="seo-og-image">
              <span className="field__label" id="seo-og-image">
                {t('pages.ogImage')}
              </span>
              <div className="image-preview image-preview--social">
                {ogPreview ? (
                  <img src={ogPreview} alt="" />
                ) : (
                  <span className="muted small">
                    {t(seo.ogImage ? 'pages.ogImageExternal' : 'pages.ogImageNone')}
                  </span>
                )}
              </div>
              {seo.ogImage && <span className="field__hint mono">{seo.ogImage}</span>}
              <div className="input-group">
                <button className="btn" onClick={() => setPicker('og')}>
                  {t(seo.ogImage ? 'pages.changeImage' : 'pages.chooseImage')}
                </button>
                {seo.ogImage && (
                  <button className="btn btn--ghost" onClick={() => setSeoField('ogImage', '')}>
                    {t('common.remove')}
                  </button>
                )}
              </div>
              <span className="field__hint">
                {t('pages.ogImageSize')} {!baseUrl && t('pages.ogImageBaseUrl')}
              </span>
            </div>
            <p className="side-panel__note">{t('pages.seoDraftNote')}</p>
          </aside>
        )}
      </div>

      {session && mode === 'edit' && (
        <div className="page-editor__foot">{t('pages.footer', { count: session.editable })}</div>
      )}

      {picker && (
        <MediaPicker
          title={t(picker === 'og' ? 'pages.pickerSocial' : 'pages.pickerChange')}
          current={
            picker === 'image'
              ? image?.src.replace(/^\//, '')
              : seo?.ogImage.replace(baseUrl, '').replace(/^\//, '')
          }
          onPick={pickImage}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  )
}
