import { useState } from 'react'
import { Notice } from './Field'
import { useT } from '../i18n'
import { errorMessage } from '../lib/api'
import { r2Url, tokenTemplateUrl } from '../lib/cloudflare'
import type { DeployConnectionView, TokenCheck } from '../../../shared/types'

interface Props {
  connection: DeployConnectionView
  /** What's missing: the token's permission, or R2 itself on the account. */
  r2: Exclude<TokenCheck['r2'], 'ok'>
  /** After a new token was saved, or R2 was turned on: the fresh check. */
  onChecked: (check: TokenCheck) => void
}

/**
 * "This token can publish, but not sync": what's missing, a link that creates a token with
 * the right permissions, and a field to paste it. Publishing keeps working meanwhile.
 */
export default function TokenUpgrade({ connection, r2, onChecked }: Props): React.JSX.Element {
  const t = useT()
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const check = async (newToken?: string): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      if (newToken) {
        await window.api.saveConnection({ ...connection, token: newToken })
        setToken('')
      }
      const result = await window.api.testConnection(connection.id)
      if (result.workers === null && result.pages === null)
        throw new Error(t('connections.upgradeCantPublish'))
      onChecked(result)
      if (result.r2 !== 'ok')
        setError(
          t(
            result.r2 === 'disabled'
              ? 'connections.upgradeStillDisabled'
              : 'connections.upgradeStillMissing'
          )
        )
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="token-upgrade" role="group" aria-labelledby={`upgrade-${connection.id}`}>
      <strong id={`upgrade-${connection.id}`}>
        {t(r2 === 'disabled' ? 'connections.upgradeDisabledTitle' : 'connections.upgradeTitle')}
      </strong>
      <p className="small">
        {t.rich(r2 === 'disabled' ? 'connections.upgradeDisabledBody' : 'connections.upgradeBody', {
          b: (chunk) => <b>{chunk}</b>
        })}
      </p>
      {r2 === 'missing' ? (
        <>
          <ol className="token-upgrade__steps small">
            <li>
              {t('connections.upgradeStep1')}{' '}
              <button className="link" onClick={() => window.api.openExternal(tokenTemplateUrl())}>
                {t('connections.upgradeCreate')}
              </button>
            </li>
            <li>{t('connections.upgradeStep2')}</li>
          </ol>
          <span className="input-group">
            <input
              type="password"
              className="mono"
              autoComplete="off"
              spellCheck={false}
              aria-label={t('connections.upgradePaste')}
              placeholder={t('connections.upgradePaste')}
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
            <button
              className="btn btn--primary"
              disabled={busy || !token.trim()}
              onClick={() => check(token.trim())}
            >
              {busy ? t('connections.checking') : t('connections.upgradeSave')}
            </button>
          </span>
        </>
      ) : (
        <div className="panel__actions panel__actions--start">
          <button
            className="btn"
            onClick={() => window.api.openExternal(r2Url(connection.accountId))}
          >
            {t('connections.upgradeOpenR2')}
          </button>
          <button className="btn btn--primary" disabled={busy} onClick={() => check()}>
            {busy ? t('connections.checking') : t('connections.upgradeCheckAgain')}
          </button>
        </div>
      )}
      {error && (
        <div role="alert">
          <Notice kind="error">{error}</Notice>
        </div>
      )}
    </div>
  )
}
