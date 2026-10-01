import { useEffect, useState } from 'react'
import { Notice } from './Field'
import Modal from './Modal'
import { useT } from '../i18n'
import { errorMessage, formatAgo } from '../lib/api'
import type { RecentProjectView, Workspace } from '../../../shared/types'

interface Props {
  current: Workspace | null
  onOpened: (workspace: Workspace) => void
  onClose: () => void
}

/** Home-relative path for display: /Users/me/Sites/x → ~/Sites/x */
const tidy = (path: string): string =>
  path.replace(/^\/Users\/[^/]+/, '~').replace(/^C:\\Users\\[^\\]+/i, '~')

/**
 * Recent projects, like an IDE's "Open recent". Folders that were moved or
 * deleted are left out; each project keeps its own unsaved drafts and deploy
 * settings, so switching needs no saving.
 */
export default function ProjectsModal({ current, onOpened, onClose }: Props): React.JSX.Element {
  const t = useT()
  const [projects, setProjects] = useState<RecentProjectView[] | null>(null)
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)

  const load = (): Promise<void> =>
    window.api.listRecentProjects().then(setProjects, (e) => setError(errorMessage(e)))

  useEffect(() => {
    load()
  }, [])

  const open = async (path: string): Promise<void> => {
    if (path === current?.root) return onClose()
    try {
      onOpened(await window.api.openProject(path))
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const openFolder = async (): Promise<void> => {
    const opened = await window.api.pickWorkspace()
    if (opened) onOpened(opened)
  }

  const needle = query.trim().toLowerCase()
  const visible = (projects ?? []).filter(
    (p) => !needle || p.name.toLowerCase().includes(needle) || p.path.toLowerCase().includes(needle)
  )

  return (
    <Modal label={t('app.projects')} className="modal--narrow" onClose={onClose}>
      <header className="modal__head">
        <h2>{t('app.projects')}</h2>
        <button className="btn btn--primary" onClick={openFolder}>
          {t('app.addProject')}
        </button>
      </header>
      <div className="modal__filters modal__filters--single">
        <input
          autoFocus
          type="search"
          aria-label={t('app.searchProjects')}
          placeholder={t('app.searchProjects')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && visible[0] && open(visible[0].path)}
        />
      </div>
      {error && (
        <div role="alert">
          <Notice kind="error">{error}</Notice>
        </div>
      )}

      <ul className="project-list">
        {!projects && <li className="muted">{t('common.loading')}</li>}
        {projects && visible.length === 0 && (
          <li className="muted">
            {projects.length ? t('app.noMatch', { query: query.trim() }) : t('app.noRecent')}
          </li>
        )}
        {visible.map((project) => {
          const isCurrent = project.path === current?.root
          return (
            <li key={project.path} className={`project-row${isCurrent ? ' is-current' : ''}`}>
              <button
                className="project-row__open"
                onClick={() => open(project.path)}
                aria-current={isCurrent ? 'true' : undefined}
              >
                <span className="project-row__avatar" aria-hidden="true">
                  {project.name.charAt(0).toUpperCase()}
                </span>
                <span className="project-row__text">
                  <strong>
                    {project.name}
                    {isCurrent && <span className="badge">{t('app.currentBadge')}</span>}
                    {project.unsavedPages > 0 && (
                      <span className="badge badge--warn">
                        {t('app.unsavedBadge', { count: project.unsavedPages })}
                      </span>
                    )}
                  </strong>
                  <small className="mono">{tidy(project.path)}</small>
                </span>
                <span className="project-row__meta muted small">
                  {project.deployProject && (
                    <span>{t('app.deploysTo', { name: project.deployProject })}</span>
                  )}
                  <span>{formatAgo(project.openedAt)}</span>
                </span>
              </button>
              <button
                className="btn btn--ghost btn--small btn--icon project-row__remove"
                aria-label={t('app.removeFromList', { name: project.name })}
                title={t('app.removeFromList', { name: project.name })}
                onClick={async () => {
                  await window.api.forgetProject(project.path)
                  await load()
                }}
              >
                <span aria-hidden="true">×</span>
              </button>
            </li>
          )
        })}
      </ul>
    </Modal>
  )
}
