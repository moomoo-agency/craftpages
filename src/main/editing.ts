import { randomBytes } from 'crypto'
import { draftView, renderWithDrafts } from './drafts'
import { serveCopy } from './html/instrument'
import { EDITOR_SCRIPT_PATH, startStaticServer, type StaticServer } from './preview/server'
import { getWorkspace } from './state'
import type { EditSession } from '../shared/types'

/** Served copies of pages open in the editor, by session key. Only the latest few are kept. */
const sessions = new Map<string, string>()
const MAX_SESSIONS = 10

let server: Promise<StaticServer> | null = null
let interactServer: Promise<StaticServer> | null = null

const getRoot = (): string | null => getWorkspace()?.root ?? null

/** Pages exactly as they are on disk (the editor iframe, AI screenshots). */
export function previewServer(): Promise<StaticServer> {
  server ??= startStaticServer({ getRoot, getEditCopy: (key) => sessions.get(key) })
  return server
}

/** Pages with unsaved drafts applied and their own scripts running (Interact mode, browser). */
function draftServer(): Promise<StaticServer> {
  interactServer ??= startStaticServer({ getRoot, transformHtml: (path) => renderWithDrafts(path) })
  return interactServer
}

const pageUrl = (origin: string, path: string): string =>
  `${origin}/${encodeURI(path.replace(/^\/+/, '').replace(/(^|\/)index\.html$/, '$1'))}`

export async function previewUrl(path: string): Promise<string> {
  return pageUrl((await previewServer()).origin, path)
}

export async function interactUrl(path: string): Promise<string> {
  return pageUrl((await draftServer()).origin, path)
}

/** Serves an instrumented copy of a page (editor or pointing mode) and returns its URL. */
export async function serveCopyOf(
  path: string,
  served: string
): Promise<{ key: string; url: string }> {
  const { origin } = await previewServer()
  const key = randomBytes(12).toString('hex')
  sessions.set(key, served)
  while (sessions.size > MAX_SESSIONS) sessions.delete(sessions.keys().next().value!)
  return { key, url: `${pageUrl(origin, path)}?__cms=${key}` }
}

export async function startEditing(path: string): Promise<EditSession> {
  const view = await draftView(path)
  const { origin } = await previewServer()
  const marks = new Map([...view.model.components].map(([id, c]) => [c.element, id]))
  const served = serveCopy(
    view.model.source,
    view.model.analysis,
    `${origin}${EDITOR_SCRIPT_PATH}`,
    marks
  )

  const { key, url } = await serveCopyOf(path, served)

  return {
    key,
    path,
    hash: view.model.hash,
    url,
    editable: view.model.analysis.nodes.size,
    own: view.own,
    inherited: view.inherited,
    lists: view.lists,
    components: [...view.model.components].map(([id, component]) => ({
      id,
      label: component.label,
      pages: view.groups.get(id)?.pages ?? [path],
      scope: view.scopes[id] ?? 'all'
    })),
    warning: view.warning
  }
}

export function clearSessions(): void {
  sessions.clear()
}
