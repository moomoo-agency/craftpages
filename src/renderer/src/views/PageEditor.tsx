import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Icon, desktop, tablet, mobile, moreHorizontal } from '@wordpress/icons'
import { Field, Notice } from '../components/Field'
import MediaPicker from '../components/MediaPicker'
import MenuButton, { type MenuItem } from '../components/MenuButton'
import { componentName } from '../lib/components'
import { addressOfFile } from '../../../shared/blog-urls'
import { errorMessage, isMac, shortcut } from '../lib/api'
import { useT, type Key } from '../i18n'
import type { CodeEditorHandle } from './CodeEditor'
import type {
  ComponentScope,
  DraftPage,
  EditSession,
  ImageEntry,
  ListEdits,
  NodeChange,
  PageSeo,
  SaveResult,
  SyncPresence
} from '../../../shared/types'

export type EditorMode = 'edit' | 'code' | 'interact'

// Monaco is large: loaded the first time code mode opens.
const CodeEditor = lazy(() => import('./CodeEditor'))
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
  /** The other images of its slider or gallery (itself included), in page order. */
  group: { id: string; src: string }[]
}

/** Messages the editor script inside the iframe posts to us. */
type FrameMessage =
  | { source: 'sitecms'; type: 'ready'; editable: number }
  | { source: 'sitecms'; type: 'draft'; changes: NodeChange[]; lists: ListEdits }
  | { source: 'sitecms'; type: 'select'; selector: string; tag: string; text: string; html: string }
  | ({ source: 'sitecms'; type: 'image' } & ImageInfo)
  | { source: 'sitecms'; type: 'component'; id: string | null }
  | { source: 'sitecms'; type: 'shortcut'; key: 'save' }
  | { source: 'sitecms'; type: 'scope'; id: string; scope: ComponentScope }
  | { source: 'sitecms'; type: 'focus'; kind: 'heading' | 'image' | 'link' | 'text'; text: string }

interface Props {
  path: string
  /** Scroll to and highlight this shared component once the page loads. */
  focusComponent?: string
  /** Changes whenever drafts were saved or discarded elsewhere; the page reloads. */
  reloadToken: number
  /** This page's unsaved drafts, if any. */
  drafts?: DraftPage
  baseUrl: string
  /** Kept by the app so it survives switching pages. */
  mode: EditorMode
  /** Project setting: offer Code next to Edit and Preview. */
  codeEditor: boolean
  onModeChange: (mode: EditorMode) => void
  viewport: Viewport
  onViewportChange: (viewport: Viewport) => void
  onSaveAll: () => void
  /** Code mode wrote files: shown in the top bar like Save all. */
  onCodeSaved?: (result: SaveResult) => void
  /** Other computers with this page open (sync). */
  others?: SyncPresence[]
  /** The site's pages, offered when a link is edited. */
  pages?: { path: string; title: string }[]
}

const MODE_LABELS: Record<EditorMode, Key> = {
  edit: 'pages.modeEdit',
  code: 'pages.modeCode',
  interact: 'pages.modeInteract'
}
const MODE_TIPS: Record<EditorMode, Key> = {
  edit: 'pages.modeEditTip',
  code: 'pages.modeCodeTip',
  interact: 'pages.modeInteractTip'
}

/** Robots values that keep a page out of search results. */
const hasNoindex = (robots: string): boolean => /(^|,)\s*noindex\s*(,|$)/i.test(robots)
function withNoindex(robots: string, hide: boolean): string {
  const rest = robots
    .split(',')
    .map((token) => token.trim())
    .filter((token) => token && token.toLowerCase() !== 'noindex')
  return (hide ? ['noindex', ...rest] : rest).join(', ')
}

/** Strings the editing layer inside the page shows (its toolbar and item buttons). */
const FRAME_STRINGS = {
  bold: 'pages.frameBold',
  italic: 'pages.frameItalic',
  link: 'pages.frameLink',
  applyLink: 'pages.frameApplyLink',
  clear: 'pages.frameClear',
  moveUp: 'pages.frameMoveUp',
  moveDown: 'pages.frameMoveDown',
  duplicate: 'pages.frameDuplicate',
  remove: 'pages.frameDelete',
  noPage: 'pages.frameNoPage',
  home: 'pages.frameHome',
  edited: 'pages.frameEdited',
  linkPlaceholder: 'pages.frameLinkPlaceholder',
  deleted: 'pages.frameDeleted',
  duplicated: 'pages.frameDuplicated',
  undo: 'pages.frameUndo',
  moved: 'pages.frameMoved',
  revert: 'pages.frameRevert',
  revertShort: 'pages.frameRevertShort',
  enterToEdit: 'pages.frameEnterToEdit',
  enterToChange: 'pages.frameEnterToChange'
} satisfies Record<string, Key>

const FOCUS_KINDS = {
  heading: 'pages.srHeading',
  image: 'pages.srImage',
  link: 'pages.srLink',
  text: 'pages.srText'
} satisfies Record<string, Key>

/**
 * Shared parts whose scope was chosen on a page ("path#id"), this session: the first edit of
 * each asks once where edits go, then never again.
 */
const decidedScopes = new Set<string>()

/** Arrow keys move between the options of a radio group (one Tab stop for the group). */
function radioKeys(event: React.KeyboardEvent<HTMLElement>): void {
  const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key]
  if (!step) return
  const radios = Array.from(
    event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]:not([disabled])')
  )
  const index = radios.indexOf(document.activeElement as HTMLButtonElement)
  if (index < 0) return
  event.preventDefault()
  const next = radios[(index + step + radios.length) % radios.length]
  next.focus()
  next.click()
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
  focusComponent,
  reloadToken,
  drafts,
  baseUrl,
  mode,
  codeEditor,
  onModeChange,
  viewport,
  onViewportChange,
  onSaveAll,
  onCodeSaved,
  others = [],
  pages = []
}: Props): React.JSX.Element {
  const t = useT()
  const frame = useRef<HTMLIFrameElement>(null)
  const [session, setSession] = useState<EditSession | null>(null)
  /** An action waiting for a yes, shown in a strip under the toolbar. */
  const [confirm, setConfirm] = useState<'discard' | 'unpublish' | 'publish' | null>(null)
  const [templates, setTemplates] = useState<string[]>([])
  /** What a screen reader hears when keyboard focus lands on an editable element. */
  const [announce, setAnnounce] = useState('')
  const code = useRef<CodeEditorHandle>(null)
  /** Files with unsaved code; leaving code mode asks first. */
  const [codeDirty, setCodeDirty] = useState(0)
  const [leaving, setLeaving] = useState<EditorMode | null>(null)
  const [interactUrl, setInteractUrl] = useState<string | null>(null)
  const [allowExternal, setAllowExternal] = useState(false)
  const [panel, setPanel] = useState<'none' | 'image' | 'seo'>('none')
  const [image, setImage] = useState<ImageInfo | null>(null)
  const [picker, setPicker] = useState<'image' | 'og' | null>(null)
  const [component, setComponent] = useState<string | null>(null)
  const [scopes, setScopes] = useState<Record<string, ComponentScope>>({})
  const [seo, setSeo] = useState<PageSeo | null>(null)
  const [origin, setOrigin] = useState('')
  const [unpublished, setUnpublished] = useState<Record<string, string>>({})
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

  useEffect(() => {
    window.api.getUnpublished().then(setUnpublished, () => {})
    // Blog templates: the blog decides whether they go live, not this page.
    window.api.blogLayoutPages().then(
      (layouts) => setTemplates([layouts.post, layouts.list].filter((p): p is string => !!p)),
      () => {}
    )
  }, [path])

  const setPublished = async (page: string, published: boolean): Promise<void> => {
    try {
      await window.api.setPublished(page, published)
    } catch (error) {
      setMessage({ kind: 'error', text: errorMessage(error) })
    }
    setUnpublished(await window.api.getUnpublished())
  }

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
  const pagesRef = useRef(pages)
  const tRef = useRef(t)
  const scopesRef = useRef(scopes)
  useEffect(() => {
    sessionRef.current = session
    onSaveAllRef.current = onSaveAll
    pagesRef.current = pages
    tRef.current = t
    scopesRef.current = scopes
  })

  /**
   * Tells the editing layer about the shared part being edited, so its toolbar can offer
   * "All N pages / This page only" right next to the element.
   */
  const sendComponentInfo = (id: string | null): void => {
    const shared = id && sessionRef.current?.components.find((c) => c.id === id)
    if (!shared) return
    const tr = tRef.current
    const count = shared.pages.length
    post({
      type: 'component-info',
      id: shared.id,
      scope: scopesRef.current[shared.id] ?? 'all',
      name: componentName(tr, shared),
      all: tr('pages.scopeAll', { count }),
      page: tr('pages.scopePage'),
      allNote: tr('pages.sharedAlso', { count: count - 1 }),
      pageNote: tr('pages.sharedOnlyHere'),
      hint: tr('pages.scopeHint'),
      forked: tr('pages.scopeForked', { name: componentName(tr, shared) }),
      chipAll: tr('pages.scopeChipAll', { count }),
      ask: tr('pages.scopeAsk', { name: componentName(tr, shared), count }),
      decided: decidedScopes.has(`${path}#${shared.id}`) || scopesRef.current[shared.id] === 'page',
      chipPage: tr('pages.scopeChipPage'),
      keyHint: tr('pages.scopeKey', { key: isMac ? '⌥⇧S' : 'Alt+Shift+S' }),
      label: tr('pages.scopeLabel')
    })
  }

  /** Where edits to a shared part go: every page with it, or this page only. */
  const setScope = async (id: string, scope: ComponentScope): Promise<void> => {
    decidedScopes.add(`${path}#${id}`)
    setScopes((current) => ({ ...current, [id]: scope }))
    scopesRef.current = { ...scopesRef.current, [id]: scope }
    const count = sessionRef.current?.components.find((c) => c.id === id)?.pages.length ?? 0
    setAnnounce(
      scope === 'all' ? t('pages.sharedAlso', { count: count - 1 }) : t('pages.sharedOnlyHere')
    )
    sendComponentInfo(id)
    await window.api.setComponentScope(path, id, scope)
  }

  /** Screen readers hear which shared part they're in and what an edit will reach. */
  const announceComponent = (id: string | null): void => {
    const shared = id && sessionRef.current?.components.find((c) => c.id === id)
    if (!shared) return
    const tr = tRef.current
    const all = (scopesRef.current[shared.id] ?? 'all') === 'all'
    setAnnounce(
      `${componentName(tr, shared)}: ${
        all
          ? tr('pages.sharedAlso', { count: shared.pages.length - 1 })
          : tr('pages.sharedOnlyHere')
      }. ${tr('pages.scopeKey', { key: isMac ? '⌥⇧S' : 'Alt+Shift+S' })}`
    )
  }

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
          post({
            type: 'strings',
            mod: isMac ? '⌘' : 'Ctrl+',
            strings: Object.fromEntries(
              Object.entries(FRAME_STRINGS).map(([name, key]) => [name, tRef.current(key)])
            )
          })
          // Each shared part's reach, for the tag shown when it's hovered.
          post({
            type: 'shared-tags',
            tags: Object.fromEntries(
              current.components.map((part) => [
                part.id,
                tRef.current('pages.sharedTag', {
                  name: componentName(tRef.current, part),
                  count: part.pages.length
                })
              ])
            )
          })
          if (focusComponent) post({ type: 'focus-component', id: focusComponent })
          // Pages links can point to: the published ones (a template off the site would 404).
          window.api.getUnpublished().then(
            (unpublished) =>
              post({
                type: 'pages',
                current: path,
                pages: pagesRef.current.filter((page) => !(page.path in unpublished))
              }),
            () => post({ type: 'pages', current: path, pages: pagesRef.current })
          )
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
            height: data.height,
            group: data.group ?? []
          })
          setPanel('image')
          break
        case 'component':
          setComponent(data.id)
          announceComponent(data.id)
          sendComponentInfo(data.id)
          break
        case 'scope':
          setScope(data.id, data.scope)
          break
        case 'shortcut':
          onSaveAllRef.current()
          break
        case 'focus':
          setAnnounce(
            tRef.current('pages.srEditable', {
              kind: tRef.current(FOCUS_KINDS[data.kind] ?? 'pages.srText'),
              text: data.text
            })
          )
          break
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
    // The helpers it calls read refs only.
  }, [path, focusComponent]) // eslint-disable-line react-hooks/exhaustive-deps

  const switchMode = async (next: EditorMode, confirmed = false): Promise<void> => {
    if (next === mode) return
    if (mode === 'code' && codeDirty && !confirmed) return setLeaving(next)
    setLeaving(null)
    if (next === 'edit') await load()
    else {
      post({ type: 'deselect' })
      setPanel('none')
    }
    onModeChange(next)
  }

  const discardPage = async (): Promise<void> => {
    setConfirm(null)
    await window.api.discardDrafts(path)
    setPanel('none')
    await load()
  }

  const toggleExternal = async (allow: boolean): Promise<void> => {
    await window.api.setAllowExternalScripts(allow)
    setAllowExternal(allow)
    // Reload so scripts that were blocked get another chance to load.
    if (interactUrl) setInteractUrl(`${interactUrl.split('?')[0]}?t=${Date.now()}`)
  }

  // ---------- SEO (a draft like everything else) ----------

  const seoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const openSeo = async (): Promise<void> => {
    if (panel === 'seo') return setPanel('none')
    // SEO is edited alongside the page: from Preview or Code, go back to editing first.
    if (mode !== 'edit') await switchMode('edit')
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
    setImage({
      ...image,
      src,
      width: picked.width,
      height: picked.height,
      group: image.group.map((entry) => (entry.id === image.id ? { ...entry, src } : entry))
    })
  }

  const frameWidth = WIDTHS.find((w) => w.id === viewport)!.width
  const activeComponent = session?.components.find((c) => c.id === component)
  const ogPreview = seo ? localPreview(seo.ogImage, baseUrl, origin) : null
  const shared = activeComponent && scopes[activeComponent.id] !== 'page'

  const hasDrafts = !!drafts && (drafts.own > 0 || drafts.seo)
  const pattern = unpublished[path]
  const published = pattern === undefined
  // Left out by a broader pattern (a folder, a wildcard): only Project settings can change it.
  const patternLocked = !published && pattern !== `/${path}`
  const isNotFound = /^404\.html?$/i.test(path)
  // The site's front door: taking it offline breaks the whole site for visitors.
  const isHome = /^index\.html?$/i.test(path)
  const isTemplate = templates.includes(path)
  // Robots rules other than noindex (nofollow, noarchive…): kept as they are, shown read-only.
  const otherRobots = seo ? withNoindex(seo.robots, false) : ''
  const advancedSet = seo
    ? [seo.canonical, otherRobots, seo.ogTitle, seo.ogDescription].filter(Boolean).length
    : 0

  // A home page that is somehow off the site can still be put back.
  const publishItem: MenuItem =
    isHome && published
      ? {
          label: t('pages.unpublishAction'),
          hint: t('pages.publishHome'),
          disabled: true,
          onSelect: () => {}
        }
      : isNotFound
        ? {
            label: t(published ? 'pages.unpublishAction' : 'pages.republishAction'),
            hint: t('pages.publishNotFound'),
            disabled: true,
            onSelect: () => {}
          }
        : isTemplate
          ? {
              label: t(published ? 'pages.unpublishAction' : 'pages.republishAction'),
              hint: t('pages.publishTemplate'),
              disabled: true,
              onSelect: () => {}
            }
          : patternLocked
            ? {
                label: t('pages.republishAction'),
                hint: t('pages.publishLocked', { pattern }),
                disabled: true,
                onSelect: () => {}
              }
            : published
              ? {
                  label: t('pages.unpublishAction'),
                  hint: t('pages.unpublishHint'),
                  onSelect: () => setConfirm('unpublish')
                }
              : {
                  label: t('pages.republishAction'),
                  hint: t('pages.republishHint'),
                  onSelect: () => setConfirm('publish')
                }

  const menuItems: MenuItem[] = [
    {
      label: t(hasDrafts ? 'pages.openInBrowserDrafts' : 'pages.openInBrowser'),
      onSelect: async () => window.api.openExternal(await window.api.interactUrl(path))
    },
    { ...publishItem, separated: true },
    ...(hasDrafts
      ? [
          {
            label: t('pages.discardPageAction'),
            danger: true,
            onSelect: () => setConfirm('discard')
          }
        ]
      : [])
  ]

  /** A character count that turns amber outside the range search engines show well. */
  const charHint = (count: number, min: number, max: number): React.ReactNode => (
    <span className={count && (count < min || count > max) ? 'field__hint--warn' : undefined}>
      {t('pages.charCount', { count, min, max })}
    </span>
  )

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
        <div
          className="segmented"
          role="radiogroup"
          aria-label={t('pages.modeLabel')}
          onKeyDown={radioKeys}
        >
          {(codeEditor
            ? (['edit', 'interact', 'code'] as const)
            : (['edit', 'interact'] as const)
          ).map((option) => (
            <button
              key={option}
              role="radio"
              aria-checked={mode === option}
              tabIndex={mode === option ? 0 : -1}
              className={mode === option ? 'is-active' : ''}
              title={t(MODE_TIPS[option])}
              onClick={() => switchMode(option)}
            >
              {t(MODE_LABELS[option])}
            </button>
          ))}
        </div>

        <div
          className="segmented segmented--icons"
          role="radiogroup"
          aria-label={t('pages.viewportLabel')}
          onKeyDown={radioKeys}
          hidden={mode === 'code'}
        >
          {WIDTHS.map((option) => (
            <button
              key={option.id}
              role="radio"
              aria-checked={viewport === option.id}
              tabIndex={viewport === option.id ? 0 : -1}
              aria-label={t(option.label)}
              data-tip={t(option.label)}
              className={viewport === option.id ? 'is-active' : ''}
              onClick={() => onViewportChange(option.id)}
            >
              <Icon icon={option.icon} size={20} />
            </button>
          ))}
        </div>

        <div className="page-editor__status">
          {!published && (
            <span className="badge badge--muted" title={t('pages.publishOffTip')}>
              {t('pages.publishOff')}
            </span>
          )}
        </div>

        <div className="page-editor__actions">
          {mode !== 'code' && (
            <button
              className={`btn${panel === 'seo' ? ' is-active' : ''}`}
              aria-pressed={panel === 'seo'}
              onClick={openSeo}
            >
              {t('pages.seoButton')}
            </button>
          )}
          <MenuButton label={t('pages.moreActions')} items={menuItems}>
            <Icon icon={moreHorizontal} size={20} />
          </MenuButton>
        </div>
      </div>

      {confirm && (
        <div
          className="component-bar component-bar--confirm"
          role="group"
          aria-label={t(
            confirm === 'discard'
              ? 'pages.confirmDiscardPage'
              : confirm === 'unpublish'
                ? 'pages.confirmUnpublish'
                : 'pages.confirmPublish'
          )}
        >
          <span>
            {t(
              confirm === 'discard'
                ? 'pages.confirmDiscardPage'
                : confirm === 'unpublish'
                  ? 'pages.confirmUnpublish'
                  : 'pages.confirmPublish'
            )}
          </span>
          <button className="btn btn--small" autoFocus onClick={() => setConfirm(null)}>
            {t('common.cancel')}
          </button>
          {confirm === 'discard' ? (
            <button className="btn btn--small btn--danger" onClick={discardPage}>
              {t('common.discard')}
            </button>
          ) : (
            <button
              className="btn btn--small btn--primary"
              onClick={() => {
                setConfirm(null)
                setPublished(path, confirm === 'publish')
              }}
            >
              {t(confirm === 'unpublish' ? 'pages.unpublishYes' : 'pages.republishYes')}
            </button>
          )}
        </div>
      )}

      {others.length > 0 && (
        <div className="component-bar component-bar--presence" role="status">
          <span className="dot dot--on" aria-hidden="true" />
          <span>
            {t('sync.alsoEditing', {
              names: others
                .map((person) =>
                  person.mode
                    ? `${person.device} (${t(MODE_LABELS[person.mode as EditorMode] ?? 'pages.modeEdit')})`
                    : person.device
                )
                .join(', ')
            })}
          </span>
        </div>
      )}

      {leaving && (
        <div className="component-bar component-bar--shared" role="alert">
          <span>{t('code.leaveUnsaved', { count: codeDirty })}</span>
          <button
            className="btn btn--small btn--primary"
            autoFocus
            onClick={async () => {
              if (await code.current?.saveAll()) switchMode(leaving, true)
              else setLeaving(null)
            }}
          >
            {t('code.leaveSave')}
          </button>
          <button
            className="btn btn--small btn--danger-outline"
            onClick={() => {
              code.current?.discardAll()
              switchMode(leaving, true)
            }}
          >
            {t('code.leaveDiscard')}
          </button>
          <button className="btn btn--small" onClick={() => setLeaving(null)}>
            {t('common.cancel')}
          </button>
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
        {mode === 'code' && (
          <Suspense fallback={<p className="muted page-editor__loading">{t('code.loading')}</p>}>
            <CodeEditor
              ref={code}
              path={path}
              reloadToken={reloadToken}
              blocked={hasDrafts}
              onSaveDrafts={onSaveAll}
              onDiscardDrafts={() => setConfirm('discard')}
              onDirtyChange={setCodeDirty}
              onSaved={onCodeSaved}
            />
          </Suspense>
        )}
        <div className="page-editor__stage" hidden={mode === 'code'}>
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
            {activeComponent && (
              <div className="field" role="group" aria-labelledby="image-scope-label">
                <span className="field__label" id="image-scope-label">
                  {t.rich('pages.sharedBar', {
                    count: activeComponent.pages.length,
                    name: <strong>{componentName(t, activeComponent)}</strong>
                  })}
                </span>
                <div
                  className="segmented segmented--fit"
                  role="radiogroup"
                  aria-label={t('pages.scopeLabel')}
                  onKeyDown={radioKeys}
                >
                  <button
                    role="radio"
                    aria-checked={shared}
                    tabIndex={shared ? 0 : -1}
                    className={shared ? 'is-active' : ''}
                    onClick={() => setScope(activeComponent.id, 'all')}
                  >
                    {t('pages.scopeAll', { count: activeComponent.pages.length })}
                  </button>
                  <button
                    role="radio"
                    aria-checked={!shared}
                    tabIndex={!shared ? 0 : -1}
                    className={!shared ? 'is-active' : ''}
                    onClick={() => setScope(activeComponent.id, 'page')}
                  >
                    {t('pages.scopePage')}
                  </button>
                </div>
                <span className="field__hint">
                  {shared
                    ? t('pages.sharedAlso', { count: activeComponent.pages.length - 1 })
                    : t('pages.sharedOnlyHere')}
                </span>
              </div>
            )}
            <button className="btn btn--accent btn--block" onClick={() => setPicker('image')}>
              {t('pages.changeImage')}
            </button>
            {session && image.group.length > 1 && (
              <div className="field" role="group" aria-labelledby="image-group-label">
                <span className="field__label" id="image-group-label">
                  {t('pages.imageGroup', { count: image.group.length })}
                </span>
                <div className="image-group">
                  {image.group.map((entry, index) => (
                    <button
                      key={entry.id}
                      className={`image-group__item${entry.id === image.id ? ' is-active' : ''}`}
                      aria-pressed={entry.id === image.id}
                      aria-label={t('pages.imageGroupItem', { index: index + 1 })}
                      title={entry.src}
                      onClick={() => post({ type: 'select-image', id: entry.id })}
                    >
                      <img src={new URL(entry.src, session.url).href} alt="" />
                    </button>
                  ))}
                </div>
                <span className="field__hint">{t('pages.imageGroupHint')}</span>
              </div>
            )}
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
              <h3 id="side-panel-seo">{t('pages.seoButton')}</h3>
              {closeButton}
            </header>
            <div
              className={`snippet${hasNoindex(seo.robots) ? ' snippet--hidden' : ''}`}
              role="group"
              aria-label={t('pages.searchPreview')}
            >
              <span className="snippet__url">
                {seo.canonical ||
                  (baseUrl ? baseUrl.replace(/\/$/, '') : t('pages.yourSite')) +
                    addressOfFile(path)}
              </span>
              <span className="snippet__title">{seo.title || t('pages.untitled')}</span>
              <span className="snippet__desc">{seo.description || t('pages.noDescription')}</span>
            </div>
            <p className="field__hint seo-draft-note">{t('pages.seoDraftNote')}</p>
            <Field label={t('pages.seoTitle')} hint={charHint(seo.title.length, 30, 60)}>
              <input value={seo.title} onChange={(e) => setSeoField('title', e.target.value)} />
            </Field>
            <Field
              label={t('pages.metaDescription')}
              hint={charHint(seo.description.length, 70, 160)}
            >
              <textarea
                rows={4}
                value={seo.description}
                onChange={(e) => setSeoField('description', e.target.value)}
              />
            </Field>
            <label className="check" title={t('pages.noindexTip')}>
              <input
                type="checkbox"
                checked={!hasNoindex(seo.robots)}
                onChange={(e) => setSeoField('robots', withNoindex(seo.robots, !e.target.checked))}
              />
              <span>
                {t('pages.searchVisible')}
                <span className="field__hint">{t('pages.searchVisibleHint')}</span>
              </span>
            </label>
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
            <details className="advanced">
              <summary>
                {t('pages.advanced')}
                {advancedSet > 0 && (
                  <span className="muted"> · {t('pages.advancedSet', { count: advancedSet })}</span>
                )}
              </summary>
              <p className="field__hint">{t('pages.advancedHint')}</p>
              <Field label={t('pages.ogTitle')} hint={t('pages.ogTitleHint')}>
                <input
                  value={seo.ogTitle}
                  onChange={(e) => setSeoField('ogTitle', e.target.value)}
                />
              </Field>
              <Field label={t('pages.ogDescription')}>
                <textarea
                  rows={3}
                  value={seo.ogDescription}
                  onChange={(e) => setSeoField('ogDescription', e.target.value)}
                />
              </Field>
              <Field label={t('pages.canonical')} hint={t('pages.canonicalHint')}>
                <input
                  value={seo.canonical}
                  onChange={(e) => setSeoField('canonical', e.target.value)}
                />
              </Field>
              {otherRobots && (
                <div className="field">
                  <span className="field__label">{t('pages.robots')}</span>
                  <span className="mono">{otherRobots}</span>
                  <span className="field__hint">{t('pages.robotsHint')}</span>
                </div>
              )}
            </details>
          </aside>
        )}
      </div>

      {mode === 'code' && (
        <div className="page-editor__foot">
          {t('code.footer', {
            find: shortcut('F'),
            format: isMac ? '⌥⇧F' : 'Alt+Shift+F'
          })}
        </div>
      )}
      {session && mode === 'edit' && (
        <div className="page-editor__foot">{t('pages.footer', { shortcut: shortcut('S') })}</div>
      )}

      <div className="visually-hidden" role="status" aria-live="polite">
        {announce}
      </div>

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
