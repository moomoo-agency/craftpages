import { useCallback, useEffect, useState } from 'react'
import { Explainer, Notice, Section } from '../components/Field'
import ScheduledSection from '../components/ScheduledSection'
import VersionsSection from '../components/VersionsSection'
import { FEATURES } from '../../../shared/features'
import { addressOfFile } from '../../../shared/blog-urls'
import { useT } from '../i18n'
import { errorMessage, formatDate, useAppEvent } from '../lib/api'
import type {
  ForeignDeploy,
  DeployProgress,
  DeployStatus,
  Deployment,
  DeployTarget,
  DraftState,
  SiteSettings,
  Workspace
} from '../../../shared/types'

interface Props {
  workspace: Workspace | null
  /** Unsaved edits: not in the site folder yet, so a publish would leave them out. */
  drafts: DraftState
  saving: boolean
  /** Saves every draft; false when saving failed. */
  onSaveAll: () => Promise<boolean>
  onOpenPage: (path: string) => void
  onOpenSettings: () => void
}

export default function PublishView({
  workspace,
  drafts,
  saving,
  onSaveAll,
  onOpenPage,
  onOpenSettings
}: Props): React.JSX.Element {
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
  const [versionsToken, setVersionsToken] = useState(0)
  /** Set after a publish to the live site finishes: the moment the job is done. */
  const [live, setLive] = useState(false)

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

  const deploy = async (target: DeployTarget, force = false, saveFirst = false): Promise<void> => {
    setRunning(true)
    setError(null)
    setForeign(null)
    setLive(false)
    try {
      if (saveFirst && !(await onSaveAll())) return
      if (target === 'production' && !force) {
        const live = await window.api.checkLive()
        if (live) {
          setForeign(live)
          return
        }
      }
      await window.api.deploy(target, force)
      if (target === 'production') setLive(true)
      setVersionsToken((n) => n + 1)
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
  const onServer = site?.deploy.target === 'server'
  const isWorker = site?.deploy.target === 'workers'
  const title = !site
    ? t('publish.titleCloudflare')
    : onServer
      ? t('publish.titleServer', { dir: site.deploy.remoteDir || '/' })
      : isWorker
        ? site.deploy.workerName
          ? t('publish.titleWorker', { name: site.deploy.workerName })
          : t('publish.titleAnyWorker')
        : site.deploy.projectName
          ? t('publish.titlePages', { name: site.deploy.projectName })
          : t('publish.titleAnyPages')

  // Pages first: what visitors will see change. Other files (images, styles) are counted.
  const otherFiles = status ? status.changed - status.changedPages.length : 0
  const summary = status
    ? [
        status.changedPages.length
          ? t('publish.pagesChange', { count: status.changedPages.length })
          : otherFiles > 0
            ? t('publish.filesOnly', { count: otherFiles })
            : t('publish.upToDate'),
        status.changedPages.length > 0 && otherFiles > 0
          ? t('publish.plusFiles', { count: otherFiles })
          : null,
        status.lastDeploy
          ? t('publish.lastPublished', { date: formatDate(status.lastDeploy.at) })
          : null
      ]
        .filter(Boolean)
        .join(' · ')
    : t('publish.checking')
  const pageTitle = (file: string): string =>
    workspace.pages.find((page) => page.path === file)?.title || addressOfFile(file)
  const SHOWN = 8

  const unsaved = drafts.pages.length
  const busy = running || saving

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
            {site?.deploy.target === 'pages' && (
              <button
                className="btn"
                disabled={busy}
                onClick={() => deploy('preview', false, unsaved > 0)}
              >
                {t('publish.deployPreview')}
              </button>
            )}
            {unsaved > 0 && (
              <button className="btn" disabled={busy} onClick={() => deploy('production')}>
                {t('publish.publishSavedOnly')}
              </button>
            )}
            <button
              className="btn btn--primary"
              disabled={busy}
              onClick={() => deploy('production', false, unsaved > 0)}
            >
              {t(unsaved > 0 ? 'publish.saveAndPublish' : 'publish.publishProduction')}
            </button>
          </>
        }
      >
        {unsaved > 0 && (
          <div className="publish__unsaved">
            <Notice kind="warning">
              <strong>{t('publish.unsavedTitle', { count: unsaved })}</strong>
              <p>{t('publish.unsavedBody')}</p>
              <ul className="publish__unsaved-pages">
                {drafts.pages.map((page) => (
                  <li key={page.path}>
                    <button
                      className="link"
                      title={page.path}
                      onClick={() => onOpenPage(page.path)}
                    >
                      {pageTitle(page.path)}
                    </button>
                  </li>
                ))}
              </ul>
            </Notice>
          </div>
        )}
        {status && status.changedPages.length > 0 && (
          <ul className="publish__pages" aria-label={t('publish.pagesChangeLabel')}>
            {status.changedPages.slice(0, SHOWN).map((file) => (
              <li key={file}>
                {workspace.pages.some((page) => page.path === file) ? (
                  <button className="link" title={file} onClick={() => onOpenPage(file)}>
                    {pageTitle(file)}
                  </button>
                ) : (
                  <span className="muted" title={file}>
                    {t('publish.pageRemoved', { page: addressOfFile(file) })}
                  </span>
                )}
              </li>
            ))}
            {status.changedPages.length > SHOWN && (
              <li className="muted">
                {t('publish.morePages', { count: status.changedPages.length - SHOWN })}
              </li>
            )}
          </ul>
        )}
        {site && !site.baseUrl && (
          <p className="publish__note muted">
            {t.rich('publish.noWebAddress', {
              settings: (
                <button className="link" onClick={onOpenSettings}>
                  {t('publish.openProjectSettings')}
                </button>
              )
            })}
          </p>
        )}
        <Explainer>
          {t(
            onServer ? 'publish.hintServer' : isWorker ? 'publish.hintWorker' : 'publish.hintPages'
          )}
        </Explainer>
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
          {!live && progress?.phase === 'done' && status?.lastDeploy?.url && (
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
        {live && !running && (
          <div className="publish__live" role="status">
            <Notice kind="success">
              <strong>{t('publish.liveTitle')}</strong>
              <p>{t('publish.liveBody')}</p>
              {(site?.baseUrl || status?.lastDeploy?.url) && (
                <button
                  className="btn btn--small"
                  onClick={() => window.api.openExternal(site?.baseUrl || status!.lastDeploy!.url)}
                >
                  {t('publish.viewSite')}
                </button>
              )}
            </Notice>
          </div>
        )}
        {foreign && (
          <div role="alert">
            <Notice kind="warning">
              {foreign.createdOn ? (
                <>
                  <strong>{t('publish.foreignTitle')}</strong>
                  <p>
                    {t(onServer ? 'publish.foreignBodyServer' : 'publish.foreignBody', {
                      date: formatDate(foreign.createdOn),
                      by:
                        (foreign.author ? t('publish.foreignBy', { author: foreign.author }) : '') +
                        (foreign.source ? t('publish.foreignVia', { source: foreign.source }) : '')
                    })}
                  </p>
                </>
              ) : (
                <>
                  <strong>{t('publish.occupiedTitle')}</strong>
                  <p>{t('publish.occupiedBody', { dir: site?.deploy.remoteDir || '/' })}</p>
                </>
              )}
              <div className="panel__actions">
                <button className="btn" onClick={() => setForeign(null)}>
                  {t('common.cancel')}
                </button>
                {/* Overwrites changes made elsewhere: the one red action on this screen. */}
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

      <VersionsSection refreshToken={versionsToken} liveId={status?.lastDeploy?.id ?? null} />

      {!onServer && (
        <Section
          title={t('publish.deployments')}
          description={t('publish.deploymentsDescription')}
          actions={
            <button
              className="btn btn--ghost"
              onClick={() => {
                setVersionsToken((n) => n + 1)
                refresh()
              }}
            >
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
                  {/* Workers have no branches: the column would only say "main". */}
                  {!isWorker && (
                    <th scope="col">{t(onServer ? 'publish.colComputer' : 'publish.colBranch')}</th>
                  )}
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
                    {!isWorker && <td className="mono muted">{deployment.branch}</td>}
                    <td className="muted">{deployment.status}</td>
                    <td className="num">
                      {deployment.environment === 'production' &&
                        deployment !== current &&
                        (confirming === deployment.id ? (
                          <span className="deployments__confirm">
                            <span className="small">{t('publish.rollBackConfirm')}</span>
                            <button
                              className="btn btn--small"
                              autoFocus
                              onClick={() => setConfirming(null)}
                            >
                              {t('common.cancel')}
                            </button>
                            <button
                              className="btn btn--small btn--primary"
                              onClick={() => rollback(deployment)}
                            >
                              {t('publish.rollBackYes')}
                            </button>
                          </span>
                        ) : (
                          <button
                            className="btn btn--small"
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
      )}
    </div>
  )
}
