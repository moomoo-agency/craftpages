import { useState } from 'react'
import { Explainer, Notice } from './Field'
import SyncSourceForm from './SyncSourceForm'
import { useT } from '../i18n'
import { errorMessage, formatDate } from '../lib/api'
import type { SyncProjectView, SyncSource, Workspace } from '../../../shared/types'

interface Props {
  onOpened: (workspace: Workspace) => void
  onCancel: () => void
}

/** Projects → From another computer: find a synced project and download it here. */
export default function GetFromSync({ onOpened, onCancel }: Props): React.JSX.Element {
  const t = useT()
  const [source, setSource] = useState<SyncSource>({ mode: 'cloudflare', connection: '' })
  const [projects, setProjects] = useState<SyncProjectView[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(true)

  const run = async (what: string, task: () => Promise<void>): Promise<void> => {
    setBusy(what)
    setError(null)
    try {
      await task()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="get-sync">
      <Explainer>{t('sync.getIntro')}</Explainer>
      <SyncSourceForm
        value={source}
        onChange={(next) => {
          setSource(next)
          setProjects(null)
        }}
        onReady={setReady}
      />
      <div className="panel__actions panel__actions--start">
        <button className="btn" onClick={onCancel}>
          {t('common.cancel')}
        </button>
        <button
          className="btn btn--primary"
          disabled={!source.connection || !ready || busy !== null}
          onClick={() =>
            run('find', async () => setProjects(await window.api.listSyncProjects(source)))
          }
        >
          {busy === 'find' ? t('connections.checking') : t('sync.find')}
        </button>
      </div>
      {error && (
        <div role="alert">
          <Notice kind="error">{error}</Notice>
        </div>
      )}
      {projects && (
        <ul className="project-list">
          {projects.length === 0 && <li className="muted">{t('sync.noProjects')}</li>}
          {projects.map((project) => (
            <li key={project.id} className="project-row">
              <span className="project-row__open">
                <span className="project-row__avatar" aria-hidden="true">
                  {project.name.charAt(0).toUpperCase()}
                </span>
                <span className="project-row__text">
                  <strong>{project.name}</strong>
                  <small>
                    {project.at
                      ? t('sync.latest', {
                          device: project.device ?? '',
                          date: formatDate(project.at)
                        })
                      : t('sync.neverSynced')}
                  </small>
                </span>
              </span>
              <button
                className="btn btn--small btn--primary"
                disabled={busy !== null}
                onClick={() =>
                  run(project.id, async () => {
                    const opened = await window.api.getSyncProject(source, project.id)
                    if (opened) onOpened(opened)
                  })
                }
              >
                {busy === project.id ? t('sync.downloading') : t('sync.download')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
