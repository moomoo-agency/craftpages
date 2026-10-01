import { BrowserWindow, Notification, powerMonitor, powerSaveBlocker } from 'electron'
import { randomBytes } from 'crypto'
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'fs/promises'
import { join } from 'path'
import { duePosts, generateBlog } from './blog-generate'
import * as drafts from './drafts'
import { writeFiles, type FileWrite } from './history'
import { mergeInto } from './merge'
import { scheduledPosts } from './posts'
import { deployProject, isDeploying } from './publish'
import { refreshSearch } from './search-site'
import { APP_DIR, getAppSettings, getSiteSettings } from './settings'
import { broadcast, getWorkspace, requireRoot, setWorkspace } from './state'
import { resolveInWorkspace, scanWorkspace } from './workspace'
import { postPath } from '../shared/blog-urls'
import { describeRun } from '../shared/schedule'
import type { PageRelease, ScheduleInput, ScheduleOverview, ScheduledRun } from '../shared/types'

/**
 * Everything that happens at a time: scheduled posts, scheduled page changes
 * (with an optional end), and the deploys that follow. A static site can't do
 * this on its own, so the app does it while it runs — for every recent
 * project, not only the open one — and catches up after sleep or a restart.
 */

// ---------- Scheduled page changes: storage ----------

const SCHEDULE_DIR = `${APP_DIR}/scheduled`
const STATE_FILE = 'state.json'
/** Finished releases are kept this long for reference. */
const KEEP_DONE_MS = 30 * 24 * 3600_000

interface StoredRelease extends PageRelease {
  files: { path: string; before: string; after: string }[]
  drafts: drafts.StoredDrafts
  /** The end time came but the pages couldn't be put back (see `message`). */
  endBlocked?: boolean
}

interface ProjectState {
  deployRetry: { since: string; lastAttempt: string; error: string } | null
}

const scheduleDir = (root: string): string => join(root, SCHEDULE_DIR)
const releaseFile = (root: string, id: string): string => {
  if (!/^[a-z0-9]+$/.test(id)) throw new Error('Invalid release id')
  return join(scheduleDir(root), `${id}.json`)
}

async function readReleases(root: string): Promise<StoredRelease[]> {
  let names: string[]
  try {
    names = await readdir(scheduleDir(root))
  } catch {
    return []
  }
  const found: StoredRelease[] = []
  for (const name of names) {
    if (!name.endsWith('.json') || name === STATE_FILE) continue
    try {
      const release = JSON.parse(
        await readFile(join(scheduleDir(root), name), 'utf8')
      ) as StoredRelease
      const finished = release.endedAt ?? release.releasedAt
      if (
        release.state === 'done' &&
        finished &&
        Date.now() - Date.parse(finished) > KEEP_DONE_MS
      ) {
        await rm(join(scheduleDir(root), name), { force: true })
        continue
      }
      found.push(release)
    } catch {
      // Unreadable: leave it alone rather than guess.
    }
  }
  return found.sort((a, b) => a.at.localeCompare(b.at))
}

async function readRelease(root: string, id: string): Promise<StoredRelease> {
  try {
    return JSON.parse(await readFile(releaseFile(root, id), 'utf8')) as StoredRelease
  } catch {
    throw new Error('This scheduled change no longer exists.')
  }
}

async function saveRelease(root: string, release: StoredRelease): Promise<void> {
  await mkdir(scheduleDir(root), { recursive: true })
  await writeFile(releaseFile(root, release.id), JSON.stringify(release, null, 2) + '\n')
}

async function readState(root: string): Promise<ProjectState> {
  try {
    return JSON.parse(await readFile(join(scheduleDir(root), STATE_FILE), 'utf8')) as ProjectState
  } catch {
    return { deployRetry: null }
  }
}

async function saveState(root: string, state: ProjectState): Promise<void> {
  await mkdir(scheduleDir(root), { recursive: true })
  await writeFile(join(scheduleDir(root), STATE_FILE), JSON.stringify(state, null, 2) + '\n')
}

function view(release: StoredRelease): PageRelease {
  const { id, label, createdAt, at, until, deploy, state, pages, releasedAt, endedAt, message } =
    release
  return { id, label, createdAt, at, until, deploy, state, pages, releasedAt, endedAt, message }
}

// ---------- Applying ----------

type Direction = 'start' | 'end'

/**
 * The writes that put a release on (start) or take it off (end). Other edits
 * made to the same files since are kept; where they touch the same lines the
 * file is a conflict, unless `force` (then the release's version wins).
 */
async function plan(
  root: string,
  release: StoredRelease,
  direction: Direction,
  force: boolean
): Promise<{ writes: FileWrite[]; conflicts: string[] }> {
  const writes: FileWrite[] = []
  const conflicts: string[] = []
  for (const file of release.files) {
    const [from, to] = direction === 'start' ? [file.before, file.after] : [file.after, file.before]
    const current = await readFile(resolveInWorkspace(root, file.path), 'utf8').catch(() => null)
    const merged = current === null ? null : mergeInto(from, to, current)
    if (merged === null && !force) {
      conflicts.push(file.path)
      continue
    }
    const content = merged ?? to
    if (content !== current) writes.push({ path: file.path, content })
  }
  return { writes, conflicts }
}

const conflictMessage = (direction: Direction, paths: string[]): string =>
  `${paths.join(', ')} ${paths.length === 1 ? 'was' : 'were'} changed ${
    direction === 'start' ? 'since this was scheduled' : 'while it was live'
  }, in the same place (or removed). Nothing was ${direction === 'start' ? 'published' : 'taken down'}.`

/** Puts a release on the site (or takes it off). Writes all files or none. */
async function apply(
  root: string,
  release: StoredRelease,
  direction: Direction,
  force = false
): Promise<boolean> {
  const { writes, conflicts } = await plan(root, release, direction, force)
  const now = new Date().toISOString()
  if (conflicts.length) {
    release.message = conflictMessage(direction, conflicts)
    if (direction === 'start') release.state = 'blocked'
    else release.endBlocked = true
    await saveRelease(root, release)
    return false
  }
  if (writes.length) {
    await writeFiles(
      root,
      writes,
      direction === 'start' ? `Scheduled: ${release.label}` : `Scheduled end: ${release.label}`
    )
  }
  delete release.message
  delete release.endBlocked
  if (direction === 'start') {
    release.releasedAt = now
    release.state = release.until ? 'live' : 'done'
  } else {
    release.endedAt = now
    release.state = 'done'
  }
  await saveRelease(root, release)
  return true
}

// ---------- One project's due work ----------

interface Outcome {
  posts: string[]
  released: string[]
  ended: string[]
  blocked: string[]
  /** Something changed that should be deployed now. */
  deploy: boolean
  wrote: boolean
}

async function afterWrite(root: string): Promise<void> {
  await refreshSearch(root).catch(() => null)
  if (getWorkspace()?.root === root) {
    setWorkspace(await scanWorkspace(root))
    drafts.refreshDraftState()
  }
}

/** Deploys now; a failure is retried every minute for an hour (e.g. no network right after wake). */
async function deployWithRetry(root: string): Promise<{ deployed: boolean; error?: string }> {
  const state = await readState(root)
  const now = new Date().toISOString()
  try {
    await deployProject(root, 'production')
    if (state.deployRetry) await saveState(root, { ...state, deployRetry: null })
    return { deployed: true }
  } catch (e) {
    const error = (e as Error).message
    const since = state.deployRetry?.since ?? now
    const expired = Date.now() - Date.parse(since) > RETRY_FOR_MS
    await saveState(root, {
      ...state,
      deployRetry: expired ? null : { since, lastAttempt: now, error }
    })
    return {
      deployed: false,
      error: expired
        ? `Deploy failed for an hour, giving up: ${error}. Publish from the Publish screen.`
        : `Deploy failed, retrying every minute: ${error}`
    }
  }
}

const RETRY_EVERY_MS = 60_000
const RETRY_FOR_MS = 3600_000

async function runProject(root: string, now = Date.now()): Promise<void> {
  const outcome: Outcome = {
    posts: [],
    released: [],
    ended: [],
    blocked: [],
    deploy: false,
    wrote: false
  }
  const site = await getSiteSettings(root)

  // Posts: the cheap check first, the full one only when something looks due.
  const waiting = await scheduledPosts(root)
  if (waiting.some((post) => Date.parse(post.date) <= now)) {
    const due = await duePosts(root, now)
    if (due.length) {
      await generateBlog(root, {}, now)
      outcome.posts = due.map((post) => post.title)
      outcome.wrote = true
      if (site.blog.scheduleDeploy) outcome.deploy = true
    }
  }

  // Page changes.
  for (const release of await readReleases(root)) {
    if (release.state === 'scheduled' && Date.parse(release.at) <= now) {
      if (await apply(root, release, 'start')) {
        outcome.released.push(release.label)
        outcome.wrote = true
        if (release.deploy) outcome.deploy = true
      } else outcome.blocked.push(release.label)
    } else if (
      release.state === 'live' &&
      release.until &&
      !release.endBlocked &&
      Date.parse(release.until) <= now
    ) {
      if (await apply(root, release, 'end')) {
        outcome.ended.push(release.label)
        outcome.wrote = true
        if (release.deploy) outcome.deploy = true
      } else outcome.blocked.push(release.label)
    }
  }

  if (outcome.wrote) await afterWrite(root)

  // Deploy what went live, or retry a deploy that failed.
  const state = await readState(root)
  const retryDue =
    state.deployRetry && now - Date.parse(state.deployRetry.lastAttempt) >= RETRY_EVERY_MS
  let deployed = false
  let error: string | undefined
  if ((outcome.deploy || retryDue) && !isDeploying()) {
    ;({ deployed, error } = await deployWithRetry(root))
  }

  const reported =
    outcome.posts.length ||
    outcome.released.length ||
    outcome.ended.length ||
    outcome.blocked.length ||
    deployed ||
    (error && !retryDue) // a retry that fails again isn't news
  if (reported) {
    report({
      root,
      project: site.siteName.trim() || root.split(/[\\/]/).pop() || root,
      posts: outcome.posts,
      released: outcome.released,
      ended: outcome.ended,
      blocked: outcome.blocked,
      deployed,
      error
    })
  }
  if (outcome.wrote || reported) changed(root)
}

// ---------- Reporting ----------

let showApp: () => void = () => {}

/** How a notification click brings the app back (the window may be closed). */
export function setShowApp(show: () => void): void {
  showApp = show
}

function report(run: ScheduledRun): void {
  broadcast({ type: 'scheduled', run })
  const focused = BrowserWindow.getAllWindows().some((w) => w.isFocused())
  const isOpen = getWorkspace()?.root === run.root
  // The in-app message covers the open project while the app is in front.
  if ((focused && isOpen) || !Notification.isSupported()) return
  const notification = new Notification({ title: run.project, body: describeRun(run) })
  notification.on('click', () => showApp())
  notification.show()
}

// ---------- Index of what's coming, across projects ----------

export interface Upcoming {
  root: string
  project: string
  label: string
  at: number
  kind: 'post' | 'release' | 'end' | 'deploy'
}

const index = new Map<string, Upcoming[]>()
/** Projects whose last run failed wait this long before the next try. */
const backoff = new Map<string, number>()
const BACKOFF_MS = 5 * 60_000
const listeners = new Set<() => void>()

/** Called whenever what's upcoming changes (for the tray). */
export function onUpcomingChange(listener: () => void): void {
  listeners.add(listener)
}

export function upcoming(): Upcoming[] {
  return [...index.values()].flat().sort((a, b) => a.at - b.at)
}

async function indexProject(root: string): Promise<void> {
  const items: Upcoming[] = []
  try {
    const site = await getSiteSettings(root)
    const project = site.siteName.trim() || root.split(/[\\/]/).pop() || root
    for (const post of await scheduledPosts(root))
      items.push({
        root,
        project,
        label: post.title || 'Untitled post',
        at: Date.parse(post.date),
        kind: 'post'
      })
    for (const release of await readReleases(root)) {
      if (release.state === 'scheduled')
        items.push({
          root,
          project,
          label: release.label,
          at: Date.parse(release.at),
          kind: 'release'
        })
      if (release.state === 'live' && release.until && !release.endBlocked)
        items.push({
          root,
          project,
          label: release.label,
          at: Date.parse(release.until),
          kind: 'end'
        })
    }
    const { deployRetry } = await readState(root)
    if (deployRetry)
      items.push({
        root,
        project,
        label: 'Retry deploy',
        at: Date.parse(deployRetry.lastAttempt) + RETRY_EVERY_MS,
        kind: 'deploy'
      })
  } catch {
    // Folder gone or unreadable: nothing scheduled there.
  }
  if (items.length) index.set(root, items)
  else index.delete(root)
}

async function projectRoots(): Promise<string[]> {
  const { recentProjects } = await getAppSettings()
  const roots = new Set(recentProjects.map((project) => project.path))
  const open = getWorkspace()?.root
  if (open) roots.add(open)
  const existing: string[] = []
  for (const root of roots) {
    if (
      await stat(join(root, APP_DIR)).then(
        (s) => s.isDirectory(),
        () => false
      )
    )
      existing.push(root)
  }
  return existing
}

async function indexAll(): Promise<void> {
  const roots = await projectRoots()
  for (const root of index.keys()) if (!roots.includes(root)) index.delete(root)
  for (const root of roots) await indexProject(root)
  listeners.forEach((listener) => listener())
}

/** Something scheduled changed in a project: re-read it, tell the UI, check it soon. */
export function changed(root: string): void {
  backoff.delete(root)
  if (getWorkspace()?.root === root) broadcast({ type: 'schedule', root })
  void serial(async () => {
    await indexProject(root)
    listeners.forEach((listener) => listener())
  })
}

// ---------- The loop ----------

const TICK_MS = 10_000
const REINDEX_MS = 10 * 60_000
/** Keep the computer from idle-sleeping this long before something is due. */
const STAY_AWAKE_MS = 20 * 60_000

let queue: Promise<unknown> = Promise.resolve()
/** Runs one scheduler job at a time, in order (ticks, user actions). */
function serial<T>(job: () => Promise<T>): Promise<T> {
  const next = queue.then(job, job)
  queue = next.catch(() => {})
  return next
}

let blocker: number | null = null
function stayAwake(): void {
  const soon = upcoming().some((item) => item.at - Date.now() < STAY_AWAKE_MS)
  if (soon && blocker === null) blocker = powerSaveBlocker.start('prevent-app-suspension')
  if (!soon && blocker !== null) {
    powerSaveBlocker.stop(blocker)
    blocker = null
  }
}

const lastError = new Map<string, string>()

async function tick(): Promise<void> {
  const now = Date.now()
  const due = new Set(
    upcoming()
      .filter((item) => item.at <= now)
      .map((item) => item.root)
  )
  for (const root of due) {
    if ((backoff.get(root) ?? 0) > now) continue
    try {
      await runProject(root, now)
      lastError.delete(root)
    } catch (e) {
      backoff.set(root, now + BACKOFF_MS)
      const message = (e as Error).message
      // Tell once per problem, not every few minutes.
      if (lastError.get(root) !== message) {
        lastError.set(root, message)
        const site = await getSiteSettings(root).catch(() => null)
        report({
          root,
          project: site?.siteName.trim() || root,
          posts: [],
          released: [],
          ended: [],
          blocked: [],
          deployed: false,
          error: `Something scheduled couldn't be published: ${message}`
        })
      }
    }
    await indexProject(root)
    // Still due after running (e.g. a post the generator can't place): don't spin on it.
    if (index.get(root)?.some((item) => item.at <= Date.now())) {
      backoff.set(root, Date.now() + BACKOFF_MS)
    }
  }
  if (due.size) listeners.forEach((listener) => listener())
  stayAwake()
}

let started = false

export function startScheduler(): void {
  if (started) return
  started = true
  const reindex = (): void => void serial(indexAll).then(() => serial(tick))
  setTimeout(reindex, 3_000)
  setInterval(() => void serial(tick), TICK_MS)
  setInterval(reindex, REINDEX_MS)
  // Back from sleep: whatever came due meanwhile goes out now.
  powerMonitor.on('resume', reindex)
  powerMonitor.on('unlock-screen', reindex)
}

// ---------- API for the open project ----------

export async function scheduleDrafts(input: ScheduleInput): Promise<PageRelease> {
  const root = requireRoot()
  const at = Date.parse(input.at)
  if (!Number.isFinite(at)) throw new Error('Choose when the changes go live.')
  if (at <= Date.now()) throw new Error('That time has passed. To publish now, use Save all.')
  const until = input.until ? Date.parse(input.until) : null
  if (until !== null && (!Number.isFinite(until) || until <= at))
    throw new Error('The end time must be after the go-live time.')
  return serial(async () => {
    const taken = await drafts.takeDrafts()
    const release: StoredRelease = {
      id: randomBytes(6).toString('hex'),
      label: input.label.trim() || 'Page changes',
      createdAt: new Date().toISOString(),
      at: new Date(at).toISOString(),
      until: until === null ? null : new Date(until).toISOString(),
      deploy: input.deploy,
      state: 'scheduled',
      pages: taken.files.map((file) => file.path),
      files: taken.files,
      drafts: taken.drafts
    }
    try {
      await saveRelease(root, release)
    } catch (e) {
      drafts.restoreDrafts(taken.drafts) // don't lose the edits
      throw e
    }
    changed(root)
    return view(release)
  })
}

export async function scheduleOverview(root: string): Promise<ScheduleOverview> {
  const site = await getSiteSettings(root)
  const now = Date.now()
  const { deployRetry } = await readState(root)
  return {
    // An end that couldn't be applied shows as a live release with a message.
    releases: (await readReleases(root)).map(view),
    posts: (await scheduledPosts(root))
      .filter((post) => Date.parse(post.date) > now)
      .map((post) => ({
        id: post.id,
        title: post.title || 'Untitled post',
        date: post.date,
        url: postPath(site.blog.permalink, post.slug)
      })),
    deployRetry: deployRetry && { since: deployRetry.since, error: deployRetry.error }
  }
}

/** Runs a release step now, from the Publish screen, and deploys when the release says so. */
async function runNow(id: string, direction: Direction, force: boolean): Promise<PageRelease> {
  const root = requireRoot()
  return serial(async () => {
    const release = await readRelease(root, id)
    const allowed =
      direction === 'start'
        ? release.state === 'scheduled' || release.state === 'blocked'
        : release.state === 'live'
    if (!allowed) throw new Error('This scheduled change has already been applied.')
    const ok = await apply(root, release, direction, force)
    if (ok) {
      await afterWrite(root)
      if (release.deploy && !isDeploying()) {
        const { error } = await deployWithRetry(root)
        if (error) {
          release.message = error
          await saveRelease(root, release)
        }
      }
    }
    changed(root)
    return view(release)
  })
}

export const releaseNow = (id: string, force = false): Promise<PageRelease> =>
  runNow(id, 'start', force)

export const endRelease = (id: string, force = false): Promise<PageRelease> =>
  runNow(id, 'end', force)

/**
 * Not live yet: dropped, and its edits become unsaved drafts again.
 * Live: stays on the site, and its end time is dropped.
 */
export async function cancelRelease(id: string): Promise<void> {
  const root = requireRoot()
  await serial(async () => {
    const release = await readRelease(root, id)
    if (release.state === 'scheduled' || release.state === 'blocked') {
      drafts.restoreDrafts(release.drafts)
      await rm(releaseFile(root, id), { force: true })
    } else if (release.state === 'live') {
      release.state = 'done'
      release.until = null
      delete release.endBlocked
      delete release.message
      await saveRelease(root, release)
    }
    changed(root)
  })
}

/** Every scheduled thing that won't happen while the app is closed. */
export const pendingCount = (): number => upcoming().filter((item) => item.kind !== 'deploy').length
