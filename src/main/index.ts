import { app, shell, BrowserWindow, nativeTheme, session } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { allowExternalScripts, applyMcpSettings, openWorkspace, registerIpc } from './ipc'
import { applyBackgroundSettings, setupBackground, startedHidden } from './background'
import { setShowApp, startScheduler } from './scheduler'
import { stopMcp } from './mcp/server'
import { flushDraftsSync } from './drafts'
import { blockRemoteScripts } from './preview/capture'
import { getAppSettings } from './settings'
import { setupUpdates } from './updates'
import { log, startLog } from './log'

// Development keeps its own settings folder ("CraftPages Dev"), so `npm run dev` and an
// installed CraftPages can run side by side without sharing settings, tokens or recent
// projects. Test runs can point it elsewhere with --cp-user-data=<folder>.
const testProfile = process.argv.find((arg) => arg.startsWith('--cp-user-data='))
if (is.dev)
  app.setPath(
    'userData',
    testProfile
      ? testProfile.slice('--cp-user-data='.length)
      : join(app.getPath('appData'), `${app.getName()} Dev`)
  )

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#16171a' : '#ffffff',
    // macOS takes the dock icon from the app (below); Windows and Linux from the window.
    ...(process.platform !== 'darwin' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (/^https?:\/\//.test(details.url)) shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // The app UI never navigates away; links inside preview iframes don't count (they're subframes).
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== mainWindow.webContents.getURL()) event.preventDefault()
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
  return mainWindow
}

/** Brings the app to the front, opening the window again if it was closed (tray mode). */
function showApp(): void {
  const [window] = BrowserWindow.getAllWindows()
  if (!window) {
    createWindow()
    return
  }
  if (window.isMinimized()) window.restore()
  window.show()
  window.focus()
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('app.craftpages')
  // A packaged build has it from icon.icns; in development the dock would show Electron's.
  if (process.platform === 'darwin') app.dock?.setIcon(icon)

  // F12 opens DevTools in development; Cmd/Ctrl+R is ignored in production.
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Preview iframes run the site's CSS and images, but never remote scripts or beacons.
  blockRemoteScripts(session.defaultSession, allowExternalScripts)

  startLog()
  registerIpc(icon)
  setupUpdates()
  setupBackground(icon, showApp)
  setShowApp(showApp)
  // Started at login: stay in the menu bar until the user opens the app.
  if (!startedHidden()) createWindow()

  getAppSettings()
    .then(async (settings) => {
      if (settings.lastWorkspace)
        await openWorkspace(settings.lastWorkspace).catch((error) =>
          log.warn('app', 'Could not reopen the last project', error)
        )
      await applyMcpSettings()
      startScheduler()
      await applyBackgroundSettings(icon)
    })
    .catch((error) => {
      console.error('Startup failed', error)
      log.error('app', 'Startup failed', error)
    })

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) showApp()
  })
})

// After the quit was confirmed (see background.ts: it asks while something is scheduled).
app.on('will-quit', () => {
  flushDraftsSync()
  stopMcp().catch(() => {})
})
