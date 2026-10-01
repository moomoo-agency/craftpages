import { useEffect, useState } from 'react'
import type { ThemeSource } from '../../../shared/types'

const STORAGE_KEY = 'craftpages.theme'

function readStored(): ThemeSource {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    if (value === 'light' || value === 'dark' || value === 'system') return value
  } catch {
    // Storage unavailable: fall back to the OS setting.
  }
  return 'system'
}

/**
 * Light / dark / system for the app's own UI only, via `data-theme` on <html>.
 * It is deliberately not mirrored to Electron's nativeTheme: that would also flip
 * `prefers-color-scheme` inside the site previews, which follow the OS instead.
 */
export function useTheme(): [ThemeSource, (source: ThemeSource) => void] {
  const [source, setSource] = useState<ThemeSource>(readStored)

  useEffect(() => {
    const root = document.documentElement
    if (source === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', source)
    try {
      localStorage.setItem(STORAGE_KEY, source)
    } catch {
      // Not persisted; still applied for this session.
    }
  }, [source])

  return [source, setSource]
}
