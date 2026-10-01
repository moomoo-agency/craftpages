import { useCallback, useEffect, useState } from 'react'
import { Notice, Section } from './Field'
import { useT, type Key } from '../i18n'
import { errorMessage, formatDate, useAppEvent } from '../lib/api'
import type { PageRelease, ScheduleOverview, Workspace } from '../../../shared/types'

interface Props {
  workspace: Workspace
}

const STATE_LABEL: Record<PageRelease['state'], [string, Key]> = {
  scheduled: ['scheduled', 'publish.stateScheduled'],
  live: ['accepted', 'publish.stateLive'],
  done: ['', 'publish.stateDone'],
  blocked: ['failed', 'publish.stateBlocked']
}

/** Scheduled page changes and posts of the open project, on the Publish screen. */
export default function ScheduledSection({ workspace }: Props): React.JSX.Element {
  const t = useT()
  const [overview, setOverview] = useState<ScheduleOverview | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    window.api.getSchedule().then(setOverview, (e) => setError(errorMessage(e)))
  }, [])

  useEffect(load, [load, workspace.root])

  useAppEvent((event) => {
    if (
      (event.type === 'schedule' && event.root === workspace.root) ||
      (event.type === 'scheduled' && event.run.root === workspace.root)
    )
      load()
  })

  const act = async (key: string, task: () => Promise<unknown>): Promise<void> => {
    setBusy(key)
    setError(null)
    setConfirming(null)
    try {
      await task()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(null)
      load()
    }
  }

  const actions = (release: PageRelease): React.ReactNode => {
    const key = (name: string): string => `${release.id}:${name}`
    const button = (
      name: string,
      label: string,
      task: () => Promise<unknown>,
      variant = ''
    ): React.JSX.Element => (
      <button
        key={name}
        className={`btn btn--small${variant ? ` btn--${variant}` : ''}`}
        disabled={busy !== null}
        aria-busy={busy === key(name)}
        aria-label={busy === key(name) ? label : undefined}
        onClick={() => act(key(name), task)}
      >
        {busy === key(name) ? '…' : label}
      </button>
    )
    // Overwriting someone else's change takes a second click.
    const forced = (name: string, label: string, task: () => Promise<unknown>): React.ReactNode =>
      confirming === key(name) ? (
        <>
          {button(name, t('publish.overwrite'), task, 'danger')}
          <button className="btn btn--small" onClick={() => setConfirming(null)}>
            {t('common.cancel')}
          </button>
        </>
      ) : (
        <button
          key={name}
          className="btn btn--small btn--danger-outline"
          disabled={busy !== null}
          onClick={() => setConfirming(key(name))}
        >
          {label}
        </button>
      )

    switch (release.state) {
      case 'scheduled':
        return (
          <>
            {button(
              'now',
              t('publish.publishNow'),
              () => window.api.releaseNow(release.id),
              'accent'
            )}
            {button('cancel', t('publish.unschedule'), () => window.api.cancelRelease(release.id))}
          </>
        )
      case 'blocked':
        return (
          <>
            {forced('force', t('publish.publishAnyway'), () =>
              window.api.releaseNow(release.id, true)
            )}
            {button('cancel', t('publish.unschedule'), () => window.api.cancelRelease(release.id))}
          </>
        )
      case 'live':
        return (
          <>
            {release.message
              ? forced('end', t('publish.takeDownAnyway'), () =>
                  window.api.endRelease(release.id, true)
                )
              : button('end', t('publish.takeDownNow'), () => window.api.endRelease(release.id))}
            {button('keep', t('publish.keepLive'), () => window.api.cancelRelease(release.id))}
          </>
        )
      default:
        return null
    }
  }

  const when = (release: PageRelease): string => {
    if (release.state === 'done') {
      return release.endedAt
        ? t('publish.wasLive', {
            from: formatDate(release.releasedAt!),
            to: formatDate(release.endedAt)
          })
        : t('publish.wentLive', { date: formatDate(release.releasedAt ?? release.at) })
    }
    const start =
      release.state === 'live'
        ? t('publish.liveSince', { date: formatDate(release.releasedAt ?? release.at) })
        : t('publish.goesLive', { date: formatDate(release.at) })
    return release.until
      ? `${start} · ${t('publish.comesDown', { date: formatDate(release.until) })}`
      : start
  }

  // The reason comes from the main process; the explanation of the buttons is added here.
  const help = (release: PageRelease): string | null => {
    if (release.state === 'blocked') return `${release.message} ${t('publish.helpBlocked')}`
    if (release.state === 'live' && release.message)
      return `${release.message} ${t('publish.helpLive')}`
    return release.message ?? null
  }

  const releases = overview?.releases ?? []
  const posts = overview?.posts ?? []
  const empty = overview && !releases.length && !posts.length && !overview.deployRetry

  return (
    <Section title={t('publish.scheduledTitle')} description={t('publish.scheduledDescription')}>
      {!overview && !error && <p className="muted">{t('common.loading')}</p>}
      {empty && (
        <p className="muted">
          {t.rich('publish.nothingScheduled', {
            schedule: <strong>{t('app.schedule')}</strong>,
            saveAll: <strong>{t('app.saveAll')}</strong>
          })}
        </p>
      )}
      {overview?.deployRetry && (
        <div role="alert">
          <Notice kind="error">
            {t('publish.deployRetry', {
              date: formatDate(overview.deployRetry.since),
              error: overview.deployRetry.error
            })}
          </Notice>
        </div>
      )}
      {(releases.length > 0 || posts.length > 0) && (
        <ul className="release-list">
          {releases.map((release) => {
            const [pill, label] = STATE_LABEL[release.state]
            const note = help(release)
            return (
              <li
                key={release.id}
                className={`release${release.state === 'done' ? ' release--done' : ''}`}
              >
                <span className="release__title">
                  {release.label}
                  <span className={`pill${pill ? ` pill--${pill}` : ''}`}>{t(label)}</span>
                </span>
                <span className="release__meta">{when(release)}</span>
                <span className="release__meta mono">
                  {release.pages.join(', ')}
                  {release.deploy ? ` · ${t('publish.deploysToProduction')}` : ''}
                </span>
                <span className="release__actions">{actions(release)}</span>
                {note && (
                  <Notice kind={release.state === 'blocked' ? 'error' : 'info'}>{note}</Notice>
                )}
              </li>
            )
          })}
          {posts.map((post) => (
            <li key={post.id} className="release">
              <span className="release__title">
                {post.title}
                <span className="pill pill--scheduled">{t('publish.post')}</span>
              </span>
              <span className="release__meta">
                {t('publish.goesLive', { date: formatDate(post.date) })}
              </span>
              <span className="release__meta mono">{post.url}</span>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <div role="alert">
          <Notice kind="error">{error}</Notice>
        </div>
      )}
    </Section>
  )
}
