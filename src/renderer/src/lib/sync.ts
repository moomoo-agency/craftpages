import { useEffect, useState } from 'react'
import { useAppEvent } from './api'
import type { SyncStatus, Workspace } from '../../../shared/types'

/** The open project's sync state, kept current by the app's 'sync' events. */
export function useSyncStatus(workspace: Workspace | null): SyncStatus | null {
  const [status, setStatus] = useState<SyncStatus | null>(null)
  const root = workspace?.root ?? null
  // Every workspace update (a save, an edit on disk) may leave changes to sync.
  useEffect(() => {
    if (!workspace) return
    let current = true
    window.api.getSyncStatus().then(
      (next) => current && setStatus(next),
      () => current && setStatus(null)
    )
    return () => {
      current = false
    }
  }, [workspace])
  useAppEvent((event) => {
    if (event.type === 'sync') setStatus(event.status)
  })
  // Files edited outside the app don't always announce themselves: look again now and then,
  // and whenever the window comes back to the front.
  const on = Boolean(root && status && status.mode !== 'off')
  useEffect(() => {
    if (!on) return
    const refresh = (): void => {
      window.api.getSyncStatus().then(setStatus, () => null)
    }
    const timer = setInterval(refresh, 15_000)
    window.addEventListener('focus', refresh)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', refresh)
    }
  }, [on])
  return root ? status : null
}

/** "Laptop" or "Laptop and MacBook" for the people with the project open elsewhere. */
export function namesOf(people: { device: string }[]): string {
  const names = [...new Set(people.map((person) => person.device))]
  return names.length <= 2
    ? names.join(' & ')
    : `${names.slice(0, 2).join(', ')} +${names.length - 2}`
}
