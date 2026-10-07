import { useCallback, useEffect, useState } from 'react'
import { Notice, Section } from './Field'
import { useT } from '../i18n'
import { errorMessage, formatDate } from '../lib/api'
import type { SnapshotDetails, SnapshotSummary } from '../../../shared/types'

interface Props {
  /** Changes after each publish, so the list reloads. */
  refreshToken: number
  /** The deploy id live now, to mark that version. */
  liveId: string | null
}

type Status = { kind: 'error' | 'success' | 'info'; text: string; undo?: string } | null

/**
 * Publish → History: every published version of the project, kept in the project
 * folder. A version can be looked at, put back in the folder, or saved as a copy.
 */
export default function VersionsSection({ refreshToken, liveId }: Props): React.JSX.Element {
  const t = useT()
  const [versions, setVersions] = useState<SnapshotSummary[] | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [details, setDetails] = useState<SnapshotDetails | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(
    () =>
      window.api
        .listVersions()
        .then(setVersions, (e) => setStatus({ kind: 'error', text: errorMessage(e) })),
    []
  )
  useEffect(() => {
    load()
  }, [load, refreshToken])

  const toggle = async (id: string): Promise<void> => {
    if (open === id) return setOpen(null)
    setOpen(id)
    setDetails(null)
    setDetails(await window.api.versionDetails(id).catch(() => null))
  }

  const run = async (task: () => Promise<Status>): Promise<void> => {
    setBusy(true)
    setConfirming(null)
    try {
      setStatus(await task())
    } catch (e) {
      setStatus({ kind: 'error', text: errorMessage(e) })
    } finally {
      setBusy(false)
    }
  }

  const restore = (version: SnapshotSummary): Promise<void> =>
    run(async () => {
      const result = await window.api.restoreVersion(version.id)
      return result.files
        ? {
            kind: 'success',
            text: t('versions.restored', { count: result.files, date: formatDate(version.at) }),
            undo: result.historyId ?? undefined
          }
        : { kind: 'info', text: t('versions.alreadyThere') }
    })

  const exportVersion = (version: SnapshotSummary): Promise<void> =>
    run(async () => {
      const result = await window.api.exportVersion(version.id)
      return result && { kind: 'success', text: t('versions.exported', { folder: result.folder }) }
    })

  const undo = (id: string): Promise<void> =>
    run(async () => {
      await window.api.revertHistory(id)
      return { kind: 'info', text: t('versions.undone') }
    })

  const list = (title: string, paths: string[]): React.ReactNode =>
    paths.length > 0 && (
      <div className="versions__files">
        <h4>{title}</h4>
        <ul>
          {paths.slice(0, 200).map((path) => (
            <li key={path} className="mono">
              {path}
            </li>
          ))}
          {paths.length > 200 && (
            <li className="muted">{t('versions.more', { count: paths.length - 200 })}</li>
          )}
        </ul>
      </div>
    )

  return (
    <Section title={t('versions.title')} description={t('versions.description')}>
      {status && (
        <div role={status.kind === 'error' ? 'alert' : 'status'}>
          <Notice kind={status.kind}>
            {status.text}{' '}
            {status.undo && (
              <button className="link" onClick={() => undo(status.undo!)}>
                {t('common.undo')}
              </button>
            )}
          </Notice>
        </div>
      )}
      {!versions ? (
        <p className="muted">{t('common.loading')}</p>
      ) : versions.length === 0 ? (
        <p className="muted">{t('versions.empty')}</p>
      ) : (
        <ol className="versions">
          {versions.map((version) => (
            <li key={version.id} className={open === version.id ? 'is-open' : undefined}>
              <div className="versions__row">
                <button
                  className="versions__toggle"
                  aria-expanded={open === version.id}
                  onClick={() => toggle(version.id)}
                >
                  <span className="versions__when">{formatDate(version.at)}</span>
                  <span className="versions__what">
                    {version.deploy?.where ?? version.label}
                    {version.deploy && version.deploy.id === liveId && (
                      <span className="badge badge--ok">{t('versions.live')}</span>
                    )}
                  </span>
                  <span className="muted small">
                    {t('versions.from', { device: version.device })} ·{' '}
                    {version.first
                      ? t('versions.firstVersion', { count: version.files })
                      : t('versions.changes', {
                          added: version.added,
                          changed: version.changed,
                          removed: version.removed
                        })}
                    {version.unpublished > 0 &&
                      ` · ${t('versions.keptOff', { count: version.unpublished })}`}
                  </span>
                </button>
                {confirming === version.id ? (
                  <span className="versions__confirm" role="group">
                    <span className="small">{t('versions.restoreConfirm')}</span>
                    <button
                      className="btn btn--small btn--primary"
                      disabled={busy}
                      onClick={() => restore(version)}
                    >
                      {t('versions.restoreYes')}
                    </button>
                    <button className="btn btn--small" onClick={() => setConfirming(null)}>
                      {t('common.cancel')}
                    </button>
                  </span>
                ) : (
                  <span className="panel__actions">
                    <button
                      className="btn btn--small"
                      disabled={busy}
                      onClick={() => setConfirming(version.id)}
                    >
                      {t('versions.restore')}
                    </button>
                    <button
                      className="btn btn--small btn--ghost"
                      disabled={busy}
                      onClick={() => exportVersion(version)}
                    >
                      {t('versions.export')}
                    </button>
                  </span>
                )}
              </div>
              {open === version.id && (
                <div className="versions__details">
                  {!details ? (
                    <p className="muted small">{t('common.loading')}</p>
                  ) : (
                    <>
                      {list(t('versions.added'), details.added)}
                      {list(t('versions.changed'), details.changed)}
                      {list(t('versions.removed'), details.removed)}
                      {list(t('versions.unpublishedList'), details.unpublished)}
                      {!details.added.length &&
                        !details.changed.length &&
                        !details.removed.length && (
                          <p className="muted small">{t('versions.noChanges')}</p>
                        )}
                    </>
                  )}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </Section>
  )
}
