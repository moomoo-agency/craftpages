import { useState } from 'react'
import { Explainer, Notice, Section } from './Field'
import SyncSourceForm from './SyncSourceForm'
import { useT } from '../i18n'
import { errorMessage, formatDate } from '../lib/api'
import { namesOf } from '../lib/sync'
import type { SyncResult, SyncSource, SyncStatus } from '../../../shared/types'

interface Props {
  status: SyncStatus | null
}

type Message = { kind: 'error' | 'success' | 'info'; text: string } | null

/** Project settings → Sync between computers. */
export default function SyncSection({ status }: Props): React.JSX.Element {
  const t = useT()
  const [source, setSource] = useState<SyncSource>({ mode: 'cloudflare', connection: '' })
  const [repeat, setRepeat] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<Message>(null)
  const [confirmOff, setConfirmOff] = useState(false)
  const [ready, setReady] = useState(true)

  const describe = (result: SyncResult): string =>
    [
      result.pulled
        ? t('sync.resultPulled', { count: result.pulled, device: result.from ?? '' })
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
          {status.people.length > 0 && (
            <Explainer>{t('sync.presenceNote', { names: namesOf(status.people) })}</Explainer>
          )}
          {status.error && (
            <div role="alert">
              <Notice kind="error">{status.error}</Notice>
            </div>
          )}
          {status.conflicts.length > 0 && (
            <div className="sync-conflicts" role="group" aria-labelledby="sync-conflicts-title">
              <h3 id="sync-conflicts-title">{t('sync.conflictsTitle')}</h3>
              <p className="muted small">{t('sync.conflictsHelp')}</p>
              <ul>
                {status.conflicts.map((path) => (
                  <li key={path}>
                    <span className="mono">{path}</span>
                    <button
                      className="btn btn--small"
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          await window.api.takeTheirs(path)
                          return { kind: 'success', text: t('sync.tookTheirs', { path }) }
                        })
                      }
                    >
                      {t('sync.useTheirs')}
                    </button>
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
