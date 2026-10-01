import { BrowserWindow, session, type Session } from 'electron'

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost'])
/** Request types that could run code or report to the live site's analytics / payments. */
const BLOCKED_TYPES = new Set([
  'script',
  'xhr',
  'ping',
  'webSocket',
  'cspReport',
  'media',
  'object'
])

/**
 * Previews run the site's own pages, whose scripts may send analytics beacons
 * or load payment widgets from the live site. Remote requests of those kinds are
 * cancelled; remote stylesheets, fonts and images still load so the page looks right.
 * `allow` lets the user opt in (Interact mode) to test e.g. a checkout button.
 */
export function blockRemoteScripts(target: Session, allow: () => boolean = () => false): void {
  target.webRequest.onBeforeRequest((details, callback) => {
    let host = ''
    try {
      host = new URL(details.url).hostname
    } catch {
      // data:, blob: and similar have no host and are local anyway.
    }
    const remote = /^(https?|wss?):/.test(details.url) && !LOCAL_HOSTS.has(host)
    callback({ cancel: remote && BLOCKED_TYPES.has(details.resourceType) && !allow() })
  })
}

const CAPTURE_PARTITION = 'capture'
let prepared = false

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/** Renders a URL offscreen and returns a JPEG. Height is capped for full-page shots. */
export async function capture(
  url: string,
  width: number,
  height: number,
  fullPage: boolean
): Promise<Buffer> {
  if (!prepared) {
    blockRemoteScripts(session.fromPartition(CAPTURE_PARTITION))
    prepared = true
  }
  const window = new BrowserWindow({
    show: false,
    width,
    height,
    useContentSize: true,
    webPreferences: {
      offscreen: true,
      partition: CAPTURE_PARTITION,
      contextIsolation: true,
      sandbox: true,
      javascript: true
    }
  })
  try {
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    await window.loadURL(url)
    await window.webContents.executeJavaScript(
      'document.fonts ? document.fonts.ready.then(() => true) : true'
    )
    await wait(400)
    if (fullPage) {
      const full = Number(
        await window.webContents.executeJavaScript(
          'Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0)'
        )
      )
      const target = Math.min(Math.max(height, full), 8000)
      if (target !== height) {
        window.setContentSize(width, target)
        await wait(400)
      }
    }
    let image = await window.webContents.capturePage()
    // Retina screens capture at 2×; AI clients want CSS pixels (and smaller payloads).
    if (image.getSize().width > width) image = image.resize({ width, quality: 'good' })
    return image.toJPEG(82)
  } finally {
    window.destroy()
  }
}
