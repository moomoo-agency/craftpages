import { randomBytes } from 'crypto'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { draftView, renderWithDrafts } from './drafts'
import { previewRoute, withPreviewKeys } from './craftforms'
import { serveCopy } from './html/instrument'
import { componentHeading } from './html/components'
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
  server ??= startStaticServer({
    getRoot,
    getEditCopy: (key) => sessions.get(key),
    route: previewRoute
  })
  return server
}

/** Pages with unsaved drafts applied and their own scripts running (Interact mode, browser). */
function draftServer(): Promise<StaticServer> {
  interactServer ??= startStaticServer({
    getRoot,
    // Unsaved drafts applied, and CraftForms embeds swapped for preview keys so the
    // forms load here (craftforms.ts, "Previews").
    transformHtml: async (path, origin) => {
      const root = getRoot()
      if (!root) return null
      const html = (await renderWithDrafts(path)) ?? (await readFile(join(root, path), 'utf8'))
      return withPreviewKeys(root, html, origin)
    },
    route: previewRoute
  })
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

/**
 * CraftForms embeds are empty until their loader runs, and served copies run no page
 * scripts: a CSS-only stand-in shows where each form is. CSS rather than markup, so the
 * editor's numbering of elements stays exactly as instrumented. Interact mode shows the
 * real form (craftforms.ts, "Previews").
 */
const FORM_PLACEHOLDER =
  '<style data-cms-forms>[data-craftforms-embed]{display:block;min-height:96px;margin:12px 0;' +
  'border:2px dashed rgba(47,111,237,.55);border-radius:10px;background:rgba(47,111,237,.05)}' +
  '[data-craftforms-embed]::before{content:"CraftForms form";display:block;padding:36px 16px;' +
  'text-align:center;font:600 14px/1.4 system-ui,sans-serif;color:#2f6fed}</style>'

function withFormPlaceholders(served: string): string {
  if (!served.includes('data-craftforms-embed')) return served
  const head = served.search(/<\/head>/i)
  return head === -1 ? served : served.slice(0, head) + FORM_PLACEHOLDER + served.slice(head)
}

/** Serves an instrumented copy of a page (editor or pointing mode) and returns its URL. */
export async function serveCopyOf(
  path: string,
  served: string,
  /** Reuse a key (code mode's live preview) instead of taking another session slot. */
  reuse?: string
): Promise<{ key: string; url: string }> {
  const { origin } = await previewServer()
  const key = reuse ?? randomBytes(12).toString('hex')
  sessions.delete(key)
  sessions.set(key, withFormPlaceholders(served))
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
      tag: component.element.tagName,
      heading: componentHeading(component.element),
      pages: view.groups.get(id)?.pages ?? [path],
      scope: view.scopes[id] ?? 'all'
    })),
    warning: view.warning
  }
}

export function clearSessions(): void {
  sessions.clear()
}

/** The Forms screen's preview of a form, on the interact server (scripts run there). */
export async function formPreviewUrl(
  target: { formId?: string; key?: string },
  page: string,
  styles: 'site' | 'form'
): Promise<string> {
  const { origin } = await draftServer()
  const query = new URLSearchParams({
    ...(target.formId ? { form: target.formId } : {}),
    ...(target.key ? { key: target.key } : {}),
    page,
    styles
  })
  return `${origin}/__craftforms/preview?${query}`
}
