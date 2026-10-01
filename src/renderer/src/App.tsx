import { useCallback, useEffect, useRef, useState } from 'react'
import Sidebar, { type ViewId } from './components/Sidebar'
import PagesView from './views/PagesView'
import PageEditor, { type EditorMode, type Viewport } from './views/PageEditor'
import BlogView from './views/BlogView'
import SeoView from './views/SeoView'
import SearchView from './views/SearchView'
import ProjectsModal from './components/ProjectsModal'
import MediaView from './views/MediaView'
import SettingsView from './views/SettingsView'
import ProjectSettingsView from './views/ProjectSettingsView'
import PublishView from './views/PublishView'
import AiView from './views/AiView'
import ComponentsView from './views/ComponentsView'
import DraftBar from './components/DraftBar'
import { errorMessage, formatDate, useAppEvent, useStoredState } from './lib/api'
import { useTheme } from './lib/theme'
import { describeRun } from './lib/schedule'
import { useUpdate } from './lib/updates'
import { useT } from './i18n'
import { VIEW_TITLES } from './lib/views'
import { FEATURES } from '../../shared/features'
import type { DraftState, McpStatus, SaveResult, Workspace } from '../../shared/types'

function App(): React.JSX.Element {
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [view, setView] = useState<ViewId>('pages')
  const [editing, setEditing] = useState<{ path: string; focus?: string } | null>(null)
  const [drafts, setDrafts] = useState<DraftState>({ pages: [], stale: [] })
  const [lastSave, setLastSave] = useState<SaveResult | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [baseUrl, setBaseUrl] = useState('')
  const [projectsOpen, setProjectsOpen] = useState(false)
  const [toast, setToast] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const [editorMode, setEditorMode] = useStoredState<EditorMode>('editor.mode', 'edit')
  const [viewport, setViewport] = useStoredState<Viewport>('editor.viewport', 'desktop')
  const [mcp, setMcp] = useState<McpStatus | null>(null)
  const update = useUpdate()
  const [pendingProposals, setPendingProposals] = useState(0)
  const [theme, setTheme] = useTheme()
  const t = useT()

  // Success messages go away on their own; errors stay until dismissed.
  useEffect(() => {
    if (toast?.kind !== 'success') return
    const timer = setTimeout(() => setToast(null), 10_000)
    return () => clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    window.api.getWorkspace().then((current) => current && setWorkspace(current))
    window.api.getMcpStatus().then(setMcp)
    window.api.getDrafts().then(setDrafts)
    window.api
      .listProposals()
      .then((list) => setPendingProposals(list.filter((p) => p.status === 'pending').length))
  }, [])

  useAppEvent((event) => {
    if (event.type === 'workspace') {
      setWorkspace((previous) => {
        if (previous?.root !== event.workspace?.root) setEditing(null)
        return event.workspace
      })
    } else if (event.type === 'scheduled') {
      const { run } = event
      const other = run.root !== workspace?.root
      const message = describeRun(run, t)
      setToast({
        kind: run.error || run.blocked.length ? 'error' : 'success',
        text: other ? t('app.scheduledOtherProject', { project: run.project, message }) : message
      })
      // Pages on screen may have just changed underneath.
      if (!other) setReloadToken((n) => n + 1)
    } else if (event.type === 'drafts') {
      setDrafts(event.drafts)
    } else if (event.type === 'mcp') {
      setMcp(event.status)
    } else if (event.type === 'proposals') {
      setPendingProposals(event.proposals.filter((p) => p.status === 'pending').length)
    }
  })

  useEffect(() => {
    if (workspace) window.api.getSiteSettings().then((site) => setBaseUrl(site.baseUrl))
  }, [workspace?.root, view]) // eslint-disable-line react-hooks/exhaustive-deps

  const saveAll = useCallback(async (): Promise<void> => {
    setSaving(true)
    setSaveError(null)
    try {
      setLastSave(await window.api.saveAll())
      setReloadToken((n) => n + 1)
    } catch (error) {
      setSaveError(errorMessage(error))
    } finally {
      setSaving(false)
    }
  }, [])

  const discard = async (path: string | null): Promise<void> => {
    await window.api.discardDrafts(path)
    setReloadToken((n) => n + 1)
  }

  const undoSave = async (): Promise<void> => {
    if (!lastSave?.historyId) return
    try {
      await window.api.revertHistory(lastSave.historyId)
      setLastSave(null)
      setReloadToken((n) => n + 1)
    } catch (error) {
      setSaveError(errorMessage(error))
    }
  }

  // ⌘S / Ctrl+S saves every page with drafts, from anywhere in the app.
  const saveRef = useRef(saveAll)
  useEffect(() => {
    saveRef.current = saveAll
  })
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        saveRef.current()
      } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'o') {
        event.preventDefault()
        setProjectsOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const navigate = (next: ViewId): void => {
    setView(next)
    if (next !== 'pages') setEditing(null)
  }

  const editPage = (path: string, focus?: string): void => {
    setView('pages')
    setEditing({ path, focus })
  }

  const editingPage = editing
    ? workspace?.pages.find((page) => page.path === editing.path)
    : undefined
  const draftPaths = new Set(drafts.pages.map((page) => page.path))

  return (
    <div className="app">
      <Sidebar
        workspace={workspace}
        view={view}
        mcp={mcp}
        pendingProposals={pendingProposals}
        update={update}
        onNavigate={navigate}
        onOpenProjects={() => setProjectsOpen(true)}
      />

      <main className="main">
        <header className="topbar">
          <h1>{t(VIEW_TITLES[view])}</h1>
          <div className="topbar__right">
            {saveError && (
              <span className="topbar__error" role="alert">
                <span title={saveError}>{saveError}</span>
                <button
                  className="btn btn--ghost btn--small btn--icon"
                  aria-label={t('app.dismissError')}
                  onClick={() => setSaveError(null)}
                >
                  <span aria-hidden="true">×</span>
                </button>
              </span>
            )}
            <DraftBar
              drafts={drafts}
              lastSave={lastSave}
              busy={saving}
              onSaveAll={saveAll}
              onScheduled={(release) => {
                setReloadToken((n) => n + 1)
                setToast({
                  kind: 'success',
                  text: release.until
                    ? t('app.scheduledToastUntil', {
                        label: release.label,
                        at: formatDate(release.at),
                        until: formatDate(release.until)
                      })
                    : t('app.scheduledToast', { label: release.label, at: formatDate(release.at) })
                })
              }}
              onDiscard={discard}
              onUndo={undoSave}
              onOpenPage={(path) => editPage(path)}
              onDismiss={() => setLastSave(null)}
            />
          </div>
        </header>

        <section className={`content${view === 'pages' && editing ? ' content--flush' : ''}`}>
          {view === 'pages' &&
            (editing ? (
              <PageEditor
                key={`${editing.path}#${editing.focus ?? ''}`}
                path={editing.path}
                title={editingPage?.title ?? editing.path}
                focusComponent={editing.focus}
                reloadToken={reloadToken}
                hasDrafts={drafts.pages.some(
                  (p) => p.path === editing.path && (p.own > 0 || p.seo)
                )}
                baseUrl={baseUrl}
                mode={editorMode}
                onModeChange={setEditorMode}
                viewport={viewport}
                onViewportChange={setViewport}
                onBack={() => setEditing(null)}
                onSaveAll={saveAll}
              />
            ) : (
              <PagesView
                workspace={workspace}
                onOpenWorkspace={() => setProjectsOpen(true)}
                onEditPage={editPage}
                unsaved={draftPaths}
                onOpenBlog={FEATURES.blog ? () => navigate('blog') : undefined}
              />
            ))}
          {FEATURES.blog && view === 'blog' && (
            <BlogView
              workspace={workspace}
              mcp={mcp}
              onOpenPage={(path) => editPage(path)}
              onOpenAi={() => navigate('ai')}
            />
          )}
          {view === 'components' && <ComponentsView workspace={workspace} onEditPage={editPage} />}
          {view === 'media' && <MediaView workspace={workspace} onEditPage={editPage} />}
          {view === 'seo' && (
            <SeoView workspace={workspace} onEditPage={(path) => editPage(path)} />
          )}
          {view === 'search' && <SearchView key={workspace?.root} workspace={workspace} />}
          {view === 'ai' && <AiView mcp={mcp} onOpenSettings={() => navigate('settings')} />}
          {view === 'publish' && (
            <PublishView workspace={workspace} onOpenSettings={() => navigate('project')} />
          )}
          {view === 'project' && (
            <ProjectSettingsView
              key={workspace?.root}
              workspace={workspace}
              onOpenAppSettings={() => navigate('settings')}
            />
          )}
          {view === 'settings' && (
            <SettingsView mcp={mcp} theme={theme} onThemeChange={setTheme} update={update} />
          )}
        </section>
      </main>

      <div className="toast-region" role="status" aria-live="polite">
        {toast && (
          <div className={`toast toast--${toast.kind}`}>
            <span>{toast.text}</span>
            <button
              className="btn btn--small btn--ghost btn--icon"
              aria-label={t('common.dismiss')}
              onClick={() => setToast(null)}
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
        )}
      </div>

      {projectsOpen && (
        <ProjectsModal
          current={workspace}
          onOpened={(opened) => {
            setWorkspace(opened)
            setEditing(null)
            setView('pages')
            setProjectsOpen(false)
          }}
          onClose={() => setProjectsOpen(false)}
        />
      )}
    </div>
  )
}

export default App
