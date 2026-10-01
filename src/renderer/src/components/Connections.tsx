import { useState } from 'react'
import { Field, Notice, Section } from './Field'
import { translate, useT } from '../i18n'
import { errorMessage } from '../lib/api'
import { FEATURES } from '../../../shared/features'
import type { ConnectionInput, ConnectionsView, DeployConnectionView } from '../../../shared/types'

interface Props {
  view: ConnectionsView | null
  onChange: (view: ConnectionsView) => void
}

type Status = { kind: 'error' | 'success'; text: string } | null

// The stored type id predates Workers; it is the Cloudflare account either way.
const TYPES = { 'cloudflare-pages': FEATURES.pages ? 'Cloudflare Pages' : 'Cloudflare' } as const

const blank = (): ConnectionInput => ({
  type: 'cloudflare-pages',
  name: '',
  accountId: '',
  token: ''
})

/** What the token can reach, and what it's missing. */
function describe(found: { workers: number | null; pages: number | null }): string {
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

  const edit = (input: ConnectionInput | null): void => {
    setEditing(input)
    setShowToken(false)
    setConfirming(null)
  }

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
      const saved = await window.api.saveConnection({
        ...editing!,
        // Empty while editing = keep the stored token.
        token: editing!.id && !editing!.token ? undefined : editing!.token
      })
      onChange(await window.api.listConnections())
      edit(null)
      const found = await window.api.testConnection(saved.id).catch(() => null)
      return found
        ? t('connections.saved', { name: saved.name, details: describe(found) })
        : t(FEATURES.pages ? 'connections.savedBadToken' : 'connections.savedBadTokenWorkers', {
            name: saved.name
          })
    })

  const test = (connection: DeployConnectionView): Promise<void> =>
    run(async () => {
      const found = await window.api.testConnection(connection.id)
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
          <button className="btn btn--accent" onClick={() => edit(blank())}>
            {t('connections.add')}
          </button>
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
                  <span className="badge">{TYPES[connection.type]}</span>
                </div>
                <div className="connections__meta muted small">
                  <span className="mono">{connection.accountId}</span>
                  <span aria-hidden="true"> · </span>
                  {connection.hasToken ? (
                    t('connections.tokenSaved')
                  ) : (
                    <b className="connections__warn">{t('connections.noToken')}</b>
                  )}
                  <span aria-hidden="true"> · </span>
                  {connection.usedBy.length
                    ? t('connections.usedBy', { projects: connection.usedBy.join(', ') })
                    : t('connections.notUsed')}
                </div>
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
            <Field label={t('connections.type')} hint={t('connections.typeHint')}>
              <select value={editing.type} disabled>
                {Object.entries(TYPES).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('connections.name')}>
              <input
                value={editing.name}
                placeholder={t('connections.namePlaceholder')}
                autoFocus
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </Field>
            <Field label={t('connections.accountId')} hint={t('connections.accountIdHint')}>
              <input
                className="mono"
                value={editing.accountId}
                placeholder={t('connections.accountIdPlaceholder')}
                onChange={(e) => setEditing({ ...editing, accountId: e.target.value })}
              />
            </Field>
          </div>
          <Field
            label={t('connections.token')}
            hint={t.rich(
              FEATURES.pages ? 'connections.tokenHint' : 'connections.tokenHintWorkers',
              { b: (chunk) => <b>{chunk}</b> }
            )}
          >
            <span className="input-group">
              <input
                type={showToken ? 'text' : 'password'}
                className="mono"
                autoComplete="off"
                spellCheck={false}
                value={editing.token ?? ''}
                placeholder={editing.id ? t('connections.tokenKeep') : t('connections.tokenPaste')}
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
          <div className="panel__actions connection-form__actions">
            <button className="btn" onClick={() => edit(null)}>
              {t('common.cancel')}
            </button>
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
