import { Icon, closeSmall, update as updateIcon } from '@wordpress/icons'
import { useT } from '../i18n'
import { useStoredState } from '../lib/api'
import type { UpdateState } from '../../../shared/types'

/** "A new version is out", at the bottom of the sidebar until it is installed or dismissed. */
export default function UpdateCard({
  update
}: {
  update: UpdateState | null
}): React.JSX.Element | null {
  const t = useT()
  // Dismissing hides that version only; the next one shows again.
  const [dismissed, setDismissed] = useStoredState<string>('updates.dismissed', '')
  if (!update?.version) return null
  if (!['available', 'downloading', 'ready'].includes(update.status)) return null
  if (dismissed === update.version && update.status !== 'ready') return null
  const version = update.version

  return (
    <div className="update-card" role="status">
      <div className="update-card__head">
        <span className="update-card__icon" aria-hidden="true">
          <Icon icon={updateIcon} size={18} />
        </span>
        <span className="update-card__text">
          <strong>{t('updates.title', { version })}</strong>
          {update.url && (
            <button className="link" onClick={() => window.api.openExternal(update.url!)}>
              {t('updates.whatsNew')}
            </button>
          )}
        </span>
        <button
          className="update-card__close"
          onClick={() => setDismissed(version)}
          aria-label={t('updates.dismiss')}
          title={t('updates.dismiss')}
        >
          <Icon icon={closeSmall} size={18} />
        </button>
      </div>

      {update.status === 'available' && (
        <>
          <button
            className="btn btn--small btn--block"
            onClick={() => window.api.openExternal(update.url!)}
          >
            {t('updates.download')}
          </button>
          <small className="muted">{t('updates.downloadHint')}</small>
        </>
      )}
      {update.status === 'downloading' && (
        <>
          <progress value={update.percent ?? 0} max={100} aria-label={t('updates.downloading')} />
          <small className="muted">
            {t('updates.downloadingPercent', { percent: update.percent ?? 0 })}
          </small>
        </>
      )}
      {update.status === 'ready' && (
        <button
          className="btn btn--small btn--block btn--primary"
          onClick={() => window.api.installUpdate()}
        >
          {t('updates.restart')}
        </button>
      )}
    </div>
  )
}
