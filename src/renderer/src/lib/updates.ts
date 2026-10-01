import { useEffect, useState } from 'react'
import { useAppEvent } from './api'
import type { UpdateState } from '../../../shared/types'

/** The app's update state, kept current by the main process (see src/main/updates.ts). */
export function useUpdate(): UpdateState | null {
  const [update, setUpdate] = useState<UpdateState | null>(null)
  useEffect(() => {
    window.api.getUpdate().then(setUpdate)
  }, [])
  useAppEvent((event) => {
    if (event.type === 'update') setUpdate(event.update)
  })
  return update
}
