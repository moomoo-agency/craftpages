import { useState } from 'react'
import { Notice } from '../components/Field'
import { translate, useT } from '../i18n'
import { errorMessage } from './api'
import type { SiteChange } from '../../../shared/types'

export type Note = { kind: 'error' | 'success' | 'info'; text: string; undo?: string } | null

/** The note after a change to many pages: what was done, how many pages, what was skipped. */
export function changeNote(change: SiteChange, done: string): Note {
  // Skip reasons come from the main process, in English.
  const skipped = change.skipped.length
    ? translate('search.skipped', {
        list: change.skipped.map((s) => `${s.path} (${s.reason})`).join('; ')
      })
    : ''
  if (!change.pages.length && !change.historyId)
    return {
      kind: change.skipped.length ? 'error' : 'info',
      text: [translate('search.nothingChanged'), skipped].filter(Boolean).join(' ')
    }
  const pages = change.pages.length
    ? translate('search.pagesUpdated', { count: change.pages.length })
    : ''
  return {
    kind: 'success',
    text: [done, pages, skipped].filter(Boolean).join(' '),
    undo: change.historyId ?? undefined
  }
}

/**
 * Notes per section of a page, with a busy flag while a change runs and Undo on the
 * notes of changes that can be undone. `after` runs after every change (and undo).
 */
export function useNotes(after: () => Promise<void> | void): {
  busy: boolean
  note: (section: string, value: Note) => void
  run: (section: string, task: () => Promise<Note>) => Promise<void>
  show: (section: string) => React.ReactNode
} {
  const t = useT()
  const [busy, setBusy] = useState(false)
  const [notes, setNotes] = useState<Record<string, Note>>({})
  const note = (section: string, value: Note): void => setNotes((n) => ({ ...n, [section]: value }))

  const run = async (section: string, task: () => Promise<Note>): Promise<void> => {
    setBusy(true)
    note(section, null)
    try {
      note(section, await task())
      await after()
    } catch (e) {
      note(section, { kind: 'error', text: errorMessage(e) })
    } finally {
      setBusy(false)
    }
  }

  const show = (section: string): React.ReactNode => {
    const current = notes[section]
    return (
      current && (
        <div role={current.kind === 'error' ? 'alert' : 'status'}>
          <Notice kind={current.kind}>
            {current.text}{' '}
            {current.undo && (
              <button
                className="link"
                disabled={busy}
                onClick={() =>
                  run(section, async () => {
                    await window.api.revertHistory(current.undo!)
                    return { kind: 'info', text: t('search.undone') }
                  })
                }
              >
                {t('common.undo')}
              </button>
            )}
          </Notice>
        </div>
      )
    )
  }

  return { busy, note, run, show }
}
