import { useEffect, useState } from 'react'
import { Field, Notice } from './Field'
import Modal from './Modal'
import { useT } from '../i18n'
import { errorMessage, isMac, toLocalInput } from '../lib/api'
import type { DraftState, PageRelease } from '../../../shared/types'

interface Props {
  drafts: DraftState
  onScheduled: (release: PageRelease) => void
  onClose: () => void
}

/** Tomorrow at 08:00 local time: the usual "live on launch day" moment. */
function tomorrowMorning(): string {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  date.setHours(8, 0, 0, 0)
  return date.toISOString()
}

const plusDays = (iso: string, days: number): string =>
  new Date(new Date(iso).getTime() + days * 86400_000).toISOString()

/**
 * Sets every unsaved page edit aside to go live at a time, optionally coming
 * down again later (a promo). Until then the site stays as it is.
 */
export default function ScheduleModal({ drafts, onScheduled, onClose }: Props): React.JSX.Element {
  const t = useT()
  const [label, setLabel] = useState('')
  const [at, setAt] = useState(tomorrowMorning)
  const [ends, setEnds] = useState(false)
  const [until, setUntil] = useState(() => plusDays(tomorrowMorning(), 7))
  const [deploy, setDeploy] = useState(false)
  const [canDeploy, setCanDeploy] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone

  useEffect(() => {
    window.api.getSiteSettings().then((site) => {
      const ready = Boolean(
        site.deploy.connection &&
        (site.deploy.target === 'server'
          ? site.deploy.connection
          : site.deploy.target === 'pages'
            ? site.deploy.projectName
            : site.deploy.workerName)
      )
      setCanDeploy(ready)
      setDeploy(ready)
    })
  }, [])

  const submit = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      onScheduled(
        await window.api.scheduleDrafts({ label, at, until: ends ? until : null, deploy })
      )
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const fromInput = (value: string): string | null => (value ? new Date(value).toISOString() : null)

  return (
    <Modal label={t('schedule.title')} className="modal--narrow modal--auto" onClose={onClose}>
      <form
        className="modal__form"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <header className="modal__head">
          <h2>{t('schedule.title')}</h2>
        </header>
        <div className="modal__body">
          <p className="muted">
            {drafts.pages.length === 1
              ? t('schedule.introOne', { page: drafts.pages[0].path })
              : t('schedule.introMany', {
                  count: drafts.pages.length,
                  pages: drafts.pages.map((p) => p.path).join(', ')
                })}
          </p>
          <Field label={t('schedule.name')} hint={t('schedule.nameHint')}>
            <input
              autoFocus
              placeholder={t('schedule.namePlaceholder')}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </Field>
          <Field label={t('schedule.goesLive')} hint={t('schedule.zoneHint', { zone })}>
            <input
              type="datetime-local"
              required
              value={toLocalInput(at)}
              onChange={(e) => {
                const next = fromInput(e.target.value)
                if (!next) return
                // Keep the same length of promo when the start moves.
                if (ends) setUntil(plusDays(next, (Date.parse(until) - Date.parse(at)) / 86400_000))
                setAt(next)
              }}
            />
          </Field>
          <label className="check">
            <input type="checkbox" checked={ends} onChange={(e) => setEnds(e.target.checked)} />
            {t('schedule.takeDown')}
          </label>
          {ends && (
            <Field label={t('schedule.comesDown')} hint={t('schedule.comesDownHint')}>
              <input
                type="datetime-local"
                required
                value={toLocalInput(until)}
                onChange={(e) => {
                  const next = fromInput(e.target.value)
                  if (next) setUntil(next)
                }}
              />
            </Field>
          )}
          <label className="check">
            <input
              type="checkbox"
              checked={deploy}
              disabled={!canDeploy}
              onChange={(e) => setDeploy(e.target.checked)}
            />
            {ends ? t('schedule.deployBoth') : t('schedule.deploy')}
          </label>
          {canDeploy === false && <p className="muted small">{t('schedule.noDeploy')}</p>}
          <Notice>{isMac ? t('schedule.backgroundMac') : t('schedule.backgroundOther')}</Notice>
          {error && (
            <div role="alert">
              <Notice kind="error">{error}</Notice>
            </div>
          )}
        </div>
        <footer className="modal__foot">
          <button type="button" className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? t('schedule.submitting') : t('schedule.submit')}
          </button>
        </footer>
      </form>
    </Modal>
  )
}
