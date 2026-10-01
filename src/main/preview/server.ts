import { createServer, type IncomingMessage, type ServerResponse } from 'http'
import { readFile, stat } from 'fs/promises'
import type { AddressInfo } from 'net'
import { extname } from 'path'
import { resolveInWorkspace } from '../workspace'
import editorClient from './editor-client.js?raw'
import pointerClient from './pointer-client.js?raw'

export const EDITOR_SCRIPT_PATH = '/__cms/editor.js'
export const POINTER_SCRIPT_PATH = '/__cms/pointer.js'

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.pdf': 'application/pdf'
}

export function contentType(path: string): string {
  return TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream'
}

export interface StaticServerOptions {
  getRoot: () => string | null
  /** Files to serve instead of what's on disk (`null` = deleted). Used to preview AI proposals. */
  overlay?: Map<string, string | null>
  /** Instrumented pages for the editor, by session key (`?__cms=<key>`). */
  getEditCopy?: (key: string) => string | undefined
  /** Replaces an HTML page's contents when it returns a string (e.g. unsaved drafts applied). */
  transformHtml?: (path: string) => Promise<string | null>
}

export interface StaticServer {
  port: number
  origin: string
  close: () => Promise<void>
}

/**
 * A static file server on 127.0.0.1 for the site folder. It answers only
 * requests addressed to its own host (blocks DNS rebinding) and never serves
 * files outside the workspace or from `.sitecms`.
 */
export async function startStaticServer(options: StaticServerOptions): Promise<StaticServer> {
  let origin = ''

  const read = async (root: string, path: string): Promise<Buffer | string | null> => {
    if (options.overlay?.has(path)) return options.overlay.get(path) ?? null
    try {
      const full = resolveInWorkspace(root, path)
      if (!(await stat(full)).isFile()) return null
      return await readFile(full)
    } catch {
      return null
    }
  }

  /** Clean URLs like Cloudflare Pages: `/about` → `about.html` or `about/index.html`. */
  const locate = async (
    root: string,
    pathname: string
  ): Promise<[string, Buffer | string] | null> => {
    const base = pathname.replace(/^\/+/, '')
    const tries =
      base === '' || base.endsWith('/')
        ? [`${base}index.html`]
        : [base, `${base}.html`, `${base}/index.html`]
    for (const path of tries) {
      const body = await read(root, path)
      if (body !== null) return [path, body]
    }
    return null
  }

  const handle = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const host = req.headers.host ?? ''
    if (host !== new URL(origin).host && host !== `localhost:${new URL(origin).port}`) {
      res.writeHead(403).end('Forbidden')
      return
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405).end()
      return
    }
    const url = new URL(req.url ?? '/', origin)
    const headers: Record<string, string> = { 'Cache-Control': 'no-store' }

    if (url.pathname === POINTER_SCRIPT_PATH) {
      res.writeHead(200, { ...headers, 'Content-Type': TYPES['.js'] }).end(pointerClient)
      return
    }
    if (url.pathname === EDITOR_SCRIPT_PATH) {
      res.writeHead(200, { ...headers, 'Content-Type': TYPES['.js'] }).end(editorClient)
      return
    }

    const root = options.getRoot()
    if (!root) {
      res.writeHead(404).end('No site open')
      return
    }

    let pathname: string
    try {
      pathname = decodeURIComponent(url.pathname)
    } catch {
      res.writeHead(400).end()
      return
    }

    const key = url.searchParams.get('__cms')
    const editCopy = key ? options.getEditCopy?.(key) : undefined
    if (editCopy !== undefined) {
      res
        .writeHead(200, {
          ...headers,
          'Content-Type': TYPES['.html'],
          // Only the app's own scripts (/__cms/) may run; the page's scripts were stripped.
          'Content-Security-Policy': `script-src ${origin}/__cms/; object-src 'none'`
        })
        .end(editCopy)
      return
    }

    const found = await locate(root, pathname)
    if (!found) {
      const notFound = await read(root, '404.html')
      res
        .writeHead(404, { ...headers, 'Content-Type': TYPES['.html'] })
        .end(notFound ?? 'Not found')
      return
    }
    const [path, raw] = found
    const transformed = path.endsWith('.html') ? await options.transformHtml?.(path) : null
    const body = transformed ?? raw
    if (path === `${pathname.replace(/^\/+/, '')}/index.html`) {
      // Directory without a trailing slash: redirect so relative URLs resolve.
      res.writeHead(301, { ...headers, Location: `${pathname}/${url.search}` }).end()
      return
    }
    // The editor iframe is sandboxed (opaque origin), and fonts are fetched with CORS.
    if (contentType(path).startsWith('font/')) headers['Access-Control-Allow-Origin'] = '*'
    res.writeHead(200, { ...headers, 'Content-Type': contentType(path) })
    res.end(req.method === 'HEAD' ? undefined : body)
  }

  const server = createServer((req, res) => {
    handle(req, res).catch((error) => {
      if (!res.headersSent) res.writeHead(500)
      res.end(String(error))
    })
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve())
  })
  const port = (server.address() as AddressInfo).port
  origin = `http://127.0.0.1:${port}`

  return {
    port,
    origin,
    close: () => new Promise((resolve) => server.close(() => resolve()))
  }
}
