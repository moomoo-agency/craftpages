import { useEffect, useId, useRef, useState } from 'react'
import ScheduleModal from './ScheduleModal'
import { FEATURES } from '../../../shared/features'
import { useT } from '../i18n'
import { shortcut } from '../lib/api'
import { addressOfFile } from '../../../shared/blog-urls'
import type { DraftState, PageRelease, SaveResult } from '../../../shared/types'

/** Saved changes waiting for Publish: all files, and how many of them are pages. */
export interface PendingPublish {
  files: number
  pages: number
}

interface Props {
  drafts: DraftState
  /** The page open in the editor: its own edits are counted first ("3 here"). */
  currentPage?: string
  /** Saved changes not on the live site yet; null when unknown or publishing isn't set up. */
  pendingPublish: PendingPublish | null
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
  currentPage,
  pendingPublish,
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
  const [showSkipped, setShowSkipped] = useState(false)
  /** A page whose edits wait for a yes before being thrown away. */
  const [confirmingPage, setConfirmingPage] = useState<string | null>(null)
  const menuId = useId()
  const skippedId = useId()
  const ref = useRef<HTMLDivElement>(null)
  const summary = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const count = drafts.pages.length
  const savedText = !lastSave?.pages.length
    ? t('app.nothingToSave')
    : t(lastSave.code ? 'app.savedFiles' : 'app.savedPages', { count: lastSave.pages.length })
  const here = drafts.pages.find((page) => page.path === currentPage)
  const hereCount = here ? here.own + here.inherited + (here.seo ? 1 : 0) : 0

  // The page list takes focus when it opens; it closes on Escape (focus goes back to the
  // summary) and on a click anywhere else.
  useEffect(() => {
    if (!open) return
    menu.current?.querySelector<HTMLButtonElement>('button')?.focus()
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      setOpen(false)
      summary.current?.focus()
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

  /** Up / Down move between the list's buttons. */
  const onMenuKey = (event: React.KeyboardEvent): void => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const buttons = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
    const next = (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length
    buttons[next]?.focus()
  }

  if (count === 0) {
    // At rest: say where things stand, quietly.
    if (!lastSave) {
      if (pendingPublish === null) return null
      return (
        <div className="draft-bar draft-bar--idle" role="status">
          {/* Saved, waiting for Publish: neutral, since nothing is wrong. Publish site in the
              sidebar is the one call to action. */}
          {pendingPublish.files > 0 ? (
            <>
              <span className="dot dot--accent" aria-hidden="true" />
              <span>
                {pendingPublish.pages > 0
                  ? t('app.pagesReady', { count: pendingPublish.pages })
                  : t('app.readyToPublish')}
              </span>
            </>
          ) : (
            <>
              <span className="dot dot--on" aria-hidden="true" />
              <span>{t('app.allLive')}</span>
            </>
          )}
        </div>
      )
    }
    return (
      <div className="draft-bar" role="status" ref={ref}>
        <span className="draft-bar__done" title={savedText}>
          {savedText}
          {lastSave.skipped.length > 0 && (
            <>
              {' · '}
              <button
                className="link draft-bar__warn"
                aria-expanded={showSkipped}
                aria-controls={skippedId}
                onClick={() => setShowSkipped((v) => !v)}
              >
                {t('app.skippedShared', { count: lastSave.skipped.length })}
              </button>
            </>
          )}
        </span>
        {showSkipped && lastSave.skipped.length > 0 && (
          <div className="draft-menu" id={skippedId}>
            <p className="small">{t('app.skippedExplain')}</p>
            <ul className="draft-menu__list">
              {lastSave.skipped.map((s) => (
                <li key={`${s.page}:${s.component}`}>
                  <button
                    className="link"
                    onClick={() => {
                      setShowSkipped(false)
                      onOpenPage(s.page)
                    }}
                  >
                    {t('app.skippedDetail', { component: s.component, page: s.page, from: s.from })}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {lastSave.historyId && (
          <button className="btn btn--small btn--ghost" onClick={onUndo}>
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
        ref={summary}
        className="draft-bar__summary"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={menuId}
      >
        <span className="dot dot--warn" aria-hidden="true" />
        <span className="draft-bar__long">
          {here
            ? `${t('app.changesHere', { count: hereCount })} · ${t('app.pagesUnsaved', { count })}`
            : t('app.unsavedSummary', { count })}
        </span>
        {/* Narrow windows: just the number, so Save all always stays on screen. */}
        <span className="draft-bar__short" aria-hidden="true">
          {t('app.unsavedShort', { count: here ? hereCount : count })}
        </span>
        <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="draft-menu" id={menuId} ref={menu} onKeyDown={onMenuKey}>
          {drafts.pages.map((page) => (
            <div key={page.path} className="draft-menu__row">
              <button
                className="link"
                title={page.path}
                onClick={() => {
                  setOpen(false)
                  onOpenPage(page.path)
                }}
              >
                {addressOfFile(page.path)}
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
              {(page.own > 0 || page.seo) &&
                (confirmingPage === page.path ? (
                  <span
                    className="draft-bar__confirm draft-menu__confirm"
                    role="group"
                    aria-label={t('app.confirmDiscardPage', { page: addressOfFile(page.path) })}
                  >
                    <span className="small">
                      {t('app.confirmDiscardPage', { page: addressOfFile(page.path) })}
                    </span>
                    <button
                      className="btn btn--small"
                      autoFocus
                      onClick={() => setConfirmingPage(null)}
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      className="btn btn--small btn--danger"
                      onClick={() => {
                        setConfirmingPage(null)
                        onDiscard(page.path)
                      }}
                    >
                      {t('common.discard')}
                    </button>
                  </span>
                ) : (
                  <button
                    className="btn btn--small"
                    onClick={() => setConfirmingPage(page.path)}
                    aria-label={t('app.discardPage', { page: addressOfFile(page.path) })}
                  >
                    {t('common.discard')}
                  </button>
                ))}
            </div>
          ))}
          {drafts.stale.length > 0 && (
            <p className="muted small">{t('app.staleNote', { pages: drafts.stale.join(', ') })}</p>
          )}
          <div className="draft-menu__foot">
            <button
              className="btn btn--small btn--danger-outline"
              disabled={busy}
              onClick={() => {
                setOpen(false)
                setConfirming(true)
              }}
            >
              {t('app.discardAllAction')}
            </button>
          </div>
        </div>
      )}
      {confirming && (
        <span className="draft-bar__confirm" role="group" aria-label={t('app.confirmDiscardAll')}>
          <span className="small">{t('app.confirmDiscardAll')}</span>
          <button className="btn btn--small" autoFocus onClick={() => setConfirming(false)}>
            {t('common.cancel')}
          </button>
          <button
            className="btn btn--small btn--danger"
            onClick={() => {
              setConfirming(false)
              onDiscard(null)
            }}
          >
            {t('common.discard')}
          </button>
        </span>
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
