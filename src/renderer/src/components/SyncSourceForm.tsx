import { useEffect, useState } from 'react'
import { Explainer, Field } from './Field'
import RemoteFolder from './RemoteFolder'
import TokenUpgrade from './TokenUpgrade'
import { useT } from '../i18n'
import { isServerConnection } from '../../../shared/types'
import type { ConnectionsView, SyncSource, TokenCheck } from '../../../shared/types'

interface Props {
  value: SyncSource
  onChange: (value: SyncSource) => void
  /** Turning sync on for the first time: the passphrase is chosen, so it's asked twice. */
  choosing?: boolean
  /** The repeated passphrase, when choosing. */
  repeat?: string
  onRepeat?: (value: string) => void
  /** False while the chosen Cloudflare token can't sync yet (or is being checked). */
  onReady?: (ready: boolean) => void
}

/** Where sync data lives: a Cloudflare account, or a folder on an FTP / SFTP server. */
export default function SyncSourceForm({
  value,
  onChange,
  choosing,
  repeat,
  onRepeat,
  onReady
}: Props): React.JSX.Element {
  const t = useT()
  const [connections, setConnections] = useState<ConnectionsView | null>(null)
  useEffect(() => {
    window.api.listConnections().then(setConnections)
  }, [])

  const fitting = (connections?.connections ?? []).filter((c) =>
    value.mode === 'cloudflare' ? !isServerConnection(c.type) : isServerConnection(c.type)
  )
  const chosen = fitting.find((c) => c.id === value.connection)

  // Publishing never needed R2: an older token is found out here, not in an error later.
  const [check, setCheck] = useState<{ id: string; result: TokenCheck | null } | null>(null)
  const cloudflareId = value.mode === 'cloudflare' ? value.connection : ''
  useEffect(() => {
    if (!cloudflareId) return
    let current = true
    window.api.testConnection(cloudflareId).then(
      (result) => current && setCheck({ id: cloudflareId, result }),
      () => current && setCheck({ id: cloudflareId, result: null })
    )
    return () => {
      current = false
    }
  }, [cloudflareId])
  const result = check?.id === cloudflareId ? check.result : undefined
  const ready = !cloudflareId || result?.r2 === 'ok'
  useEffect(() => {
    onReady?.(ready)
  }, [ready, onReady])

  return (
    <div className="sync-form">
      <div className="field">
        <span className="field__label" id="sync-mode-label">
          {t('sync.where')}
        </span>
        <div className="segmented" role="radiogroup" aria-labelledby="sync-mode-label">
          {(['cloudflare', 'server'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={value.mode === mode}
              className={value.mode === mode ? 'is-active' : ''}
              onClick={() => onChange({ ...value, mode, connection: '' })}
            >
              {t(mode === 'cloudflare' ? 'sync.modeCloudflare' : 'sync.modeServer')}
            </button>
          ))}
        </div>
        <span className="field__hint">
          {t(value.mode === 'cloudflare' ? 'sync.modeCloudflareHint' : 'sync.modeServerHint')}
        </span>
      </div>

      {choosing && (
        <Explainer>
          {t(value.mode === 'cloudflare' ? 'sync.setupCloudflare' : 'sync.setupServer')}
        </Explainer>
      )}

      <Field
        label={t('sync.connection')}
        hint={fitting.length === 0 && connections ? t('sync.noConnections') : undefined}
      >
        <select
          value={value.connection}
          onChange={(e) => onChange({ ...value, connection: e.target.value })}
        >
          <option value="">{t('project.choose')}</option>
          {fitting.map((connection) => (
            <option key={connection.id} value={connection.id}>
              {connection.name}
              {isServerConnection(connection.type)
                ? ` (${connection.type.toUpperCase()} · ${connection.host})`
                : ` (${connection.accountId.slice(0, 6)}…)`}
            </option>
          ))}
        </select>
      </Field>

      {cloudflareId && chosen && result === undefined && (
        <p className="muted small">{t('connections.checking')}</p>
      )}
      {cloudflareId && chosen && result === null && (
        <p className="muted small">{t('sync.tokenCheckFailed')}</p>
      )}
      {cloudflareId && chosen && result && result.r2 !== 'ok' && (
        <TokenUpgrade
          connection={chosen}
          r2={result.r2}
          onChecked={(next) => setCheck({ id: cloudflareId, result: next })}
        />
      )}

      {value.mode === 'server' && chosen && (
        <>
          <RemoteFolder
            connection={chosen}
            value={value.dir ?? ''}
            onChange={(dir) => onChange({ ...value, dir })}
            label={t('sync.folder')}
            hint={t('sync.folderHint')}
            placeholder="/craftpages-sync"
          />
          <div className={choosing ? 'grid-2' : undefined}>
            <Field
              label={t('sync.passphrase')}
              hint={choosing ? t('sync.passphraseChooseHint') : t('sync.passphraseHint')}
            >
              <input
                type="password"
                autoComplete="new-password"
                value={value.passphrase ?? ''}
                onChange={(e) => onChange({ ...value, passphrase: e.target.value })}
              />
            </Field>
            {choosing && (
              <Field label={t('sync.passphraseRepeat')}>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={repeat ?? ''}
                  onChange={(e) => onRepeat?.(e.target.value)}
                />
              </Field>
            )}
          </div>
        </>
      )}
    </div>
  )
}
