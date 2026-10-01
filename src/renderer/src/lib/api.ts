import { useEffect, useRef, useState } from 'react'
import { intlLocale } from '../i18n'
import type { AppEvent } from '../../../shared/types'

/** IPC errors arrive as "Error invoking remote method 'x': Error: message"; keep the message. */
export function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message.replace(/^Error invoking remote method '[^']+': (\w*Error: )?/, '')
}

/** Subscribes to main-process events for the lifetime of the component. */
export function useAppEvent(listener: (event: AppEvent) => void): void {
  const ref = useRef(listener)
  useEffect(() => {
    ref.current = listener
  })
  useEffect(() => window.api.onEvent((event) => ref.current(event)), [])
}

/** Sizes and dates follow the app language (see i18n). */
export function formatBytes(bytes: number): string {
  const number = (value: number): string =>
    value.toLocaleString(intlLocale(), { maximumFractionDigits: 1, minimumFractionDigits: 1 })
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${number(bytes / 1024)} KB`
  return `${number(bytes / 1024 / 1024)} MB`
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(intlLocale(), { dateStyle: 'medium', timeStyle: 'short' })
}

export function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString(intlLocale(), { dateStyle: 'medium' })
}

/** "3 min ago", "yesterday"…; older than a month shows the date. */
export function formatAgo(iso: string): string {
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000
  const rtf = new Intl.RelativeTimeFormat(intlLocale(), { numeric: 'auto' })
  const abs = Math.abs(seconds)
  if (abs < 60) return rtf.format(0, 'second')
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), 'hour')
  if (abs < 30 * 86400) return rtf.format(Math.round(seconds / 86400), 'day')
  return formatDay(iso)
}

/** An ISO time as the value of a `datetime-local` input (local time, minutes). */
export function toLocalInput(iso: string): string {
  const date = new Date(iso)
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

export const isMac = navigator.userAgent.includes('Mac')

/** A keyboard shortcut as the OS writes it: ⌘S on macOS, Ctrl+S elsewhere. */
export const shortcut = (key: string): string => (isMac ? `⌘${key}` : `Ctrl+${key}`)

export async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text)
}

/** State remembered in localStorage (UI preferences only; falls back to the default). */
export function useStoredState<T extends string>(
  key: string,
  fallback: T
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      return (localStorage.getItem(`craftpages.${key}`) as T | null) ?? fallback
    } catch {
      return fallback
    }
  })
  const set = (next: T): void => {
    setValue(next)
    try {
      localStorage.setItem(`craftpages.${key}`, next)
    } catch {
      // Not persisted; still applied for this session.
    }
  }
  return [value, set]
}
