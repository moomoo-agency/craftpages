import { useEffect, useState } from 'react'
import { Explainer, Field, Notice, Section } from '../components/Field'
import RemoteFolder from '../components/RemoteFolder'
import SyncSection from '../components/SyncSection'
import { useT } from '../i18n'
import { errorMessage } from '../lib/api'
import { FEATURES } from '../../../shared/features'
import { isServerConnection } from '../../../shared/types'
import type {
  CloudflareProject,
  CloudflareWorker,
  ConnectionsView,
  SiteSettings,
  SyncStatus,
  Workspace
} from '../../../shared/types'

interface Props {
  workspace: Workspace | null
  onOpenAppSettings: () => void
  sync: SyncStatus | null
}

type Status = { kind: 'error' | 'success'; text: string } | null

/** Settings of the open site: name, URL, images, and where it deploys. Kept in .sitecms/site.json. */
export default function ProjectSettingsView({
  workspace,
  onOpenAppSettings,
  sync
}: Props): React.JSX.Element {
  const t = useT()
  const [site, setSite] = useState<SiteSettings | null>(null)
  /** The settings as last loaded or saved: the Site section says when it has unsaved changes. */
  const [savedSite, setSavedSite] = useState<SiteSettings | null>(null)
  const loaded = (next: SiteSettings): void => {
    setSite(next)
    setSavedSite(next)
  }
  const [connections, setConnections] = useState<ConnectionsView | null>(null)
  const [projects, setProjects] = useState<CloudflareProject[] | null>(null)
  const [newProject, setNewProject] = useState('')
  const [workers, setWorkers] = useState<CloudflareWorker[] | null>(null)
  const [status, setStatus] = useState<Record<string, Status>>({})
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    window.api.listConnections().then(setConnections)
    if (workspace) window.api.getSiteSettings().then(loaded)
  }, [workspace])

  const run = async (section: string, task: () => Promise<string | void>): Promise<void> => {
    setBusy(section)
    setStatus((s) => ({ ...s, [section]: null }))
    try {
      const message = await task()
      if (message) setStatus((s) => ({ ...s, [section]: { kind: 'success', text: message } }))
    } catch (error) {
      setStatus((s) => ({ ...s, [section]: { kind: 'error', text: errorMessage(error) } }))
    } finally {
      setBusy(null)
    }
  }

  const show = (section: string): React.ReactNode => {
    const current = status[section]
    return (
      current && (
        <div role={current.kind === 'error' ? 'alert' : 'status'}>
          <Notice kind={current.kind}>{current.text}</Notice>
        </div>
      )
    )
  }

  if (!workspace) {
    return (
      <div className="empty">
        <h2>{t('project.title')}</h2>
        <p>{t('common.noProject')}</p>
      </div>
    )
  }
  if (!site) return <div className="muted">{t('common.loading')}</div>

  const saveSite = (): Promise<void> =>
    run('site', async () => {
      loaded(await window.api.saveSiteSettings(site!))
      return t('project.savedSite')
    })

  const saveCloudflare = (): Promise<void> =>
    run('cloudflare', async () => {
      loaded(await window.api.saveSiteSettings({ deploy: site!.deploy }))
      return t('project.savedDeploy')
    })

  const loadProjects = (): Promise<void> =>
    run('cloudflare', async () => {
      const list = await window.api.listCloudflareProjects()
      setProjects(list)
      if (list.length) return t('project.pagesFound', { count: list.length })
      // Empty: most likely the account's projects are Workers, which this list doesn't include.
      const workers = await window.api.listCloudflareWorkers()
      if (workers?.length) {
        const names = workers.slice(0, 5).join(', ') + (workers.length > 5 ? '…' : '')
        return t('project.noPagesButWorkers', { count: workers.length, names })
      }
      return t('project.noPages')
    })

  const loadWorkers = (): Promise<void> =>
    run('cloudflare', async () => {
      const list = await window.api.listCloudflareWorkers()
      if (!list) throw new Error(t('project.workersNoAccess'))
      setWorkers(list)
      const usable = list.filter((worker) => worker.usable).length
      return list.length
        ? t('project.workersFound', { count: list.length, usable })
        : t('project.noWorkers')
    })

  const createProject = (): Promise<void> =>
    run('cloudflare', async () => {
      const project = await window.api.createCloudflareProject(newProject.trim())
      loaded(await window.api.getSiteSettings())
      setProjects((list) => [...(list ?? []), project])
      setNewProject('')
      return t('project.created', { name: project.name, subdomain: project.subdomain })
    })

  const chosen = connections?.connections.find((c) => c.id === site?.deploy.connection)
  const onServer = site.deploy.target === 'server'
  const cloudflareConnections =
    connections?.connections.filter((c) => !isServerConnection(c.type)) ?? []
  const serverConnections = connections?.connections.filter((c) => isServerConnection(c.type)) ?? []

  const withoutDeploy = (value: SiteSettings | null): string =>
    JSON.stringify(value ? { ...value, deploy: null } : null)
  const siteDirty = !!savedSite && withoutDeploy(site) !== withoutDeploy(savedSite)

  const setSiteField = <K extends keyof SiteSettings>(key: K, value: SiteSettings[K]): void =>
    setSite((s) => (s ? { ...s, [key]: value } : s))

  return (
    <div className="settings">
      <Section
        title={t('project.site')}
        description={t.rich('project.siteDescription', {
          path: <code>{`${workspace.folder}/.sitecms/site.json`}</code>
        })}
        actions={
          site && (
            <>
              {siteDirty && (
                <span className="muted small settings__unsaved">{t('project.unsavedChanges')}</span>
              )}
              <button className="btn btn--primary" onClick={saveSite} disabled={busy === 'site'}>
                {busy === 'site' ? t('common.saving') : t('common.save')}
              </button>
            </>
          )
        }
      >
        {site && (
          <>
            <div className="grid-2">
              <Field label={t('project.siteName')}>
                <input
                  value={site.siteName}
                  onChange={(e) => setSiteField('siteName', e.target.value)}
                />
              </Field>
              <Field label={t('project.baseUrl')} hint={t('project.baseUrlHint')}>
                <input
                  value={site.baseUrl}
                  placeholder="https://example.com"
                  onChange={(e) => setSiteField('baseUrl', e.target.value)}
                />
              </Field>
              <Field label={t('project.language')} hint={t('project.languageHint')}>
                <input
                  value={site.locale}
                  onChange={(e) => setSiteField('locale', e.target.value)}
                />
              </Field>
            </div>

            <h3 className="settings__subhead">{t('project.images')}</h3>
            <div className="grid-3">
              <Field label={t('project.maxWidth')}>
                <input
                  type="number"
                  min={320}
                  value={site.images.maxWidth}
                  onChange={(e) =>
                    setSiteField('images', { ...site.images, maxWidth: Number(e.target.value) })
                  }
                />
              </Field>
              <Field label={t('project.quality')} hint={t('project.qualityHint')}>
                <input
                  type="number"
                  min={30}
                  max={100}
                  value={site.images.quality}
                  onChange={(e) =>
                    setSiteField('images', { ...site.images, quality: Number(e.target.value) })
                  }
                />
              </Field>
              <Field label={t('project.folder')} hint={t('project.folderHint')}>
                <input
                  className="mono"
                  value={site.images.dir}
                  onChange={(e) => setSiteField('images', { ...site.images, dir: e.target.value })}
                />
              </Field>
            </div>
            <label className="check">
              <input
                type="checkbox"
                checked={site.images.pngToJpeg}
                onChange={(e) =>
                  setSiteField('images', { ...site.images, pngToJpeg: e.target.checked })
                }
              />
              {t('project.pngToJpeg')}
            </label>

            <h3 className="settings__subhead">{t('project.editing')}</h3>
            <label className="check">
              <input
                type="checkbox"
                checked={site.editing.codeEditor}
                onChange={(e) =>
                  setSiteField('editing', { ...site.editing, codeEditor: e.target.checked })
                }
              />
              <span>
                {t('project.codeEditor')}
                <span className="field__hint check__hint">{t('project.codeEditorHint')}</span>
              </span>
            </label>

            {FEATURES.blog && (
              <>
                <h3 className="settings__subhead">{t('project.blog')}</h3>
                <Explainer>{t('project.blogNote')}</Explainer>
              </>
            )}
            {show('site')}
          </>
        )}
      </Section>

      {/* ---------- Deploy (per project) ---------- */}
      {site && connections && (
        <Section
          title={t('project.deploy')}
          description={t.rich('project.deployDescription', {
            settings: (
              <button className="link" onClick={onOpenAppSettings}>
                {t('app.viewSettings')}
              </button>
            )
          })}
          actions={
            <>
              {!onServer && (
                <button
                  className="btn"
                  onClick={site.deploy.target === 'workers' ? loadWorkers : loadProjects}
                  disabled={busy === 'cloudflare' || !chosen?.hasToken}
                >
                  {site.deploy.target === 'workers'
                    ? t('project.listWorkers')
                    : t('project.listPages')}
                </button>
              )}
              <button
                className="btn btn--primary"
                onClick={saveCloudflare}
                disabled={busy === 'cloudflare'}
              >
                {t('common.save')}
              </button>
            </>
          }
        >
          <Field
            label={t('project.connection')}
            hint={
              connections.connections.length === 0
                ? t('project.noConnections', {
                    settings: `${t('app.viewSettings')} → ${t('connections.title')}`
                  })
                : chosen && !chosen.hasToken && !chosen.keyPath
                  ? t(isServerConnection(chosen.type) ? 'project.noPassword' : 'project.noToken')
                  : undefined
            }
          >
            <select
              value={site.deploy.connection}
              onChange={(e) => {
                setProjects(null)
                setWorkers(null)
                const next = connections.connections.find((c) => c.id === e.target.value)
                // The connection decides where the site goes: a server, or Cloudflare.
                const target = !next
                  ? site.deploy.target
                  : isServerConnection(next.type)
                    ? 'server'
                    : site.deploy.target === 'server'
                      ? 'workers'
                      : site.deploy.target
                setSiteField('deploy', { ...site.deploy, connection: e.target.value, target })
              }}
            >
              <option value="">{t('project.choose')}</option>
              {cloudflareConnections.length > 0 && (
                <optgroup label="Cloudflare">
                  {cloudflareConnections.map((connection) => (
                    <option key={connection.id} value={connection.id}>
                      {connection.name} ({connection.accountId.slice(0, 6)}…)
                    </option>
                  ))}
                </optgroup>
              )}
              {serverConnections.length > 0 && (
                <optgroup label={t('project.servers')}>
                  {serverConnections.map((connection) => (
                    <option key={connection.id} value={connection.id}>
                      {connection.name} ({connection.type.toUpperCase()} · {connection.host})
                    </option>
                  ))}
                </optgroup>
              )}
              {site.deploy.connection && !chosen && (
                <option value={site.deploy.connection}>{t('project.unknownConnection')}</option>
              )}
            </select>
          </Field>

          {onServer && chosen && (
            <RemoteFolder
              connection={chosen}
              value={site.deploy.remoteDir}
              onChange={(remoteDir) => setSiteField('deploy', { ...site.deploy, remoteDir })}
            />
          )}

          {!onServer && (FEATURES.pages || site.deploy.target === 'pages') && (
            <div className="field">
              <span className="field__label" id="publish-as-label">
                {t('project.publishAs')}
              </span>
              <div className="segmented" role="radiogroup" aria-labelledby="publish-as-label">
                {(
                  [
                    ['workers', t('project.targetWorkers')],
                    ['pages', t('project.targetPages')]
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={site.deploy.target === value}
                    className={site.deploy.target === value ? 'is-active' : ''}
                    onClick={() => setSiteField('deploy', { ...site.deploy, target: value })}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <span className="field__hint">
                {site.deploy.target === 'workers'
                  ? t('project.workersHint')
                  : t('project.pagesHint')}
              </span>
            </div>
          )}

          {onServer ? null : site.deploy.target === 'workers' ? (
            <Field
              label={t('project.worker')}
              hint={
                <>
                  {t('project.workerHint')}
                  {workers?.some((worker) => !worker.usable) &&
                    ` ${t('project.workersHidden', {
                      names: workers
                        .filter((worker) => !worker.usable)
                        .map((worker) => worker.name)
                        .join(', ')
                    })}`}
                </>
              }
            >
              <input
                className="mono"
                list="cp-workers"
                value={site.deploy.workerName}
                placeholder={t('project.workerPlaceholder')}
                onChange={(e) =>
                  setSiteField('deploy', {
                    ...site.deploy,
                    workerName: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-')
                  })
                }
              />
              <datalist id="cp-workers">
                {workers
                  ?.filter((worker) => worker.usable)
                  .map((worker) => (
                    <option key={worker.name} value={worker.name} />
                  ))}
              </datalist>
            </Field>
          ) : null}
          {!onServer && site.deploy.target === 'workers' && (
            <Explainer>{t('project.workerExplain')}</Explainer>
          )}
          {onServer || site.deploy.target === 'workers' ? null : (
            <div className="grid-3">
              <Field label={t('project.pagesProject')}>
                {projects ? (
                  <select
                    value={site.deploy.projectName}
                    onChange={(e) =>
                      setSiteField('deploy', { ...site.deploy, projectName: e.target.value })
                    }
                  >
                    <option value="">{t('project.choose')}</option>
                    {projects.map((project) => (
                      <option key={project.name} value={project.name}>
                        {project.name} ({project.subdomain})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={site.deploy.projectName}
                    placeholder={t('project.pagesProjectPlaceholder')}
                    onChange={(e) =>
                      setSiteField('deploy', { ...site.deploy, projectName: e.target.value })
                    }
                  />
                )}
              </Field>
              <Field label={t('project.productionBranch')}>
                <input
                  value={site.deploy.productionBranch}
                  onChange={(e) =>
                    setSiteField('deploy', { ...site.deploy, productionBranch: e.target.value })
                  }
                />
              </Field>
              <Field label={t('project.previewBranch')} hint={t('project.previewBranchHint')}>
                <input
                  value={site.deploy.previewBranch}
                  onChange={(e) =>
                    setSiteField('deploy', { ...site.deploy, previewBranch: e.target.value })
                  }
                />
              </Field>
            </div>
          )}
          <Field label={t('project.neverUpload')} hint={t('project.neverUploadHint')}>
            <textarea
              className="mono"
              rows={3}
              value={site.deploy.exclude.join('\n')}
              onChange={(e) =>
                setSiteField('deploy', { ...site.deploy, exclude: e.target.value.split('\n') })
              }
            />
          </Field>
          {site.deploy.target === 'pages' && projects && (
            <div className="inline-form">
              <input
                className="mono"
                value={newProject}
                aria-label={t('project.newProjectName')}
                placeholder={t('project.newProjectPlaceholder')}
                onChange={(e) => setNewProject(e.target.value.toLowerCase())}
              />
              <button
                className="btn"
                onClick={createProject}
                disabled={!newProject.trim() || busy === 'cloudflare'}
              >
                {t('project.createProject')}
              </button>
            </div>
          )}
          {show('cloudflare')}
        </Section>
      )}

      <SyncSection status={sync} />
    </div>
  )
}
