import { useEffect, useRef, useState } from 'react'
import { Explainer, Field, Notice, Section } from './Field'
import { translate, useT, type Key } from '../i18n'
import { errorMessage } from '../lib/api'
import { tokenTemplateUrl } from '../lib/cloudflare'
import TokenUpgrade from './TokenUpgrade'
import { FEATURES } from '../../../shared/features'
import { isServerConnection } from '../../../shared/types'
import type {
  ConnectionInput,
  ConnectionsView,
  DeployConnectionType,
  DeployConnectionView,
  ServerCheck,
  TokenCheck
} from '../../../shared/types'

interface Props {
  view: ConnectionsView | null
  onChange: (view: ConnectionsView) => void
}

type Status = { kind: 'error' | 'success'; text: string } | null

// The stored type id predates Workers; it is the Cloudflare account either way.
const TYPES: Record<DeployConnectionType, string> = {
  'cloudflare-pages': FEATURES.pages ? 'Cloudflare Pages' : 'Cloudflare',
  sftp: 'SFTP',
  ftp: 'FTP'
}

const blank = (type: DeployConnectionType = 'cloudflare-pages'): ConnectionInput => ({
  type,
  name: '',
  accountId: '',
  token: '',
  ...(type === 'ftp' ? { secure: true } : {})
})

/** The type picker's wording. */
const TYPE_NAMES: Record<DeployConnectionType, Key> = {
  'cloudflare-pages': 'connections.type_cloudflare',
  sftp: 'connections.type_sftp',
  ftp: 'connections.type_ftp'
}

/** The badge: FTP with TLS shows as FTPS. */
const typeLabel = (connection: { type: DeployConnectionType; secure?: boolean }): string =>
  connection.type === 'ftp' && connection.secure ? 'FTPS' : TYPES[connection.type]

/** user@host:port, the port only when it isn't the default. */
const address = (connection: ConnectionInput | DeployConnectionView): string => {
  const standard = connection.type === 'sftp' ? 22 : 21
  const port = connection.port && connection.port !== standard ? `:${connection.port}` : ''
  return `${connection.username}@${connection.host}${port}`
}

/** What the token can reach, and what it's missing. */
function describe(found: TokenCheck): string {
  const sync = translate(
    found.r2 === 'ok'
      ? 'connections.syncReady'
      : found.r2 === 'disabled'
        ? 'connections.syncR2Off'
        : 'connections.syncNeedsPermission'
  )
  return `${describePublish(found)} ${sync}`
}

function describePublish(found: TokenCheck): string {
  const workers =
    found.workers !== null ? translate('connections.workers', { count: found.workers }) : null
  const pages =
    found.pages !== null ? translate('connections.pagesProjects', { count: found.pages }) : null
  if (!FEATURES.pages)
    return workers
      ? translate('connections.seesWorkersOnly', { workers })
      : translate('connections.seesNothing')
  if (workers && pages) return translate('connections.seesBoth', { workers, pages })
  if (workers) return translate('connections.seesWorkers', { workers })
  if (pages) return translate('connections.seesPages', { pages })
  return translate('connections.seesNothing')
}

/** App-wide deploy connections: several accounts (yours, clients'), each project picks one. */
export default function Connections({ view, onChange }: Props): React.JSX.Element {
  const t = useT()
  const [editing, setEditing] = useState<ConnectionInput | null>(null)
  const [status, setStatus] = useState<Status>(null)
  const [busy, setBusy] = useState(false)
  // Removing deletes the token from the keychain, so it takes a second click.
  const [confirming, setConfirming] = useState<string | null>(null)
  const [showToken, setShowToken] = useState(false)
  /** SFTP: signing in with a key file instead of a password. */
  const [useKey, setUseKey] = useState(false)
  const [checked, setChecked] = useState<ServerCheck | null>(null)
  /** What each Cloudflare token can do (publish, sync), checked when the list shows. */
  const [checks, setChecks] = useState<Record<string, TokenCheck | null>>({})
  const [upgrading, setUpgrading] = useState<string | null>(null)

  const asked = useRef(new Set<string>())
  useEffect(() => {
    for (const connection of view?.connections ?? []) {
      if (isServerConnection(connection.type) || !connection.hasToken) continue
      if (asked.current.has(connection.id)) continue
      asked.current.add(connection.id)
      window.api.testConnection(connection.id).then(
        (found) => setChecks((current) => ({ ...current, [connection.id]: found })),
        () => setChecks((current) => ({ ...current, [connection.id]: null }))
      )
    }
  }, [view])

  const edit = (input: ConnectionInput | null): void => {
    setEditing(input)
    setShowToken(false)
    setConfirming(null)
    setUseKey(Boolean(input?.keyPath))
    setChecked(null)
    setStatus(null)
  }

  const server = editing ? isServerConnection(editing.type) : false
  /** The form as it will be saved: the key path only when signing in with a key. */
  const formInput = (): ConnectionInput => ({
    ...editing!,
    keyPath: editing!.type === 'sftp' && useKey ? editing!.keyPath : undefined,
    // Empty while editing = keep the stored secret.
    token: editing!.id && !editing!.token ? undefined : editing!.token
  })

  const checkServer = (): Promise<void> =>
    run(async () => {
      const found = await window.api.checkServer({ ...formInput(), token: editing!.token ?? '' })
      setChecked(found)
      return t('connections.serverWorks', {
        home: found.home,
        folders: found.dirs.length
          ? found.dirs.slice(0, 6).join(', ') + (found.dirs.length > 6 ? '…' : '')
          : t('connections.serverNoFolders')
      })
    })

  const run = async (task: () => Promise<string>): Promise<void> => {
    setBusy(true)
    setStatus(null)
    setConfirming(null)
    try {
      setStatus({ kind: 'success', text: await task() })
    } catch (e) {
      setStatus({ kind: 'error', text: errorMessage(e) })
    } finally {
      setBusy(false)
    }
  }

  const save = (): Promise<void> =>
    run(async () => {
      const saved = await window.api.saveConnection(formInput())
      onChange(await window.api.listConnections())
      edit(null)
      if (isServerConnection(saved.type)) {
        // Logging in once also trusts the SFTP server's key from now on.
        const found = await window.api.checkServer({ ...saved, token: '' }).catch((e) => e)
        onChange(await window.api.listConnections())
        if (found instanceof Error)
          throw new Error(
            t('connections.savedServerFailed', { name: saved.name, error: errorMessage(found) })
          )
        return t('connections.savedServer', { name: saved.name, home: found.home })
      }
      const found = await window.api.testConnection(saved.id).catch(() => null)
      setChecks((current) => ({ ...current, [saved.id]: found }))
      return found
        ? t('connections.saved', { name: saved.name, details: describe(found) })
        : t(FEATURES.pages ? 'connections.savedBadToken' : 'connections.savedBadTokenWorkers', {
            name: saved.name
          })
    })

  const test = (connection: DeployConnectionView): Promise<void> =>
    run(async () => {
      if (isServerConnection(connection.type)) {
        const found = await window.api.checkServer({ ...connection, token: '' })
        onChange(await window.api.listConnections())
        return t('connections.serverWorksNamed', { name: connection.name, home: found.home })
      }
      const found = await window.api.testConnection(connection.id)
      setChecks((current) => ({ ...current, [connection.id]: found }))
      return t('connections.works', { name: connection.name, details: describe(found) })
    })

  const remove = (connection: DeployConnectionView): Promise<void> =>
    run(async () => {
      await window.api.deleteConnection(connection.id)
      onChange(await window.api.listConnections())
      return t('connections.removed', { name: connection.name })
    })

  return (
    <Section
      title={t('connections.title')}
      description={
        view?.keychainAvailable === false
          ? t('connections.descriptionMemory')
          : t('connections.descriptionKeychain')
      }
      actions={
        !editing && (
          <div className="add-menu" role="group" aria-label={t('connections.add')}>
            <button className="btn btn--accent" onClick={() => edit(blank('cloudflare-pages'))}>
              {t('connections.addCloudflare')}
            </button>
            <button className="btn" onClick={() => edit(blank('sftp'))}>
              {t('connections.addServer')}
            </button>
          </div>
        )
      }
    >
      {view && view.connections.length === 0 && !editing && (
        <p className="muted">{t('connections.empty')}</p>
      )}
      {view && view.connections.length > 0 && (
        <ul className="connections">
          {view.connections.map((connection) => (
            <li key={connection.id}>
              <div className="connections__info">
                <div className="connections__name">
                  <strong>{connection.name}</strong>
                  <span
                    className={`badge${connection.type === 'ftp' && !connection.secure ? ' badge--warn' : ''}`}
                  >
                    {typeLabel(connection)}
                  </span>
                </div>
                <div className="connections__meta muted small">
                  <span className="mono">
                    {isServerConnection(connection.type)
                      ? address(connection)
                      : connection.accountId}
                  </span>
                  <span aria-hidden="true"> · </span>
                  {connection.type === 'sftp' && connection.keyPath ? (
                    t('connections.keyFile', { file: connection.keyPath.split(/[\\/]/).pop()! })
                  ) : connection.hasToken ? (
                    t(
                      isServerConnection(connection.type)
                        ? 'connections.passwordSaved'
                        : 'connections.tokenSaved'
                    )
                  ) : (
                    <b className="connections__warn">
                      {t(
                        isServerConnection(connection.type)
                          ? 'connections.noPassword'
                          : 'connections.noToken'
                      )}
                    </b>
                  )}
                  <span aria-hidden="true"> · </span>
                  {connection.usedBy.length
                    ? t('connections.usedBy', { projects: connection.usedBy.join(', ') })
                    : t('connections.notUsed')}
                </div>
                {!isServerConnection(connection.type) && checks[connection.id] && (
                  <div className="connections__caps small">
                    <span
                      className={
                        checks[connection.id]!.workers !== null ||
                        checks[connection.id]!.pages !== null
                          ? 'cap cap--ok'
                          : 'cap cap--no'
                      }
                    >
                      {t('connections.capPublish')}
                    </span>
                    <span
                      className={checks[connection.id]!.r2 === 'ok' ? 'cap cap--ok' : 'cap cap--no'}
                    >
                      {t('connections.capSync')}
                    </span>
                    {checks[connection.id]!.r2 !== 'ok' && upgrading !== connection.id && (
                      <button className="link" onClick={() => setUpgrading(connection.id)}>
                        {t(
                          checks[connection.id]!.r2 === 'disabled'
                            ? 'connections.capTurnOnR2'
                            : 'connections.capUpdateToken'
                        )}
                      </button>
                    )}
                  </div>
                )}
                {upgrading === connection.id &&
                  checks[connection.id] &&
                  checks[connection.id]!.r2 !== 'ok' && (
                    <TokenUpgrade
                      connection={connection}
                      r2={checks[connection.id]!.r2 as Exclude<TokenCheck['r2'], 'ok'>}
                      onChecked={(found) => {
                        setChecks((current) => ({ ...current, [connection.id]: found }))
                        if (found.r2 === 'ok') {
                          setUpgrading(null)
                          setStatus({
                            kind: 'success',
                            text: t('connections.upgradeDone', { name: connection.name })
                          })
                        }
                      }}
                    />
                  )}
              </div>
              {confirming === connection.id ? (
                <div className="connections__confirm" role="group">
                  <span className="small">
                    {connection.usedBy.length
                      ? t('connections.confirmRemoveUsed', {
                          name: connection.name,
                          projects: connection.usedBy.join(', ')
                        })
                      : t('connections.confirmRemove', { name: connection.name })}
                  </span>
                  <div className="panel__actions">
                    <button
                      className="btn btn--small btn--danger"
                      disabled={busy}
                      onClick={() => remove(connection)}
                    >
                      {t('connections.removeYes')}
                    </button>
                    <button className="btn btn--small" onClick={() => setConfirming(null)}>
                      {t('common.cancel')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="panel__actions">
                  <button
                    className="btn btn--small"
                    disabled={busy}
                    aria-label={t('connections.testLabel', { name: connection.name })}
                    onClick={() => test(connection)}
                  >
                    {t('connections.test')}
                  </button>
                  <button
                    className="btn btn--small"
                    disabled={busy}
                    aria-label={t('connections.editLabel', { name: connection.name })}
                    onClick={() => edit({ ...connection, token: '' })}
                  >
                    {t('common.edit')}
                  </button>
                  <button
                    className="btn btn--small btn--danger-outline"
                    disabled={busy}
                    aria-label={t('connections.removeLabel', { name: connection.name })}
                    onClick={() => setConfirming(connection.id)}
                  >
                    {t('connections.remove')}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <div className="connection-form" role="group" aria-labelledby="connection-form-title">
          <h3 id="connection-form-title">
            {editing.id
              ? t('connections.editConnection', { name: editing.name })
              : t('connections.newConnection')}
          </h3>
          <div className="grid-3">
            <Field label={t('connections.type')}>
              <select
                value={editing.type}
                disabled={Boolean(editing.id)}
                onChange={(e) => {
                  const type = e.target.value as DeployConnectionType
                  edit({ ...blank(type), name: editing.name })
                }}
              >
                {(Object.keys(TYPES) as DeployConnectionType[]).map((value) => (
                  <option key={value} value={value}>
                    {t(TYPE_NAMES[value])}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('connections.name')}>
              <input
                value={editing.name}
                placeholder={t(
                  server ? 'connections.namePlaceholderServer' : 'connections.namePlaceholder'
                )}
                autoFocus
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </Field>
            {!server && (
              <Field label={t('connections.accountId')} hint={t('connections.accountIdHint')}>
                <input
                  className="mono"
                  value={editing.accountId}
                  placeholder={t('connections.accountIdPlaceholder')}
                  onChange={(e) => setEditing({ ...editing, accountId: e.target.value })}
                />
              </Field>
            )}
          </div>
          {server && (
            <>
              <div className="grid-server">
                <Field label={t('connections.host')} hint={t('connections.hostHint')}>
                  <input
                    className="mono"
                    value={editing.host ?? ''}
                    placeholder={editing.type === 'sftp' ? 'ssh.example.com' : 'ftp.example.com'}
                    onChange={(e) => setEditing({ ...editing, host: e.target.value })}
                  />
                </Field>
                <Field label={t('connections.port')}>
                  <input
                    className="mono"
                    inputMode="numeric"
                    value={editing.port ?? ''}
                    placeholder={editing.type === 'sftp' ? '22' : '21'}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        port: Number(e.target.value.replace(/\D/g, '')) || undefined
                      })
                    }
                  />
                </Field>
                <Field label={t('connections.username')}>
                  <input
                    className="mono"
                    autoComplete="off"
                    spellCheck={false}
                    value={editing.username ?? ''}
                    onChange={(e) => setEditing({ ...editing, username: e.target.value })}
                  />
                </Field>
              </div>
              {editing.type === 'ftp' && (
                <div className="seo-check">
                  <label className="check check--inline">
                    <input
                      type="checkbox"
                      checked={Boolean(editing.secure)}
                      onChange={(e) => setEditing({ ...editing, secure: e.target.checked })}
                    />
                    <span>{t('connections.secure')}</span>
                  </label>
                  {!editing.secure && (
                    <Notice kind="error">{t('connections.plainFtpWarning')}</Notice>
                  )}
                </div>
              )}
              {editing.type === 'sftp' && (
                <div className="field">
                  <span className="field__label" id="sftp-auth-label">
                    {t('connections.signIn')}
                  </span>
                  <div className="segmented" role="radiogroup" aria-labelledby="sftp-auth-label">
                    {([false, true] as const).map((key) => (
                      <button
                        key={String(key)}
                        type="button"
                        role="radio"
                        aria-checked={useKey === key}
                        className={useKey === key ? 'is-active' : ''}
                        onClick={() => setUseKey(key)}
                      >
                        {t(key ? 'connections.signInKey' : 'connections.signInPassword')}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {editing.type === 'sftp' && useKey && (
                <Field label={t('connections.keyPath')} hint={t('connections.keyPathHint')}>
                  <span className="input-group">
                    <input
                      className="mono"
                      value={editing.keyPath ?? ''}
                      placeholder="~/.ssh/id_ed25519"
                      onChange={(e) => setEditing({ ...editing, keyPath: e.target.value })}
                    />
                    <button
                      type="button"
                      className="btn"
                      onClick={async () => {
                        const file = await window.api.pickFile(t('connections.keyPath'))
                        if (file) setEditing({ ...editing, keyPath: file })
                      }}
                    >
                      {t('common.choose')}
                    </button>
                  </span>
                </Field>
              )}
            </>
          )}
          <Field
            label={t(
              !server
                ? 'connections.token'
                : editing.type === 'sftp' && useKey
                  ? 'connections.passphrase'
                  : 'connections.password'
            )}
            hint={
              !server ? (
                <>
                  {t.rich(
                    FEATURES.pages ? 'connections.tokenHint' : 'connections.tokenHintWorkers',
                    { b: (chunk) => <b>{chunk}</b> }
                  )}{' '}
                  <button
                    type="button"
                    className="link"
                    onClick={() => window.api.openExternal(tokenTemplateUrl())}
                  >
                    {t('connections.createToken')}
                  </button>
                </>
              ) : editing.type === 'sftp' && useKey ? (
                t('connections.passphraseHint')
              ) : (
                t('connections.passwordHint')
              )
            }
          >
            <span className="input-group">
              <input
                type={showToken ? 'text' : 'password'}
                className="mono"
                autoComplete="off"
                spellCheck={false}
                value={editing.token ?? ''}
                placeholder={
                  editing.id
                    ? t(server ? 'connections.passwordKeep' : 'connections.tokenKeep')
                    : server
                      ? ''
                      : t('connections.tokenPaste')
                }
                onChange={(e) => setEditing({ ...editing, token: e.target.value })}
              />
              <button
                type="button"
                className="btn"
                aria-label={t('connections.showToken')}
                aria-pressed={showToken}
                onClick={() => setShowToken((v) => !v)}
              >
                {showToken ? t('common.hide') : t('common.show')}
              </button>
            </span>
          </Field>
          {checked?.hostKey && (
            <Explainer>
              {t.rich('connections.hostKey', { key: <code>{checked.hostKey}</code> })}
            </Explainer>
          )}
          <div className="panel__actions connection-form__actions">
            <button className="btn" onClick={() => edit(null)}>
              {t('common.cancel')}
            </button>
            {server && (
              <button className="btn" onClick={checkServer} disabled={busy}>
                {busy ? t('connections.checking') : t('connections.testConnection')}
              </button>
            )}
            <button className="btn btn--primary" onClick={save} disabled={busy}>
              {editing.id ? t('common.save') : t('connections.addConnection')}
            </button>
          </div>
        </div>
      )}
      {status && (
        <div role={status.kind === 'error' ? 'alert' : 'status'}>
          <Notice kind={status.kind}>{status.text}</Notice>
        </div>
      )}
    </Section>
  )
}
