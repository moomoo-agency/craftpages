import { readdir, readFile, stat } from 'fs/promises'
import { basename, join, relative, resolve, sep } from 'path'
import { parse } from 'parse5'
import { getSiteSettings } from './settings'
import type { PageEntry, Workspace } from '../shared/types'

// Folders that are never part of the site: app data, tooling, VCS.
export const SKIP_DIRS = new Set(['.sitecms', 'node_modules', '.git', '.idea', '.vscode'])

export interface FileEntry {
  /** Relative to the workspace root, forward slashes. */
  path: string
  bytes: number
}

/** Every site file (not app data or tooling), sorted by path. */
export async function listFiles(root: string, dir = ''): Promise<FileEntry[]> {
  const entries = await readdir(join(root, dir), { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(async (entry): Promise<FileEntry[]> => {
      const path = dir ? `${dir}/${entry.name}` : entry.name
      if (entry.isDirectory()) return SKIP_DIRS.has(entry.name) ? [] : listFiles(root, path)
      if (!entry.isFile() || entry.name === '.DS_Store') return []
      return [{ path, bytes: (await stat(join(root, path))).size }]
    })
  )
  return nested.flat().sort((a, b) => a.path.localeCompare(b.path))
}

/**
 * Resolves a workspace-relative path to an absolute one, refusing anything that
 * escapes the root or points into app data / tooling folders.
 */
export function resolveInWorkspace(root: string, path: string): string {
  const clean = path.replace(/\\/g, '/').replace(/^\/+/, '')
  const full = resolve(root, clean)
  if (full !== root && !full.startsWith(root + sep)) {
    throw new Error(`Path is outside the site folder: ${path}`)
  }
  const first = relative(root, full).split(sep)[0]
  if (SKIP_DIRS.has(first)) throw new Error(`Path is not part of the site: ${path}`)
  return full
}

/** Post drafts are app data but go through history like site files (one undo for a publish). */
export const DRAFTS_DIR = '.sitecms/drafts'

/** Like resolveInWorkspace, but also allows the post drafts folder. */
export function resolveWritable(root: string, path: string): string {
  const clean = path.replace(/\\/g, '/').replace(/^\/+/, '')
  if (
    clean.startsWith(DRAFTS_DIR + '/') &&
    /^[\w./-]+\.html$/.test(clean) &&
    !clean.includes('..')
  ) {
    return resolve(root, clean)
  }
  return resolveInWorkspace(root, path)
}

export function toRelative(root: string, file: string): string {
  return relative(root, file).split(sep).join('/')
}

type Node = { nodeName: string; childNodes?: Node[]; value?: string }

function findTitle(node: Node): string | null {
  if (node.nodeName === 'title') {
    return (node.childNodes ?? [])
      .map((child) => child.value ?? '')
      .join('')
      .trim()
  }
  for (const child of node.childNodes ?? []) {
    const title = findTitle(child)
    if (title !== null) return title
  }
  return null
}

async function readPage(root: string, entry: FileEntry): Promise<PageEntry> {
  const html = await readFile(join(root, entry.path), 'utf8')
  return {
    path: entry.path,
    title: findTitle(parse(html) as Node) || entry.path,
    bytes: entry.bytes
  }
}

export async function scanWorkspace(root: string): Promise<Workspace> {
  const files = (await listFiles(root)).filter((file) => file.path.endsWith('.html'))
  const pages = await Promise.all(files.map((file) => readPage(root, file)))
  const { siteName } = await getSiteSettings(root)
  return { root, name: siteName.trim() || basename(root), folder: basename(root), pages }
}
