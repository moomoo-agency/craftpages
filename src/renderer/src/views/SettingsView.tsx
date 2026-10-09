import { useEffect, useState } from 'react'
import Connections from '../components/Connections'
import { Explainer, Field, Notice, Section } from '../components/Field'
import { LOCALES, useLocale, useT, type Key, type Locale } from '../i18n'
import { FEATURES } from '../../../shared/features'
import { copyText, errorMessage, formatDate, isMac } from '../lib/api'
import type {
  AppSettingsView,
  ConnectionsView,
  McpStatus,
  ThemeSource,
  UpdateState
} from '../../../shared/types'

interface Props {
  mcp: McpStatus | null
  theme: ThemeSource
  onThemeChange: (theme: ThemeSource) => void
  update: UpdateState | null
}

type Status = { kind: 'error' | 'success'; text: string } | null

const THEMES: { value: ThemeSource; label: Key }[] = [
  { value: 'system', label: 'settings.themeSystem' },
  { value: 'light', label: 'settings.themeLight' },
  { value: 'dark', label: 'settings.themeDark' }
]

/** App-wide settings, shared by every project: appearance, deploy connections and the AI connection. */
export default function SettingsView({
  mcp,
  theme,
  onThemeChange,
  update
}: Props): React.JSX.Element {
  const t = useT()
  const [locale, setLocale] = useLocale()
  const [app, setApp] = useState<AppSettingsView | null>(null)
  const [connections, setConnections] = useState<ConnectionsView | null>(null)
  const [showMcpToken, setShowMcpToken] = useState(false)
  const [status, setStatus] = useState<Record<string, Status>>({})
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    window.api.getAppSettings().then(setApp)
    window.api.listConnections().then(setConnections)
  }, [])

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
      <div role={current?.kind === 'error' ? 'alert' : 'status'}>
        {current && <Notice kind={current.kind}>{current.text}</Notice>}
      </div>
    )
  }

  if (!app) return <div className="muted">{t('common.loading')}</div>

  const saveBackground = (patch: Partial<AppSettingsView['background']>): Promise<void> =>
    run('background', async () => {
      setApp(await window.api.saveAppSettings({ background: patch }))
    })

  const saveMcp = (): Promise<void> =>
    run('mcp', async () => {
      setApp(await window.api.saveAppSettings({ mcp: app.mcp }))
      return app.mcp.enabled
        ? t('settings.listening', { port: app.mcp.port })
        : t('settings.mcpOff')
    })

  return (
    <div className="settings">
      <p className="muted settings__group-note">{t('settings.intro')}</p>

      {/* ---------- Appearance ---------- */}
      <Section title={t('settings.appearance')} description={t('settings.appearanceHint')}>
        <div className="grid-2">
          <Field label={t('settings.language')} hint={t('settings.languageHint')}>
            <select value={locale} onChange={(e) => setLocale(e.target.value as Locale)}>
              {LOCALES.map((option) => (
                <option key={option.code} value={option.code} lang={option.code}>
                  {option.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="field">
            <span className="field__label" id="theme-label">
              {t('settings.theme')}
            </span>
            <div
              className="segmented segmented--fit"
              role="radiogroup"
              aria-labelledby="theme-label"
            >
              {THEMES.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={theme === option.value}
                  className={theme === option.value ? 'is-active' : ''}
                  onClick={() => onThemeChange(option.value)}
                >
                  {t(option.label)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Section>

      <Connections view={connections} onChange={setConnections} />

      {/* ---------- Background (scheduling) ---------- */}
      {FEATURES.scheduling && (
        <Section title={t('settings.background')} description={t('settings.backgroundHint')}>
          <label className="check">
            <input
              type="checkbox"
              checked={app.background.keepRunning}
              onChange={(e) => saveBackground({ keepRunning: e.target.checked })}
            />
            {isMac ? t('settings.keepRunningMac') : t('settings.keepRunningOther')}
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={app.background.openAtLogin}
              onChange={(e) => saveBackground({ openAtLogin: e.target.checked })}
            />
            {t('settings.openAtLogin')}
          </label>
          <Explainer>{t('settings.sleepNote')}</Explainer>
          {show('background')}
        </Section>
      )}

      {/* ---------- AI connection ---------- */}
      <Section
        title={t('settings.mcp')}
        description={t('settings.mcpHint')}
        actions={
          <button className="btn btn--primary" onClick={saveMcp} disabled={busy === 'mcp'}>
            {busy === 'mcp' ? t('common.saving') : t('common.save')}
          </button>
        }
      >
        <label className="check">
          <input
            type="checkbox"
            checked={app.mcp.enabled}
            onChange={(e) => setApp({ ...app, mcp: { ...app.mcp, enabled: e.target.checked } })}
          />
          {t('settings.mcpEnabled')}
        </label>
        <div className="grid-2">
          <Field label={t('settings.port')} hint={t('settings.portHint')}>
            <input
              type="number"
              min={1024}
              max={65535}
              value={app.mcp.port}
              onChange={(e) =>
                setApp({ ...app, mcp: { ...app.mcp, port: Number(e.target.value) } })
              }
            />
          </Field>
          <Field
            label={t('settings.token')}
            hint={
              <button
                type="button"
                className="link"
                onClick={() =>
                  run('mcp', async () => {
                    await window.api.regenerateMcpToken()
                    return t('settings.regenerated')
                  })
                }
              >
                {t('settings.regenerate')}
              </button>
            }
          >
            <div className="input-group">
              <input
                className="mono"
                readOnly
                type={showMcpToken ? 'text' : 'password'}
                value={mcp?.token ?? ''}
              />
              <button
                type="button"
                className="btn"
                aria-pressed={showMcpToken}
                aria-label={showMcpToken ? t('settings.hideToken') : t('settings.showToken')}
                onClick={() => setShowMcpToken((v) => !v)}
              >
                {showMcpToken ? t('common.hide') : t('common.show')}
              </button>
            </div>
          </Field>
        </div>
        {mcp && (
          <>
            <p className="status-line">
              <span className={`dot ${mcp.running ? 'dot--on' : ''}`} aria-hidden="true" />
              {mcp.running
                ? `${t('settings.statusListening', { url: mcp.url })} · ${
                    mcp.clients.length
                      ? t('settings.statusClients', { clients: mcp.clients.join(', ') })
                      : t('settings.statusNoClients')
                  }`
                : (mcp.error ?? t('settings.notRunning'))}
            </p>
            <Field label={t('settings.addToClaude')} hint={t('settings.addToClaudeHint')}>
              <div className="input-group">
                <input className="mono" readOnly value={mcp.command} />
                <CopyButton text={mcp.command} label={t('settings.copyCommand')} />
              </div>
            </Field>
            <Explainer>{t('settings.addToClaudeSteps')}</Explainer>
          </>
        )}
        {show('mcp')}
      </Section>

      {/* ---------- Updates ---------- */}
      <UpdatesSection update={update} />

      {/* ---------- Diagnostics ---------- */}
      <Section
        title={t('settings.diagnostics')}
        description={t('settings.diagnosticsHint')}
        actions={
          <>
            <button className="btn" onClick={() => window.api.showLog()}>
              {t('settings.showLog')}
            </button>
            <button
              className="btn"
              disabled={busy === 'log'}
              onClick={() =>
                run('log', async () =>
                  (await window.api.copyLog()) ? t('settings.logCopied') : t('settings.logEmpty')
                )
              }
            >
              {t('settings.copyLog')}
            </button>
          </>
        }
      >
        <Explainer>{t('settings.logPrivacy')}</Explainer>
        {show('log')}
      </Section>
    </div>
  )
}

/** Copy with a short "Copied" confirmation, announced to screen readers. */
function CopyButton({ text, label }: { text: string; label: string }): React.JSX.Element {
  const t = useT()
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])
  return (
    <button
      type="button"
      className="btn btn--accent"
      aria-label={label}
      onClick={() => copyText(text).then(() => setCopied(true))}
    >
      <span aria-live="polite">{copied ? t('common.copied') : t('common.copy')}</span>
    </button>
  )
}

/** The running version, the last check and what to do about a new one. */
function UpdatesSection({ update }: { update: UpdateState | null }): React.JSX.Element | null {
  const t = useT()
  const [checking, setChecking] = useState(false)
  if (!update) return null
  const version = update.version ?? ''
  const busy =
    checking || ['unsupported', 'checking', 'downloading', 'ready'].includes(update.status)

  const line = {
    unsupported: t('updates.unsupported'),
    idle: t('updates.checking'),
    checking: t('updates.checking'),
    current: t('updates.current', {
      date: update.checkedAt ? formatDate(update.checkedAt) : ''
    }),
    available: t('updates.available', { version }),
    downloading: t('updates.downloadingVersion', { version, percent: update.percent ?? 0 }),
    ready: t('updates.ready', { version }),
    error: t('updates.error', { error: update.error ?? '' })
  }[update.status]

  const check = async (): Promise<void> => {
    setChecking(true)
    try {
      await window.api.checkForUpdate()
    } finally {
      setChecking(false)
    }
  }

  return (
    <Section
      title={t('updates.section')}
      description={t('updates.sectionHint', { version: update.current })}
      actions={
        <>
          {update.status === 'available' && update.url && (
            <button
              className="btn btn--primary"
              onClick={() => window.api.openExternal(update.url!)}
            >
              {t('updates.download')}
            </button>
          )}
          {update.status === 'ready' && (
            <button className="btn btn--primary" onClick={() => window.api.installUpdate()}>
              {t('updates.restart')}
            </button>
          )}
          <button className="btn" onClick={check} disabled={busy}>
            {t('updates.checkNow')}
          </button>
        </>
      }
    >
      <p className={update.status === 'error' ? 'small' : 'muted small'} role="status">
        {line}{' '}
        <button
          className="link"
          onClick={() =>
            window.api.openExternal('https://github.com/moomoo-agency/craftpages/releases')
          }
        >
          {t('updates.allReleases')}
        </button>
      </p>
    </Section>
  )
}
