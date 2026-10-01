import { app, BrowserWindow, dialog, Menu, nativeImage, powerMonitor, Tray } from 'electron'
import sharp from 'sharp'
import { getAppSettings } from './settings'
import { onUpcomingChange, pendingCount, upcoming, type Upcoming } from './scheduler'

/**
 * Keeps the app running while something is scheduled: closing the window
 * leaves a menu bar (tray) icon, quitting asks first, and it can start hidden
 * at login so a restart doesn't miss a release.
 */

const BACKGROUND_ARG = '--background'

let keepRunning = true
let tray: Tray | null = null
let trayImage: Promise<Electron.NativeImage> | null = null
let quitConfirmed = false
let shuttingDown = false
let showWindow: () => void = () => {}

/** Launched by the login item: start with no window, just the tray. */
export const startedHidden = (): boolean =>
  process.argv.includes(BACKGROUND_ARG) ||
  (process.platform === 'darwin' && app.getLoginItemSettings().wasOpenedAtLogin)

const windowless = (): boolean => BrowserWindow.getAllWindows().length === 0

// A clock, drawn as a template image so macOS tints it for light and dark menu bars.
const CLOCK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.25" fill="none" stroke="#000" stroke-width="1.5"/><path d="M8 4.6V8l2.4 1.5" fill="none" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`

async function makeTrayImage(appIcon: string): Promise<Electron.NativeImage> {
  if (process.platform !== 'darwin') {
    // Taskbars can be light or dark; the app icon reads on both.
    return nativeImage.createFromPath(appIcon).resize({ width: 16, height: 16 })
  }
  const render = (size: number): Promise<Buffer> =>
    sharp(Buffer.from(CLOCK_SVG), { density: 72 * (size / 16) })
      .resize(size, size)
      .png()
      .toBuffer()
  const image = nativeImage.createFromBuffer(await render(16), { scaleFactor: 1 })
  image.addRepresentation({ scaleFactor: 2, buffer: await render(32) })
  image.setTemplateImage(true)
  return image
}

const when = (at: number): string => {
  const date = new Date(at)
  const today = new Date().toDateString() === date.toDateString()
  return date.toLocaleString(app.getLocale(), {
    ...(today ? {} : { weekday: 'short', day: 'numeric', month: 'short' }),
    hour: '2-digit',
    minute: '2-digit'
  })
}

const describe = (item: Upcoming, withProject: boolean): string => {
  const what =
    item.kind === 'end'
      ? `${item.label} ends`
      : item.kind === 'post'
        ? `Post: ${item.label}`
        : item.label
  const time = item.at <= Date.now() ? 'now' : when(item.at)
  return `${time} · ${what}${withProject ? ` (${item.project})` : ''}`
}

let updating = Promise.resolve()

/** Shows, updates or removes the tray icon. */
export function updateTray(appIcon: string): Promise<void> {
  updating = updating.then(async () => {
    const pending = pendingCount()
    const want = keepRunning && (pending > 0 || (windowless() && startedHidden()))
    if (!want) {
      tray?.destroy()
      tray = null
      return
    }
    if (!tray) {
      trayImage ??= makeTrayImage(appIcon)
      tray = new Tray(await trayImage)
      // Windows and Linux: a click opens the app; the menu is on right-click.
      if (process.platform !== 'darwin') tray.on('click', () => showWindow())
    }
    const items = upcoming().filter((item) => item.kind !== 'deploy')
    const projects = new Set(items.map((item) => item.root))
    const next = items[0]
    tray.setToolTip(next ? `CraftPages · next: ${describe(next, projects.size > 1)}` : 'CraftPages')
    tray.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: pending ? `Scheduled (${pending})` : 'Nothing scheduled',
          enabled: false
        },
        ...items.slice(0, 8).map((item) => ({
          label: describe(item, projects.size > 1),
          click: () => showWindow()
        })),
        ...(items.length > 8 ? [{ label: `and ${items.length - 8} more`, enabled: false }] : []),
        { type: 'separator' as const },
        { label: 'Open CraftPages', click: () => showWindow() },
        { label: 'Quit CraftPages', click: () => app.quit() }
      ])
    )
  })
  return updating.catch(() => {})
}

/** Applies the Settings → Background options (tray, login item). */
export async function applyBackgroundSettings(appIcon: string): Promise<void> {
  const { background } = await getAppSettings()
  keepRunning = background.keepRunning
  // A login item in development would point at the bare Electron binary.
  if (app.isPackaged) {
    app.setLoginItemSettings({
      openAtLogin: background.openAtLogin,
      openAsHidden: true,
      args: [BACKGROUND_ARG]
    })
  }
  await updateTray(appIcon)
}

export function setupBackground(appIcon: string, show: () => void): void {
  showWindow = () => {
    if (process.platform === 'darwin') app.dock?.show()
    show()
  }
  onUpcomingChange(() => void updateTray(appIcon))
  powerMonitor.on('shutdown', () => {
    shuttingDown = true
  })

  app.on('window-all-closed', () => {
    if (keepRunning && pendingCount() > 0) {
      // Menu bar only, so it's clear the app is still there and why.
      if (process.platform === 'darwin') app.dock?.hide()
      void updateTray(appIcon)
      return
    }
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('before-quit', (event) => {
    const pending = pendingCount()
    if (quitConfirmed || shuttingDown || pending === 0) return
    event.preventDefault()
    const next = upcoming().find((item) => item.kind !== 'deploy')
    const buttons = keepRunning
      ? ['Keep running in the background', 'Quit anyway', 'Cancel']
      : ['Quit anyway', 'Cancel']
    app.focus({ steal: true })
    void dialog
      .showMessageBox({
        type: 'warning',
        message: `${pending} scheduled ${pending === 1 ? 'item' : 'items'} won't go out while CraftPages is closed.`,
        detail: [
          next && `Next: ${describe(next, true)}.`,
          'Anything that comes due while the app is closed goes out the next time it starts.'
        ]
          .filter(Boolean)
          .join('\n'),
        buttons,
        defaultId: 0,
        cancelId: buttons.length - 1
      })
      .then(({ response }) => {
        const choice = buttons[response]
        if (choice === 'Quit anyway') {
          quitConfirmed = true
          app.quit()
        } else if (choice === 'Keep running in the background') {
          for (const window of BrowserWindow.getAllWindows()) window.close()
        }
      })
  })
}
