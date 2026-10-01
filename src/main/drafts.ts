import { createHash } from 'crypto'
import { mkdirSync, writeFileSync } from 'fs'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { applyPatches, attr, children, type Element } from './html/dom'
import { componentId, pageComponents, scanComponents } from './html/components'
import { analyze, editPatches, type Analysis } from './html/instrument'
import { readSeo, writeSeo } from './html/seo'
import { writeFiles } from './history'
import { APP_DIR } from './settings'
import { broadcast, getWorkspace } from './state'
import { resolveInWorkspace } from './workspace'
import type {
  ComponentGroup,
  ComponentScope,
  DraftState,
  ListEdits,
  NodeChange,
  PageSeo,
  SaveResult,
  SkippedChange
} from '../shared/types'

/**
 * Unsaved edits, per page. Nothing is written to site files until `saveAll`.
 * Drafts are tied to the exact file text they were made on (by hash), and are
 * kept in `.sitecms/drafts.json` so they survive page switches and restarts.
 *
 * Edits inside a shared component (header, footer…) with scope "all" are
 * replayed on every other page that has the same component, element by
 * element, wherever that element's original content is identical.
 */

interface PageDraft {
  hash: string
  changes: Record<string, NodeChange>
  /** Repeating lists with items added, removed or moved. */
  lists?: ListEdits
  scopes: Record<string, ComponentScope>
  seo?: PageSeo
}

let draftsRoot: string | null = null
let drafts = new Map<string, PageDraft>()

const draftsFile = (root: string): string => join(root, APP_DIR, 'drafts.json')
export const hashText = (text: string): string => createHash('sha1').update(text).digest('hex')

export async function loadDrafts(root: string | null): Promise<void> {
  await flush()
  draftsRoot = root
  drafts = new Map()
  models.clear()
  if (root) {
    try {
      const stored = JSON.parse(await readFile(draftsFile(root), 'utf8')) as Record<
        string,
        PageDraft
      >
      drafts = new Map(Object.entries(stored))
    } catch {
      // No drafts yet.
    }
  }
  notify()
}

let persistTimer: NodeJS.Timeout | null = null
/** What the next write will store, and where: fixed when scheduled, not when it fires. */
let pending: { root: string; text: string } | null = null

async function flush(): Promise<void> {
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = null
  const job = pending
  pending = null
  if (!job) return
  await mkdir(join(job.root, APP_DIR), { recursive: true })
  await writeFile(draftsFile(job.root), JSON.stringify(JSON.parse(job.text), null, 2))
}

/** On quit: write any pending drafts before the process ends. */
export function flushDraftsSync(): void {
  if (persistTimer) clearTimeout(persistTimer)
  const job = pending
  pending = null
  if (!job) return
  mkdirSync(join(job.root, APP_DIR), { recursive: true })
  writeFileSync(draftsFile(job.root), JSON.stringify(JSON.parse(job.text), null, 2))
}

function persist(): void {
  if (!draftsRoot) return
  // Snapshot now: if the project switches before the write, the old project still gets its own drafts.
  pending = { root: draftsRoot, text: JSON.stringify(Object.fromEntries(drafts)) }
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    flush().catch(() => {})
  }, 200)
}

let notifyTimer: NodeJS.Timeout | null = null
function notify(): void {
  if (notifyTimer) clearTimeout(notifyTimer)
  notifyTimer = setTimeout(() => {
    draftState()
      .then((state) => broadcast({ type: 'drafts', drafts: state }))
      .catch(() => {})
  }, 150)
}

function requireDraftsRoot(): string {
  const root = getWorkspace()?.root
  if (!root || root !== draftsRoot) throw new Error('No site is open.')
  return root
}

// ---------- Page models ----------

export interface PageModel {
  path: string
  source: string
  hash: string
  sharedKey: string
  analysis: Analysis
  /** Shared components on this page, by component id. */
  components: Map<string, { element: Element; label: string }>
}

const models = new Map<string, PageModel>()

async function sharedGroups(root: string): Promise<Map<string, ComponentGroup>> {
  const pages = getWorkspace()?.pages.map((page) => page.path) ?? []
  return new Map((await scanComponents(root, pages)).map((group) => [group.id, group]))
}

export async function loadModel(
  root: string,
  path: string,
  groups?: Map<string, ComponentGroup>
): Promise<PageModel> {
  const source = await readFile(resolveInWorkspace(root, path), 'utf8')
  const hash = hashText(source)
  const shared = groups ?? (await sharedGroups(root))
  // Which components are shared depends on the other pages too, so it's part of the cache key.
  const sharedKey = [...shared.values()]
    .filter((group) => group.pages.includes(path))
    .map((group) => group.id)
    .join(',')
  const cached = models.get(path)
  if (cached && cached.hash === hash && cached.sharedKey === sharedKey) return cached
  const analysis = analyze(source)
  const components = new Map<string, { element: Element; label: string }>()
  for (const [label, element] of pageComponents(analysis.document)) {
    const id = componentId(label)
    if (shared.get(id)?.pages.includes(path)) components.set(id, { element, label })
  }
  const model = { path, source, hash, sharedKey, analysis, components }
  models.set(path, model)
  return model
}

function componentOf(model: PageModel, element: Element): [string, Element] | null {
  const byElement = new Map([...model.components].map(([id, c]) => [c.element, id]))
  for (let node: Element | null = element; node; node = parentElement(node)) {
    const id = byElement.get(node)
    if (id) return [id, node]
  }
  return null
}

function parentElement(element: Element): Element | null {
  const parent = element.parentNode
  return parent && 'tagName' in parent ? (parent as Element) : null
}

/** Child-index path from a component instance down to one of its elements. */
function pathWithin(instance: Element, element: Element): number[] {
  const path: number[] = []
  for (let node = element; node !== instance;) {
    const parent = parentElement(node)!
    path.unshift(children(parent).indexOf(node))
    node = parent
  }
  return path
}

function follow(instance: Element, path: number[]): Element | null {
  let node: Element | undefined = instance
  for (const index of path) node = node && children(node)[index]
  return node ?? null
}

const inner = (model: PageModel, element: Element): string => {
  const location = element.sourceCodeLocation
  if (!location?.startTag || !location.endTag) return ''
  return model.source
    .slice(location.startTag.endOffset, location.endTag.startOffset)
    .replace(/\s+/g, ' ')
    .trim()
}

/** Replays only onto an element that currently holds exactly what the edited one held. */
function sameOriginal(
  from: PageModel,
  fromElement: Element,
  to: PageModel,
  toElement: Element,
  change: NodeChange
): boolean {
  if (fromElement.tagName !== toElement.tagName) return false
  if (change.html !== undefined && inner(from, fromElement) !== inner(to, toElement)) return false
  for (const name of Object.keys(change.attrs ?? {})) {
    if (attr(fromElement, name) !== attr(toElement, name)) return false
  }
  return true
}

// ---------- Resolving drafts into per-file edits ----------

interface PlannedFile {
  model: PageModel
  changes: Map<string, NodeChange>
  /** Node id → page the edit was made on. */
  origins: Map<string, string>
  lists: ListEdits
  seo?: PageSeo
}

interface Plan {
  files: Map<string, PlannedFile>
  skipped: SkippedChange[]
  stale: string[]
}

async function resolvePlan(root: string): Promise<Plan> {
  const groups = await sharedGroups(root)
  const plan: Plan = { files: new Map(), skipped: [], stale: [] }
  const entry = (model: PageModel): PlannedFile => {
    let file = plan.files.get(model.path)
    if (!file)
      plan.files.set(
        model.path,
        (file = { model, changes: new Map(), origins: new Map(), lists: {} })
      )
    return file
  }

  const valid: [string, PageDraft, PageModel][] = []
  for (const [path, draft] of drafts) {
    let model: PageModel
    try {
      model = await loadModel(root, path, groups)
    } catch {
      plan.stale.push(path) // deleted or renamed
      continue
    }
    if (model.hash !== draft.hash) {
      plan.stale.push(path)
      continue
    }
    valid.push([path, draft, model])
    // A page's own edits come first and always win over replayed ones.
    for (const change of Object.values(draft.changes)) {
      entry(model).changes.set(change.id, change)
      entry(model).origins.set(change.id, path)
    }
    if (draft.seo) entry(model).seo = draft.seo
    if (draft.lists && Object.keys(draft.lists).length) entry(model).lists = draft.lists
  }

  const skipped = new Map<string, SkippedChange>()
  for (const [path, draft, model] of valid) {
    for (const change of Object.values(draft.changes)) {
      const node = model.analysis.nodes.get(Number(change.id))
      const found = node && componentOf(model, node.element)
      if (!node || !found) continue
      const [id, instance] = found
      if ((draft.scopes[id] ?? 'all') === 'page') continue
      const group = groups.get(id)
      const route = pathWithin(instance, node.element)
      for (const other of group?.pages ?? []) {
        if (other === path) continue
        const target = await loadModel(root, other, groups)
        const targetInstance = target.components.get(id)?.element
        const targetElement = targetInstance && follow(targetInstance, route)
        const targetId = targetElement && target.analysis.idOf.get(targetElement)
        if (
          !targetElement ||
          !targetId ||
          !sameOriginal(model, node.element, target, targetElement, change)
        ) {
          const key = `${other}|${id}|${path}`
          skipped.set(key, { page: other, component: group!.label, from: path })
          continue
        }
        const file = entry(target)
        if (file.changes.has(String(targetId))) continue
        file.changes.set(String(targetId), { ...change, id: String(targetId) })
        file.origins.set(String(targetId), path)
      }
    }
  }
  plan.skipped = [...skipped.values()]
  return plan
}

function render(file: PlannedFile): string {
  const { source, analysis } = file.model
  let next = applyPatches(
    source,
    editPatches(source, analysis, [...file.changes.values()], file.lists)
  )
  if (file.seo) next = writeSeo(next, file.seo)
  return next
}

// ---------- API ----------

export async function draftState(): Promise<DraftState> {
  if (!draftsRoot) return { pages: [], stale: [] }
  const plan = await resolvePlan(draftsRoot)
  const pages = [...plan.files.values()].map((file) => {
    const origins = [...file.origins.values()]
    return {
      path: file.model.path,
      own:
        origins.filter((origin) => origin === file.model.path).length +
        Object.keys(file.lists).length,
      inherited: origins.filter((origin) => origin !== file.model.path).length,
      seo: Boolean(file.seo)
    }
  })
  return { pages: pages.sort((a, b) => a.path.localeCompare(b.path)), stale: plan.stale }
}

export interface DraftView {
  model: PageModel
  own: NodeChange[]
  inherited: NodeChange[]
  lists: ListEdits
  scopes: Record<string, ComponentScope>
  groups: Map<string, ComponentGroup>
  warning?: string
}

/** Everything the editor needs to show a page with its unsaved state. */
export async function draftView(path: string): Promise<DraftView> {
  const root = requireDraftsRoot()
  const groups = await sharedGroups(root)
  const model = await loadModel(root, path, groups)
  let warning: string | undefined
  const draft = drafts.get(path)
  if (draft && draft.hash !== model.hash) {
    drafts.delete(path)
    persist()
    notify()
    warning =
      'This page changed on disk since your last unsaved edits, so those edits were discarded.'
  }
  const plan = await resolvePlan(root)
  const file = plan.files.get(path)
  const own: NodeChange[] = []
  const inherited: NodeChange[] = []
  for (const [id, change] of file?.changes ?? []) {
    ;(file!.origins.get(id) === path ? own : inherited).push(change)
  }
  return {
    model,
    own,
    inherited,
    lists: file?.lists ?? {},
    scopes: drafts.get(path)?.scopes ?? {},
    groups,
    warning
  }
}

function draftFor(path: string, hash: string): PageDraft {
  let draft = drafts.get(path)
  if (!draft || draft.hash !== hash) {
    draft = { hash, changes: {}, scopes: {} }
    drafts.set(path, draft)
  }
  return draft
}

function cleanup(path: string): void {
  const draft = drafts.get(path)
  if (
    draft &&
    Object.keys(draft.changes).length === 0 &&
    Object.keys(draft.lists ?? {}).length === 0 &&
    !draft.seo &&
    Object.keys(draft.scopes).length === 0
  ) {
    drafts.delete(path)
  }
  persist()
  notify()
}

export async function setDraft(
  path: string,
  hash: string,
  changes: NodeChange[],
  lists: ListEdits = {}
): Promise<void> {
  const model = await loadModel(requireDraftsRoot(), path)
  if (model.hash !== hash) throw new Error(`${path} changed on disk. Reload the page.`)
  const known = Object.entries(lists).filter(([id, order]) => {
    const list = model.analysis.lists.get(id)
    // Back in the original order with nothing new: no edit.
    return (
      list &&
      !(
        order.length === list.items.length &&
        order.every((item, i) => item.from === i && item.html === undefined)
      )
    )
  })
  // Fails here (not at save) when a new item can't be written.
  editPatches(model.source, model.analysis, [], Object.fromEntries(known))
  const draft = draftFor(path, hash)
  draft.changes = Object.fromEntries(
    changes
      .filter((change) => model.analysis.nodes.has(Number(change.id)))
      .map((change) => [change.id, change])
  )
  draft.lists = Object.fromEntries(known)
  cleanup(path)
}

export async function setComponentScope(
  path: string,
  id: string,
  scope: ComponentScope
): Promise<void> {
  const model = await loadModel(requireDraftsRoot(), path)
  const draft = draftFor(path, model.hash)
  if (scope === 'all') delete draft.scopes[id]
  else draft.scopes[id] = scope
  cleanup(path)
}

export async function getSeo(path: string): Promise<{ file: PageSeo; draft: PageSeo | null }> {
  const model = await loadModel(requireDraftsRoot(), path)
  const draft = drafts.get(path)
  return {
    file: readSeo(model.source),
    draft: draft?.hash === model.hash ? (draft.seo ?? null) : null
  }
}

export async function setSeoDraft(path: string, seo: PageSeo | null): Promise<void> {
  const model = await loadModel(requireDraftsRoot(), path)
  const file = readSeo(model.source)
  const unchanged =
    !seo || (Object.keys(file) as (keyof PageSeo)[]).every((key) => file[key] === seo[key].trim())
  const draft = draftFor(path, model.hash)
  if (unchanged) delete draft.seo
  else draft.seo = seo
  cleanup(path)
}

export function hasDraft(path: string): boolean {
  return drafts.has(path)
}

export function discardDrafts(path: string | null): void {
  if (path) drafts.delete(path)
  else drafts.clear()
  persist()
  notify()
}

export async function saveAll(): Promise<SaveResult> {
  const root = requireDraftsRoot()
  const plan = await resolvePlan(root)
  const writes = [...plan.files.values()]
    .map((file) => ({ path: file.model.path, content: render(file), source: file.model.source }))
    .filter((write) => write.content !== write.source)
  const historyId = writes.length
    ? await writeFiles(
        root,
        writes.map(({ path, content }) => ({ path, content })),
        `Save ${writes.length} page${writes.length === 1 ? '' : 's'}`
      )
    : null
  drafts.clear()
  persist()
  notify()
  return { pages: writes.map((write) => write.path), historyId, skipped: plan.skipped }
}

/** Stored with a scheduled release, so cancelling it can give the edits back as drafts. */
export type StoredDrafts = Record<string, PageDraft>

export interface TakenDrafts {
  /** Each changed file as it is now and as it will be. */
  files: { path: string; before: string; after: string }[]
  drafts: StoredDrafts
  skipped: SkippedChange[]
}

/**
 * Like `saveAll`, but writes nothing: returns what saving would write and
 * clears the drafts, for a release that applies them later.
 */
export async function takeDrafts(): Promise<TakenDrafts> {
  const root = requireDraftsRoot()
  const plan = await resolvePlan(root)
  const files = [...plan.files.values()]
    .map((file) => ({ path: file.model.path, before: file.model.source, after: render(file) }))
    .filter((file) => file.after !== file.before)
  if (!files.length) throw new Error('There are no unsaved page edits to schedule.')
  const taken = Object.fromEntries(drafts)
  drafts.clear()
  persist()
  notify()
  return { files, drafts: taken, skipped: plan.skipped }
}

/**
 * Gives a cancelled release's edits back as drafts. A page that has drafts of
 * its own again keeps them, with the returned edits added where they don't clash.
 */
export function restoreDrafts(stored: StoredDrafts): void {
  requireDraftsRoot()
  for (const [path, draft] of Object.entries(stored)) {
    const existing = drafts.get(path)
    if (!existing || existing.hash !== draft.hash) {
      // Drafts on a different version of the file are dropped by draftView as usual.
      if (!existing) drafts.set(path, draft)
      continue
    }
    existing.changes = { ...draft.changes, ...existing.changes }
    existing.scopes = { ...draft.scopes, ...existing.scopes }
    existing.lists = { ...draft.lists, ...existing.lists }
    existing.seo ??= draft.seo
  }
  persist()
  notify()
}

/** Re-sends the draft state (after files changed underneath, e.g. a scheduled release). */
export function refreshDraftState(): void {
  if (draftsRoot) notify()
}

/** The page as it will be after saving, or `null` when it has no pending edits. */
export async function renderWithDrafts(path: string): Promise<string | null> {
  if (!draftsRoot || drafts.size === 0) return null
  const file = (await resolvePlan(draftsRoot)).files.get(path)
  return file ? render(file) : null
}
