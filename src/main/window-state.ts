import { app, screen, type BrowserWindow, type Rectangle } from 'electron'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

// The main window's size and place, remembered between launches in its own small file
// (read synchronously, so the window opens at the right size without a flash).

const DEFAULT_WIDTH = 1430
const DEFAULT_HEIGHT = 860
export const MIN_WIDTH = 900
export const MIN_HEIGHT = 600

type WindowState = Rectangle & { maximized?: boolean }

const stateFile = (): string => join(app.getPath('userData'), 'window-state.json')

function readState(): WindowState | null {
  try {
    const state = JSON.parse(readFileSync(stateFile(), 'utf8')) as WindowState
    const numbers = [state.x, state.y, state.width, state.height]
    return numbers.every((n) => Number.isFinite(n)) ? state : null
  } catch {
    return null
  }
}

/** Whether enough of the rectangle is on some current display to grab it. */
function visible(bounds: Rectangle): boolean {
  return screen.getAllDisplays().some(({ workArea: a }) => {
    const overlapX = Math.min(bounds.x + bounds.width, a.x + a.width) - Math.max(bounds.x, a.x)
    const overlapY = Math.min(bounds.y + bounds.height, a.y + a.height) - Math.max(bounds.y, a.y)
    return overlapX >= 100 && overlapY >= 50
  })
}

/**
 * Where to open the window: the saved place when it still fits a connected display,
 * otherwise the default size, capped to the screen under the cursor and centred on it.
 */
export function initialBounds(): Partial<Rectangle> & { maximized: boolean } {
  const saved = readState()
  if (saved && visible(saved)) {
    const { workArea } = screen.getDisplayMatching(saved)
    return {
      x: saved.x,
      y: saved.y,
      width: Math.max(MIN_WIDTH, Math.min(saved.width, workArea.width)),
      height: Math.max(MIN_HEIGHT, Math.min(saved.height, workArea.height)),
      maximized: saved.maximized === true
    }
  }
  const { workArea } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  const width = Math.min(DEFAULT_WIDTH, workArea.width)
  const height = Math.min(DEFAULT_HEIGHT, workArea.height)
  return {
    x: workArea.x + Math.round((workArea.width - width) / 2),
    y: workArea.y + Math.round((workArea.height - height) / 2),
    width,
    height,
    maximized: false
  }
}

/** Saves the window's place whenever it stops moving or resizing, and on close. */
export function trackWindowState(window: BrowserWindow): void {
  let timer: NodeJS.Timeout | undefined
  const save = (): void => {
    clearTimeout(timer)
    if (window.isDestroyed() || window.isMinimized() || window.isFullScreen()) return
    const state: WindowState = { ...window.getNormalBounds(), maximized: window.isMaximized() }
    try {
      writeFileSync(stateFile(), JSON.stringify(state))
    } catch {
      // Not worth bothering anyone about: the next launch just opens at the default size.
    }
  }
  const later = (): void => {
    clearTimeout(timer)
    timer = setTimeout(save, 500)
  }
  window.on('resize', later)
  window.on('move', later)
  window.on('maximize', save)
  window.on('unmaximize', save)
  window.on('close', save)
}
