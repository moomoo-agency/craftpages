import type { Selection } from '../../shared/types'

let current: Selection | null = null
const listeners = new Set<(selection: Selection | null) => void>()

export function getSelection(): Selection | null {
  return current
}

export function setSelection(selection: Selection | null): void {
  current = selection
  listeners.forEach((listener) => listener(selection))
}

export function onSelection(listener: (selection: Selection | null) => void): void {
  listeners.add(listener)
}
