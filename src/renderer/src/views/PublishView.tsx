import { useCallback, useEffect, useState } from 'react'
import { Notice, Section } from '../components/Field'
import ScheduledSection from '../components/ScheduledSection'
import { FEATURES } from '../../../shared/features'
import { useT } from '../i18n'
import { errorMessage, formatDate, useAppEvent } from '../lib/api'
import type {
  ForeignDeploy,
  DeployProgress,
  DeployStatus,
  Deployment,
  DeployTarget,
  SiteSettings,
  Workspace
} from '../../../shared/types'

interface Props {
  workspace: Workspace | null
  onOpenSettings: () => void
}

export default function PublishView({ workspace, onOpenSettings }: Props): React.JSX.Element {
  const t = useT()
  const [status, setStatus] = useState<DeployStatus | null>(null)
  const [deployments, setDeployments] = useState<Deployment[] | null>(null)
  const [progress, setProgress] = useState<DeployProgress | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const [site, setSite] = useState<SiteSettings | null>(null)
  // The production deployment waiting for a second click to roll back to.
  const [confirming, setConfirming] = useState<string | null>(null)
  // The live version, when it wasn't published from this folder: shown before publishing over it.
  const [foreign, setForeign] = useState<ForeignDeploy | null>(null)

  const refresh = useCallback(async () => {
    if (!workspace) return
    window.api.getSiteSettings().then(setSite)
    window.api.deployStatus().then(setStatus, (e) => setError(errorMessage(e)))
    window.api.listDeployments().then(
      (list) => {
        setDeployments(list)
        setListError(null)
      },
      (e) => setListError(errorMessage(e))
    )
  }, [workspace])

  useEffect(() => {
    refresh()
  }, [refresh])

  useAppEvent((event) => {
    if (event.type === 'deploy') setProgress(event.progress)
  })

  const deploy = async (target: DeployTarget, force = false): Promise<void> => {
    setRunning(true)
    setError(null)
    setForeign(null)
    try {
      if (target === 'production' && !force) {
        const live = await window.api.checkLive()
        if (live) {
          setForeign(live)
          return
        }
      }
      await window.api.deploy(target, force)
      await refresh()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setRunning(false)
    }
  }

  const rollback = async (deployment: Deployment): Promise<void> => {
    setError(null)
    setConfirming(null)
    try {
      await window.api.rollback(deployment.id)
      setProgress({
        phase: 'done',
        message: t('publish.rolledBack', { id: deployment.id.slice(0, 8) })
      })
      await refresh()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  if (!workspace) {
    return (
      <div className="empty">
        <h2>{t('publish.emptyTitle')}</h2>
        <p>{t('common.noProject')}</p>
      </div>
    )
  }

  const current = deployments?.find((d) => d.environment === 'production')
  const isWorker = site?.deploy.target !== 'pages'
  const title = !site
    ? t('publish.titleCloudflare')
    : isWorker
      ? site.deploy.workerName
        ? t('publish.titleWorker', { name: site.deploy.workerName })
        : t('publish.titleAnyWorker')
      : site.deploy.projectName
        ? t('publish.titlePages', { name: site.deploy.projectName })
        : t('publish.titleAnyPages')

  const summary = status
    ? [
        t('publish.files', { count: status.files }),
        status.lastDeploy
          ? t('publish.changedSince', {
              count: status.changed,
              date: formatDate(status.lastDeploy.at),
              branch: status.lastDeploy.branch
            })
          : t('publish.changed', { count: status.changed })
      ].join(' · ')
    : t('publish.checking')

  const environment = (name: string): string =>
    name === 'production'
      ? t('publish.envProduction')
      : name === 'preview'
        ? t('publish.envPreview')
        : name

  return (
    <div className="publish">
      <Section
        title={title}
        description={summary}
        actions={
          <>
            {!isWorker && (
              <button className="btn" disabled={running} onClick={() => deploy('preview')}>
                {t('publish.deployPreview')}
              </button>
            )}
            <button
              className="btn btn--primary"
              disabled={running}
              onClick={() => deploy('production')}
            >
              {t('publish.publishProduction')}
            </button>
          </>
        }
      >
        <p className="muted small">{isWorker ? t('publish.hintWorker') : t('publish.hintPages')}</p>
        <div className="progress" role="status" aria-live="polite">
          {progress && (
            <>
              <span>{progress.message}</span>
              {progress.total ? (
                <progress
                  value={progress.done ?? 0}
                  max={progress.total}
                  aria-label={t('publish.progressLabel')}
                />
              ) : (
                running && <progress aria-label={t('publish.progressLabel')} />
              )}
            </>
          )}
          {progress?.phase === 'done' && status?.lastDeploy && (
            <span>
              {t.rich('publish.deployedTo', {
                url: (
                  <button
                    className="link"
                    onClick={() => window.api.openExternal(status.lastDeploy!.url)}
                  >
                    {status.lastDeploy.url}
                  </button>
                )
              })}
            </span>
          )}
        </div>
        {foreign && (
          <div role="alert">
            <Notice kind="error">
              <strong>{t('publish.foreignTitle')}</strong>
              <p>
                {t('publish.foreignBody', {
                  date: formatDate(foreign.createdOn),
                  by:
                    (foreign.author ? t('publish.foreignBy', { author: foreign.author }) : '') +
                    (foreign.source ? t('publish.foreignVia', { source: foreign.source }) : '')
                })}
              </p>
              <div className="panel__actions">
                <button className="btn" onClick={() => setForeign(null)}>
                  {t('common.cancel')}
                </button>
                <button className="btn btn--danger" onClick={() => deploy('production', true)}>
                  {t('publish.foreignPublish')}
                </button>
              </div>
            </Notice>
          </div>
        )}
        {error && (
          <div role="alert">
            <Notice kind="error">
              {error}{' '}
              {/Settings/.test(error) && (
                <button className="link" onClick={onOpenSettings}>
                  {t('publish.openSettings')}
                </button>
              )}
            </Notice>
          </div>
        )}
      </Section>

      {FEATURES.scheduling && <ScheduledSection workspace={workspace} />}

      <Section
        title={t('publish.deployments')}
        actions={
          <button className="btn btn--ghost" onClick={refresh}>
            {t('common.refresh')}
          </button>
        }
      >
        {listError ? (
          <p className="muted">{listError}</p>
        ) : !deployments ? (
          <p className="muted">{t('common.loading')}</p>
        ) : deployments.length === 0 ? (
          <p className="muted">{t('publish.noDeployments')}</p>
        ) : (
          <table className="list deployments">
            <thead>
              <tr>
                <th scope="col">{t('publish.colWhen')}</th>
                <th scope="col">{t('publish.colEnvironment')}</th>
                <th scope="col">{t('publish.colBranch')}</th>
                <th scope="col">{t('publish.colStatus')}</th>
                <th scope="col">
                  <span className="visually-hidden">{t('publish.colActions')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {deployments.map((deployment) => (
                <tr key={deployment.id}>
                  <td>
                    <button
                      className="link"
                      title={t('publish.openDeployment')}
                      onClick={() => window.api.openExternal(deployment.url)}
                    >
                      {formatDate(deployment.createdOn)}
                    </button>
                  </td>
                  <td>
                    {environment(deployment.environment)}
                    {deployment === current && <span className="badge">{t('publish.live')}</span>}
                  </td>
                  <td className="mono muted">{deployment.branch}</td>
                  <td className="muted">{deployment.status}</td>
                  <td className="num">
                    {deployment.environment === 'production' &&
                      deployment !== current &&
                      (confirming === deployment.id ? (
                        <span className="deployments__confirm">
                          <span className="small">{t('publish.rollBackConfirm')}</span>
                          <button
                            className="btn btn--small btn--danger"
                            onClick={() => rollback(deployment)}
                          >
                            {t('publish.rollBackYes')}
                          </button>
                          <button className="btn btn--small" onClick={() => setConfirming(null)}>
                            {t('common.cancel')}
                          </button>
                        </span>
                      ) : (
                        <button
                          className="btn btn--small btn--danger-outline"
                          onClick={() => setConfirming(deployment.id)}
                        >
                          {t('publish.rollBack')}
                        </button>
                      ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </div>
  )
}
