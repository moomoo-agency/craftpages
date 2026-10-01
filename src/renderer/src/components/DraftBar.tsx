import { useEffect, useId, useRef, useState } from 'react'
import ScheduleModal from './ScheduleModal'
import { FEATURES } from '../../../shared/features'
import { useT } from '../i18n'
import { shortcut } from '../lib/api'
import type { DraftState, PageRelease, SaveResult } from '../../../shared/types'

interface Props {
  drafts: DraftState
  lastSave: SaveResult | null
  busy: boolean
  onSaveAll: () => void
  onScheduled: (release: PageRelease) => void
  onDiscard: (path: string | null) => void
  onUndo: () => void
  onOpenPage: (path: string) => void
  onDismiss: () => void
}

/** Top-bar status of unsaved drafts across pages, with Save all / Discard and the last save's result. */
export default function DraftBar({
  drafts,
  lastSave,
  busy,
  onSaveAll,
  onScheduled,
  onDiscard,
  onUndo,
  onOpenPage,
  onDismiss
}: Props): React.JSX.Element | null {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [scheduling, setScheduling] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const menuId = useId()
  const ref = useRef<HTMLDivElement>(null)
  const count = drafts.pages.length

  // The page list closes on Escape and on a click anywhere else.
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }
    const onDown = (event: MouseEvent): void => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onDown)
    }
  }, [open])

  if (count === 0) {
    if (!lastSave) return null
    return (
      <div className="draft-bar" role="status">
        <span className="draft-bar__done">
          {lastSave.pages.length
            ? t('app.savedPages', { count: lastSave.pages.length })
            : t('app.nothingToSave')}
          {lastSave.skipped.length > 0 && (
            <span
              className="draft-bar__warn"
              title={lastSave.skipped
                .map((s) =>
                  t('app.skippedDetail', { component: s.component, page: s.page, from: s.from })
                )
                .join('\n')}
            >
              {' · '}
              {t('app.skippedShared', { count: lastSave.skipped.length })}
            </span>
          )}
        </span>
        {lastSave.historyId && (
          <button className="btn btn--small" onClick={onUndo}>
            {t('app.undoSave')}
          </button>
        )}
        <button
          className="btn btn--small btn--ghost btn--icon"
          onClick={onDismiss}
          aria-label={t('common.dismiss')}
          title={t('common.dismiss')}
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>
    )
  }

  return (
    <div className="draft-bar" ref={ref}>
      <button
        className="draft-bar__summary"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={menuId}
      >
        <span className="dot dot--warn" aria-hidden="true" />
        {t('app.unsavedSummary', { count })}
        <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="draft-menu" id={menuId}>
          {drafts.pages.map((page) => (
            <div key={page.path} className="draft-menu__row">
              <button
                className="link mono"
                onClick={() => {
                  setOpen(false)
                  onOpenPage(page.path)
                }}
              >
                {page.path}
              </button>
              <span className="muted small">
                {[
                  page.own && t('app.editsCount', { count: page.own }),
                  page.inherited && t('app.fromShared', { count: page.inherited }),
                  page.seo && t('app.seoChanges')
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
              {(page.own > 0 || page.seo) && (
                <button
                  className="btn btn--small"
                  onClick={() => onDiscard(page.path)}
                  aria-label={t('app.discardPage', { page: page.path })}
                >
                  {t('common.discard')}
                </button>
              )}
            </div>
          ))}
          {drafts.stale.length > 0 && (
            <p className="muted small">{t('app.staleNote', { pages: drafts.stale.join(', ') })}</p>
          )}
        </div>
      )}
      {confirming ? (
        <span className="draft-bar__confirm" role="group" aria-label={t('app.confirmDiscardAll')}>
          <span className="small">{t('app.confirmDiscardAll')}</span>
          <button
            className="btn btn--small btn--danger"
            autoFocus
            onClick={() => {
              setConfirming(false)
              onDiscard(null)
            }}
          >
            {t('common.discard')}
          </button>
          <button className="btn btn--small" onClick={() => setConfirming(false)}>
            {t('common.cancel')}
          </button>
        </span>
      ) : (
        <button
          className="btn btn--small btn--danger-outline"
          onClick={() => setConfirming(true)}
          disabled={busy}
        >
          {t('app.discardAll')}
        </button>
      )}
      {FEATURES.scheduling && (
        <button
          className="btn btn--small"
          onClick={() => setScheduling(true)}
          disabled={busy}
          title={t('app.scheduleHint')}
          aria-haspopup="dialog"
        >
          {t('app.schedule')}
        </button>
      )}
      <button
        className="btn btn--small btn--primary"
        onClick={onSaveAll}
        disabled={busy}
        title={t('app.saveAllHint', { shortcut: shortcut('S') })}
      >
        {busy ? t('common.saving') : t('app.saveAll')}
      </button>
      {scheduling && (
        <ScheduleModal
          drafts={drafts}
          onScheduled={(release) => {
            setScheduling(false)
            onScheduled(release)
          }}
          onClose={() => setScheduling(false)}
        />
      )}
    </div>
  )
}
