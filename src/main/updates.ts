import { app } from 'electron'
import { autoUpdater } from 'electron-updater'
import { broadcast } from './state'
import type { UpdateState } from '../shared/types'

/**
 * New versions come from the GitHub releases of moomoo-agency/craftpages (electron-updater
 * reads the latest*.yml files the release workflow attaches).
 *
 * macOS, Windows and the Linux AppImage download the update in the background and install it
 * on restart (on macOS from the .zip, which works because the app is signed since 1.1.2). For
 * the .deb the app only says a version is out and links to its release page.
 */
export const RELEASES_URL = 'https://github.com/moomoo-agency/craftpages/releases'

const CHECK_EVERY_MS = 6 * 60 * 60 * 1000
const FIRST_CHECK_MS = 15 * 1000

const selfInstalls =
  process.platform === 'darwin' ||
  process.platform === 'win32' ||
  (process.platform === 'linux' && !!process.env.APPIMAGE)

let state: UpdateState = {
  current: app.getVersion(),
  status: app.isPackaged ? 'idle' : 'unsupported',
  installs: selfInstalls
}

function set(patch: Partial<UpdateState>): void {
  state = { ...state, ...patch }
  broadcast({ type: 'update', update: state })
}

export const updateState = (): UpdateState => state

export function setupUpdates(): void {
  if (!app.isPackaged) {
    // Development: CP_FAKE_UPDATE=available|downloading|ready npm run dev shows the update UI.
    const fake = process.env.CP_FAKE_UPDATE as UpdateState['status'] | undefined
    if (fake)
      state = {
        ...state,
        status: fake,
        version: '9.9.9',
        url: `${RELEASES_URL}/latest`,
        percent: 42,
        installs: fake !== 'available'
      }
    return
  }
  autoUpdater.autoDownload = selfInstalls
  autoUpdater.autoInstallOnAppQuit = selfInstalls
  autoUpdater.logger = null

  autoUpdater.on('checking-for-update', () => {
    // A found update stays on screen while checking again.
    if (state.status !== 'available' && state.status !== 'downloading' && state.status !== 'ready')
      set({ status: 'checking', error: undefined })
  })
  autoUpdater.on('update-not-available', () =>
    set({ status: 'current', checkedAt: new Date().toISOString(), error: undefined })
  )
  autoUpdater.on('update-available', (info) => {
    if (state.status === 'ready' && state.version === info.version) return
    set({
      status: state.installs ? 'downloading' : 'available',
      version: info.version,
      url: `${RELEASES_URL}/tag/v${info.version}`,
      percent: 0,
      checkedAt: new Date().toISOString(),
      error: undefined
    })
  })
  autoUpdater.on('download-progress', (progress) =>
    set({ status: 'downloading', percent: Math.round(progress.percent) })
  )
  autoUpdater.on('update-downloaded', (info) => set({ status: 'ready', version: info.version }))
  autoUpdater.on('error', (error) => {
    // A download that failed falls back to "download it yourself"; a failed check (offline,
    // GitHub down) is only reported in Settings.
    if (state.version) set({ status: 'available', installs: false })
    else set({ status: 'error', error: error.message.split('\n')[0] })
  })

  setTimeout(() => void checkForUpdate(), FIRST_CHECK_MS)
  setInterval(() => void checkForUpdate(), CHECK_EVERY_MS)
}

export async function checkForUpdate(): Promise<UpdateState> {
  if (!app.isPackaged || state.status === 'downloading' || state.status === 'ready') return state
  await autoUpdater.checkForUpdates().catch(() => null)
  return state
}

/** Restarts into the downloaded version (macOS, Windows, AppImage). */
export function installUpdate(): void {
  if (state.status === 'ready') autoUpdater.quitAndInstall()
}
