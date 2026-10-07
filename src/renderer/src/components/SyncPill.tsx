import { useState } from 'react'
import { useT } from '../i18n'
import { errorMessage, formatDate } from '../lib/api'
import { namesOf } from '../lib/sync'
import type { SyncStatus } from '../../../shared/types'

interface Props {
  status: SyncStatus | null
  /** Opens Project settings at the sync section. */
  onOpenSettings: () => void
}

/**
 * Above "Publish site": whether this computer and the others are in step, and who else
 * has the project open. One click syncs.
 */
export default function SyncPill({ status, onOpenSettings }: Props): React.JSX.Element | null {
  const t = useT()
  const [error, setError] = useState<string | null>(null)
  if (!status || status.mode === 'off') return null

  const sync = async (): Promise<void> => {
    setError(null)
    try {
      await window.api.syncNow()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const problem = error ?? status.error
  const state = status.busy
    ? 'busy'
    : status.conflicts.length
      ? 'conflict'
      : problem
        ? 'error'
        : status.behind
          ? 'behind'
          : status.ahead
            ? 'ahead'
            : 'ok'
  const label = {
    busy: t('sync.pillBusy'),
    conflict: t('sync.pillConflicts', { count: status.conflicts.length }),
    error: t('sync.pillError'),
    behind: t('sync.pillBehind', { device: status.remote?.device ?? '' }),
    ahead: t('sync.pillAhead'),
    ok: t('sync.pillOk')
  }[state]
  const tip =
    state === 'error'
      ? problem!
      : status.lastSync
        ? t('sync.lastSync', { date: formatDate(status.lastSync) })
        : t('sync.neverSynced')

  return (
    <div className="sync-pill">
      {status.people.length > 0 && (
        <p
          className="sync-pill__people"
          title={status.people.map((p) => `${p.device}: ${p.page ?? '—'}`).join('\n')}
        >
          <span className="dot dot--on" aria-hidden="true" />
          {t('sync.alsoOpen', { names: namesOf(status.people) })}
        </p>
      )}
      <button
        className={`sync-pill__button sync-pill__button--${state}`}
        title={tip}
        disabled={status.busy}
        onClick={state === 'conflict' ? onOpenSettings : sync}
      >
        <span className="sync-pill__icon" aria-hidden="true">
          {state === 'busy'
            ? '↻'
            : state === 'ok'
              ? '✓'
              : state === 'behind'
                ? '↓'
                : state === 'ahead'
                  ? '↑'
                  : '!'}
        </span>
        {label}
      </button>
    </div>
  )
}
