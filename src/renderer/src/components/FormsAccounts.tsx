import { useEffect, useRef, useState } from 'react'
import { Notice, Section } from './Field'
import { useT } from '../i18n'
import { errorMessage } from '../lib/api'
import type { FormsAccountInfo, FormsAccountView, FormsUsage } from '../../../shared/types'

type Status = { kind: 'error' | 'success'; text: string } | null

/**
 * CraftForms accounts (unfinished/CRAFTFORMS.md): forms for sites without a
 * backend. Connecting happens in the browser, where people can also create a
 * free account; each project then picks which account its forms come from.
 * Entirely optional, so it says what it's for and stays quiet otherwise.
 */
export default function FormsAccounts(): React.JSX.Element {
  const t = useT()
  const [accounts, setAccounts] = useState<FormsAccountView[] | null>(null)
  const [info, setInfo] = useState<Record<string, FormsAccountInfo | string>>({})
  const [connecting, setConnecting] = useState(false)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>(null)
  const asked = useRef(new Set<string>())

  useEffect(() => {
    window.api.listFormsAccounts().then(setAccounts, () => setAccounts([]))
  }, [])

  // Each account's live card, asked once per list.
  useEffect(() => {
    for (const account of accounts ?? []) {
      if (!account.hasToken || asked.current.has(account.id)) continue
      asked.current.add(account.id)
      window.api.formsAccountInfo(account.id).then(
        (found) => setInfo((current) => ({ ...current, [account.id]: found })),
        (error) => {
          setInfo((current) => ({ ...current, [account.id]: errorMessage(error) }))
          // A refused token was cleared: show "Connect again".
          window.api.listFormsAccounts().then(setAccounts)
        }
      )
    }
  }, [accounts])

  const connect = async (): Promise<void> => {
    setConnecting(true)
    setStatus(null)
    try {
      const account = await window.api.connectFormsAccount()
      asked.current.delete(account.id)
      setAccounts(await window.api.listFormsAccounts())
      setStatus({
        kind: 'success',
        text: t('connections.formsConnected', { email: account.email })
      })
    } catch (error) {
      const text = errorMessage(error)
      if (!/cancelled/i.test(text)) setStatus({ kind: 'error', text })
    } finally {
      setConnecting(false)
    }
  }

  const disconnect = async (account: FormsAccountView): Promise<void> => {
    setConfirming(null)
    try {
      await window.api.disconnectFormsAccount(account.id)
      setAccounts(await window.api.listFormsAccounts())
      setStatus({
        kind: 'success',
        text: t('connections.formsDisconnected', { email: account.email })
      })
    } catch (error) {
      setStatus({ kind: 'error', text: errorMessage(error) })
    }
  }

  const usage = (label: string, value: FormsUsage | null | undefined): string | null =>
    value ? `${label} ${value.used}/${value.limit === 0 ? '∞' : value.limit}` : null

  return (
    <Section
      title={t('connections.formsTitle')}
      description={t('connections.formsDescription')}
      actions={
        connecting ? (
          <div className="add-menu">
            <span className="muted small">{t('connections.formsWaiting')}</span>
            <button className="btn" onClick={() => window.api.cancelFormsConnect()}>
              {t('common.cancel')}
            </button>
          </div>
        ) : (
          <button className={accounts?.length ? 'btn' : 'btn btn--accent'} onClick={connect}>
            {t(accounts?.length ? 'connections.formsAddAnother' : 'connections.formsConnect')}
          </button>
        )
      }
    >
      {status && <Notice kind={status.kind}>{status.text}</Notice>}
      {accounts && accounts.length === 0 && <p className="muted">{t('connections.formsEmpty')}</p>}
      {accounts && accounts.length > 0 && (
        <ul className="connections">
          {accounts.map((account) => {
            const card = info[account.id]
            const live = typeof card === 'object' ? card : null
            return (
              <li key={account.id}>
                <div className="connections__info">
                  <div className="connections__name">
                    <strong>{account.email}</strong>
                    <span className="badge">
                      {t('connections.formsPlan', { plan: planName(account.plan) })}
                    </span>
                  </div>
                  <div className="connections__meta muted small">
                    {!account.hasToken ? (
                      <b className="connections__warn">{t('connections.formsSignedOut')}</b>
                    ) : typeof card === 'string' ? (
                      <b className="connections__warn">{card}</b>
                    ) : !live ? (
                      t('common.loading')
                    ) : live.hostingState !== 'active' ? (
                      t(
                        live.emailVerified
                          ? 'connections.formsNoSite'
                          : 'connections.formsVerifyEmail'
                      )
                    ) : (
                      [
                        usage(t('connections.formsForms'), live.limits?.forms),
                        usage(t('connections.formsWebsites'), live.limits?.websites)
                      ]
                        .filter(Boolean)
                        .join(' · ') || t('connections.formsSiteReady')
                    )}
                  </div>
                </div>
                {confirming === account.id ? (
                  <div className="connections__confirm" role="group">
                    <span className="small">
                      {t('connections.formsConfirmDisconnect', { email: account.email })}
                    </span>
                    <div className="panel__actions">
                      <button
                        className="btn btn--small btn--danger"
                        onClick={() => disconnect(account)}
                      >
                        {t('connections.formsDisconnect')}
                      </button>
                      <button className="btn btn--small" onClick={() => setConfirming(null)}>
                        {t('common.cancel')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="panel__actions">
                    {!account.hasToken ? (
                      <button
                        className="btn btn--small btn--accent"
                        disabled={connecting}
                        onClick={connect}
                      >
                        {t('connections.formsReconnect')}
                      </button>
                    ) : (
                      live && (
                        <button
                          className="btn btn--small"
                          // Opens in the system browser (setWindowOpenHandler).
                          onClick={() => window.open(live.urls.dashboard)}
                        >
                          {t('connections.formsDashboard')}
                        </button>
                      )
                    )}
                    <button className="btn btn--small" onClick={() => setConfirming(account.id)}>
                      {t('connections.formsDisconnect')}
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Section>
  )
}

/** The plans' public names; the API speaks the internal ids. */
function planName(plan: string): string {
  return plan === 'rentio'
    ? 'Solo'
    : plan === 'rentio-plus'
      ? 'Studio'
      : plan === 'free'
        ? 'Free'
        : plan
}
