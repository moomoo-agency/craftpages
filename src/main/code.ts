import { createHash } from 'crypto'
import { readFile, stat } from 'fs/promises'
import { extname, posix } from 'path'
import { hasDraft } from './drafts'
import { serveCopyOf } from './editing'
import { writeFiles } from './history'
import { attr, parseWithLocations, walk } from './html/dom'
import { getWorkspace } from './state'
import { resolveInWorkspace } from './workspace'
import type { SourceFile } from '../shared/types'

/**
 * Code mode: a page's HTML and its own stylesheets and scripts, edited as text.
 * Saves go through the history (one undoable step each) and refuse to overwrite a file
 * that changed on disk since it was opened, or a page with unsaved visual edits.
 */

const TEXT = new Set([
  '.html',
  '.htm',
  '.css',
  '.js',
  '.mjs',
  '.json',
  '.webmanifest',
  '.xml',
  '.svg',
  '.txt',
  '.md'
])
const MAX_BYTES = 3 * 1024 * 1024

const hashOf = (text: string): string => createHash('sha1').update(text).digest('hex')

function checkEditable(path: string): void {
  if (!TEXT.has(extname(path).toLowerCase()))
    throw new Error(`${path} isn’t a text file that can be edited here.`)
}

export async function readSource(root: string, path: string): Promise<SourceFile> {
  checkEditable(path)
  const full = resolveInWorkspace(root, path)
  if ((await stat(full)).size > MAX_BYTES) throw new Error(`${path} is too large to edit here.`)
  const text = await readFile(full, 'utf8')
  return { path, text, hash: hashOf(text) }
}

/** The page's own stylesheets and scripts (files in this site), in the order they appear. */
export async function pageAssets(root: string, path: string): Promise<string[]> {
  const source = await readFile(resolveInWorkspace(root, path), 'utf8')
  const found: string[] = []
  walk(parseWithLocations(source), (element) => {
    const url =
      element.tagName === 'link' && /\bstylesheet\b/i.test(attr(element, 'rel') ?? '')
        ? attr(element, 'href')
        : element.tagName === 'script'
          ? attr(element, 'src')
          : undefined
    if (!url || /^[a-z][a-z0-9+.-]*:|^\/\//i.test(url)) return true
    const clean = url.split(/[?#]/)[0]
    const absolute = clean.startsWith('/') ? clean : posix.join(posix.dirname('/' + path), clean)
    try {
      found.push(decodeURI(posix.normalize(absolute)).replace(/^\/+/, ''))
    } catch {
      // A malformed URL: not a file of the site.
    }
    return true
  })
  const unique = [...new Set(found)]
  const exists = await Promise.all(
    unique.map((file) =>
      stat(resolveInWorkspace(root, file)).then(
        (info) => info.isFile(),
        () => false
      )
    )
  )
  return unique.filter((file, index) => exists[index] && TEXT.has(extname(file).toLowerCase()))
}

/**
 * How many of the site's pages use each stylesheet or script: an edit to a shared file
 * changes every one of them.
 */
export async function assetUsage(root: string, files: string[]): Promise<Record<string, number>> {
  const counts: Record<string, number> = Object.fromEntries(files.map((file) => [file, 0]))
  for (const page of getWorkspace()?.pages ?? []) {
    const used = await pageAssets(root, page.path).catch(() => [] as string[])
    for (const file of used) if (file in counts) counts[file]++
  }
  return counts
}

export async function saveSource(
  root: string,
  path: string,
  text: string,
  baseHash: string
): Promise<{ hash: string; historyId: string }> {
  checkEditable(path)
  if (hasDraft(path))
    throw new Error(`${path} has unsaved visual edits. Save or discard them first.`)
  const current = await readFile(resolveInWorkspace(root, path), 'utf8').catch(() => '')
  if (hashOf(current) !== baseHash)
    throw new Error(
      `${path} changed on disk since you opened it (another editor, the AI or a save). ` +
        'Reload it to see the new version; copy your changes first if you need them.'
    )
  const historyId = await writeFiles(root, [{ path, content: text }], `Code: ${path}`)
  return { hash: hashOf(text), historyId }
}

/** One preview slot per page, so typing doesn't push the editor's own sessions out. */
const previewKeys = new Map<string, string>()

/** Serves unsaved HTML as the page at `path`, so relative links and styles still resolve. */
export async function previewSource(path: string, text: string): Promise<string> {
  let key = previewKeys.get(path)
  if (!key) {
    key = `code-${createHash('sha1').update(path).digest('hex').slice(0, 16)}`
    previewKeys.set(path, key)
  }
  // A new query each time, so the frame reloads.
  return `${(await serveCopyOf(path, text, key)).url}&v=${Date.now()}`
}
