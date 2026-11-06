import { useState } from 'react'
import { Explainer, Notice, Section } from './Field'
import SyncSourceForm, { DEFAULT_SYNC_DIR } from './SyncSourceForm'
import ComputerName from './ComputerName'
import { useT } from '../i18n'
import { errorMessage, formatDate } from '../lib/api'
import { namesOf } from '../lib/sync'
import type { ConflictComparison, SyncResult, SyncSource, SyncStatus } from '../../../shared/types'

interface Props {
  status: SyncStatus | null
}

type Message = { kind: 'error' | 'success' | 'info'; text: string } | null

/** Project settings → Sync between computers. */
export default function SyncSection({ status }: Props): React.JSX.Element {
  const t = useT()
  const [source, setSource] = useState<SyncSource>({
    mode: 'cloudflare',
    connection: '',
    dir: DEFAULT_SYNC_DIR
  })
  const [repeat, setRepeat] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<Message>(null)
  const [confirmOff, setConfirmOff] = useState(false)
  const [ready, setReady] = useState(true)
  const [comparison, setComparison] = useState<ConflictComparison | null>(null)

  const describe = (result: SyncResult): string =>
    [
      result.pulled
        ? t('sync.resultPulled', { count: result.pulled, device: result.from ?? '' })
        : null,
      result.merged?.length
        ? t('sync.resultMerged', {
            count: result.merged.length,
            files: result.merged.slice(0, 3).join(', ')
          })
        : null,
      result.pushed ? t('sync.resultPushed') : null,
      result.conflicts.length ? t('sync.resultConflicts', { count: result.conflicts.length }) : null
    ]
      .filter(Boolean)
      .join(' ') || t('sync.resultNothing')

  const run = async (task: () => Promise<Message>): Promise<void> => {
    setBusy(true)
    setMessage(null)
    try {
      setMessage(await task())
    } catch (e) {
      setMessage({ kind: 'error', text: errorMessage(e) })
    } finally {
      setBusy(false)
    }
  }

  const enable = (): Promise<void> =>
    run(async () => {
      if (source.mode === 'server' && source.passphrase !== repeat)
        throw new Error(t('sync.passphraseMismatch'))
      const result = await window.api.enableSync({
        mode: source.mode,
        connection: source.connection,
        dir: source.dir,
        passphrase: source.passphrase
      })
      setRepeat('')
      return { kind: 'success', text: `${t('sync.enabled')} ${describe(result)}` }
    })

  const on = status && status.mode !== 'off'
  const canEnable =
    source.connection &&
    ready &&
    (source.mode === 'cloudflare' || ((source.passphrase ?? '').length >= 8 && repeat))

  return (
    <Section
      title={t('sync.title')}
      state={!status ? undefined : status.error ? 'problem' : on ? 'on' : 'off'}
      description={t('sync.description')}
      actions={
        on && (
          <>
            <button
              className="btn btn--primary"
              disabled={busy || status.busy}
              onClick={() =>
                run(async () => ({ kind: 'success', text: describe(await window.api.syncNow()) }))
              }
            >
              {status.busy ? t('sync.pillBusy') : t('sync.syncNow')}
            </button>
          </>
        )
      }
    >
      {!status ? (
        <p className="muted">{t('common.loading')}</p>
      ) : !on ? (
        <>
          <SyncSourceForm
            value={source}
            onChange={setSource}
            choosing
            repeat={repeat}
            onRepeat={setRepeat}
            onReady={setReady}
          />
          <ComputerName />
          <div className="panel__actions panel__actions--start">
            <button className="btn btn--primary" disabled={busy || !canEnable} onClick={enable}>
              {busy ? t('sync.settingUp') : t('sync.turnOn')}
            </button>
          </div>
        </>
      ) : (
        <>
          <dl className="sync-facts">
            <dt>{t('sync.factWhere')}</dt>
            <dd className="mono">
              {status.mode === 'cloudflare' ? 'Cloudflare · ' : t('sync.modeServer') + ' · '}
              {status.where}
            </dd>
            <dt>{t('sync.factLast')}</dt>
            <dd>{status.lastSync ? formatDate(status.lastSync) : t('sync.neverSynced')}</dd>
            {status.remote && (
              <>
                <dt>{t('sync.factLatest')}</dt>
                <dd>
                  {t('sync.latest', {
                    device: status.remote.device,
                    date: formatDate(status.remote.at)
                  })}
                  {status.behind && <span className="badge badge--warn">{t('sync.newer')}</span>}
                </dd>
              </>
            )}
            <dt>{t('sync.factPeople')}</dt>
            <dd>
              {status.people.length
                ? status.people
                    .map((person) =>
                      person.page
                        ? t('sync.personOn', { device: person.device, page: person.page })
                        : person.device
                    )
                    .join(' · ')
                : t('sync.nobody')}
            </dd>
          </dl>
          <ComputerName />
          {status.people.length > 0 && (
            <Explainer>{t('sync.presenceNote', { names: namesOf(status.people) })}</Explainer>
          )}
          {status.error && (
            <div role="alert">
              <Notice kind="error">{status.error}</Notice>
            </div>
          )}
          {status.exposed && <Notice kind="warning">{t('sync.exposed')}</Notice>}
          {status.conflicts.length > 0 && (
            <div className="sync-conflicts" role="group" aria-labelledby="sync-conflicts-title">
              <h3 id="sync-conflicts-title">{t('sync.conflictsTitle')}</h3>
              <p className="muted small">{t('sync.conflictsHelp')}</p>
              <ul>
                {status.conflicts.map((path) => (
                  <li key={path}>
                    <div className="sync-conflicts__row">
                      <span className="mono">{path}</span>
                      <button
                        className="btn btn--small"
                        disabled={busy}
                        aria-expanded={comparison?.path === path}
                        onClick={() =>
                          comparison?.path === path
                            ? setComparison(null)
                            : run(async () => {
                                setComparison(await window.api.compareConflict(path))
                                return null
                              })
                        }
                      >
                        {t('sync.compare')}
                      </button>
                      <button
                        className="btn btn--small"
                        disabled={busy}
                        onClick={() =>
                          run(async () => {
                            await window.api.keepMine(path)
                            setComparison(null)
                            return { kind: 'success', text: t('sync.keptMine', { path }) }
                          })
                        }
                      >
                        {t('sync.keepMine')}
                      </button>
                      <button
                        className="btn btn--small"
                        disabled={busy}
                        onClick={() =>
                          run(async () => {
                            await window.api.takeTheirs(path)
                            setComparison(null)
                            return { kind: 'success', text: t('sync.tookTheirs', { path }) }
                          })
                        }
                      >
                        {t('sync.useTheirs')}
                      </button>
                    </div>
                    {comparison?.path === path && (
                      <div className="sync-compare">
                        <div>
                          <h4>{t('sync.onlyMine')}</h4>
                          <p className="muted small">{t('sync.onlyMineHelp')}</p>
                          {comparison.mineDeleted ? (
                            <p className="small">{t('sync.deletedHere')}</p>
                          ) : comparison.onlyMine.length ? (
                            <ul>
                              {comparison.onlyMine.map((line, i) => (
                                <li key={i}>{line}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="small muted">{t('sync.sameText')}</p>
                          )}
                        </div>
                        <div>
                          <h4>{t('sync.onlyTheirs')}</h4>
                          <p className="muted small">{t('sync.onlyTheirsHelp')}</p>
                          {comparison.theirsDeleted ? (
                            <p className="small">{t('sync.deletedThere')}</p>
                          ) : comparison.onlyTheirs.length ? (
                            <ul>
                              {comparison.onlyTheirs.map((line, i) => (
                                <li key={i}>{line}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="small muted">{t('sync.sameText')}</p>
                          )}
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="panel__actions panel__actions--start">
            {confirmOff ? (
              <>
                <span className="small">{t('sync.turnOffConfirm')}</span>
                <button
                  className="btn btn--small btn--danger"
                  onClick={() =>
                    run(async () => {
                      setConfirmOff(false)
                      await window.api.disableSync()
                      return { kind: 'info', text: t('sync.turnedOff') }
                    })
                  }
                >
                  {t('sync.turnOff')}
                </button>
                <button className="btn btn--small" onClick={() => setConfirmOff(false)}>
                  {t('common.cancel')}
                </button>
              </>
            ) : (
              <button className="btn btn--small btn--ghost" onClick={() => setConfirmOff(true)}>
                {t('sync.turnOff')}…
              </button>
            )}
          </div>
        </>
      )}
      {message && (
        <div role={message.kind === 'error' ? 'alert' : 'status'}>
          <Notice kind={message.kind}>{message.text}</Notice>
        </div>
      )}
    </Section>
  )
}
