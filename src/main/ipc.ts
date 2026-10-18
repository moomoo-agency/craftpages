import { BrowserWindow, clipboard, dialog, ipcMain, shell, type IpcMainInvokeEvent } from 'electron'
import { watch, type FSWatcher } from 'fs'
import { mkdtemp, readdir, readFile, stat, writeFile } from 'fs/promises'
import { homedir, tmpdir } from 'os'
import { basename, join } from 'path'
import * as cloudflare from './deploy/cloudflare'
import { fixLayoutLinks, layoutLinks } from './blog-links'
import { blogSetup, previewBlog, readTemplates, saveTemplates, viewUrl } from './blog'
import { buildPostPage, generateBlog, generatedFiles } from './blog-generate'
import * as posts from './posts'
import { checkForUpdate, installUpdate, updateState } from './updates'
import {
  checkLive,
  credentialsFor,
  deployProject,
  listDeploymentsFor,
  rollbackFor
} from './publish'
import * as workers from './deploy/workers'
import * as scheduler from './scheduler'
import { applyBackgroundSettings } from './background'
import { startStaticServer, type StaticServer } from './preview/server'
import { postPath, fileOfPath } from '../shared/blog-urls'
import { siteForPost } from '../shared/languages'
import * as pointing from './pointing'
import * as seoSite from './seo-site'
import * as languages from './languages'
import * as translations from './translations'
import * as switcher from './language-switcher'
import * as search from './search-site'
import { refreshSearch } from './search-site'
import * as drafts from './drafts'
import {
  clearSessions,
  formPreviewUrl,
  interactUrl,
  previewServer,
  previewUrl,
  startEditing
} from './editing'
import { scanComponents } from './html/components'
import { revert } from './history'
import { importImage } from './images'
import { fetchGist } from './gist'
import * as craftforms from './craftforms'
import * as media from './media'
import {
  broadcastMcpStatus,
  mcpStatus,
  notifyProjectSwitched,
  setToken,
  startMcp,
  stopMcp
} from './mcp/server'
import * as proposals from './mcp/proposals'
import { proposalPreviewUrl } from './mcp/previews'
import { setSelection } from './mcp/selection'
import { log, logFile, readLogTail } from './log'
import { isSecretField, registerSecrets } from './redact'
import * as settings from './settings'
import { getWorkspace, onWorkspaceSwitch, requireRoot, setWorkspace } from './state'
import { scanWorkspace } from './workspace'
import { excludedBy, pagePattern } from './deploy/exclude'
import { checkServer } from './deploy/server'
import * as code from './code'
import * as snapshots from './sync/snapshots'
import * as sync from './sync/engine'
import type {
  AppSettings,
  SiteLanguage,
  SearchChange,
  SwitcherLook,
  BlogTemplates,
  ConnectionInput,
  ComponentScope,
  ElementLocator,
  FormsEmbedSettings,
  DeepPartial,
  DeployTarget,
  IconPosition,
  ListEdits,
  SearchBoxOptions,
  SearchIconOptions,
  NodeChange,
  PageSeo,
  PostRecord,
  ProcessedImage,
  SavePostResult,
  ScheduleInput,
  Selection,
  SiteSettings,
  SyncSetup,
  SyncSource
} from '../shared/types'

/** Registers the secret fields of a form sent from the window (connection, sync setup). */
function registerFormSecrets(value: object): void {
  for (const [name, field] of Object.entries(value)) if (isSecretField(name)) registerSecrets(field)
}

// ---------- Workspace ----------

let watcher: FSWatcher | null = null
let rescanTimer: NodeJS.Timeout | null = null

/** Rescans when files change outside the app (an editor, git, a build). */
function watchWorkspace(root: string): void {
  watcher?.close()
  try {
    watcher = watch(root, { recursive: true }, (_event, file) => {
      const name = String(file ?? '')
      if (name.startsWith('.sitecms') || name.startsWith('.git')) return
      if (rescanTimer) clearTimeout(rescanTimer)
      rescanTimer = setTimeout(() => {
        if (getWorkspace()?.root === root)
          scanWorkspace(root)
            .then(setWorkspace)
            .catch(() => {})
      }, 300)
    })
  } catch {
    watcher = null // recursive watch unsupported: the UI still works, it just won't auto-refresh.
  }
}

export async function openWorkspace(root: string): Promise<void> {
  await settings.migrateDeploy(root).catch(() => {})
  const workspace = await scanWorkspace(root)
  setWorkspace(workspace)
  watchWorkspace(root)
  await settings.rememberProject(root)
  scheduler.changed(root)
}

onWorkspaceSwitch((workspace) => {
  drafts.loadDrafts(workspace?.root ?? null).catch(() => {})
  notifyProjectSwitched(workspace)
  clearSessions()
  proposals.clearProposals()
  setSelection(null)
  // Presence and other computers' syncs, for the project now open.
  if (workspace) sync.startLive(workspace.root).catch(() => {})
  else sync.stopLive()
})

// ---------- MCP ----------

export async function applyMcpSettings(): Promise<void> {
  const { mcp } = await settings.getAppSettings()
  if (mcp.enabled) await startMcp(mcp.port, await settings.getMcpToken())
  else await stopMcp()
}

// ---------- Cloudflare ----------

/** The open project's deploy connection (each project can deploy to a different account). */
const credentials = (): Promise<cloudflare.Credentials> => credentialsFor(requireRoot())

// ---------- Blog posts ----------

let postPreview: StaticServer | null = null

/** Saves a post; if it is or was published, the blog pages in the site are regenerated too. */
/**
 * Saves a post. Posts are HTML pages, so saving always goes through the blog
 * generator: a draft becomes a page in .sitecms/drafts, a published post a page
 * on the site, with lists, feed and redirects updated in the same undoable step.
 */
/** After switchers change: blog pages take them from the layouts, then search and Pages refresh. */
async function afterSwitcher(root: string, result: SearchChange): Promise<SearchChange> {
  if (result.pages.length) {
    await generateBlog(root).catch(() => null)
    await refreshSearch(root).catch(() => null)
    setWorkspace(await scanWorkspace(root))
  }
  return result
}

async function savePost(post: PostRecord): Promise<SavePostResult> {
  const root = requireRoot()
  const valid = await posts.validatePost(root, post)
  const generated = await generateBlog(root, { upsert: valid })
  await refreshSearch(root).catch(() => null)
  setWorkspace(await scanWorkspace(root))
  scheduler.changed(root)
  return { post: valid, generated }
}

// ---------- Interact mode ----------

async function pickImage(event: IpcMainInvokeEvent, title: string): Promise<string | null> {
  return (await pickImages(event, title, false))[0] ?? null
}

async function pickImages(
  event: IpcMainInvokeEvent,
  title: string,
  multiple = true
): Promise<string[]> {
  const window = BrowserWindow.fromWebContents(event.sender)
  const options = {
    title,
    properties: multiple
      ? ['openFile' as const, 'multiSelections' as const]
      : ['openFile' as const],
    filters: [
      {
        name: 'Images',
        extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'avif', 'tif', 'tiff', 'heic']
      }
    ]
  }
  const result = window
    ? await dialog.showOpenDialog(window, options)
    : await dialog.showOpenDialog(options)
  return result.canceled ? [] : result.filePaths
}

let externalScripts = false

/** Whether preview iframes may load remote scripts (off unless the user opts in). */
export const allowExternalScripts = (): boolean => externalScripts

// ---------- Registration ----------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler = (event: IpcMainInvokeEvent, ...args: any[]) => unknown

export function registerIpc(appIcon: string): void {
  const handlers: Record<string, Handler> = {
    'workspace:pick': async (event) => {
      const window = BrowserWindow.fromWebContents(event.sender)
      const options = { properties: ['openDirectory' as const], title: 'Open site folder' }
      const result = window
        ? await dialog.showOpenDialog(window, options)
        : await dialog.showOpenDialog(options)
      if (result.canceled || result.filePaths.length === 0) return null
      await openWorkspace(result.filePaths[0])
      return getWorkspace()
    },
    'workspace:get': () => getWorkspace(),
    'log:show': () => shell.showItemInFolder(logFile()),
    'log:copy': () => {
      const text = readLogTail()
      clipboard.writeText(text)
      return text.length > 0
    },
    'settings:app:get': () => settings.getAppSettingsView(),
    'settings:app:save': async (_event, patch: DeepPartial<AppSettings>) => {
      const before = await settings.getAppSettings()
      const wasMcp = { ...before.mcp }
      const next = await settings.saveAppSettings(patch)
      if (next.mcp.enabled !== wasMcp.enabled || next.mcp.port !== wasMcp.port)
        await applyMcpSettings()
      if (patch.background) await applyBackgroundSettings(appIcon)
      return settings.getAppSettingsView()
    },
    'connections:list': () => settings.listConnections(),
    'connections:save': (_event, input: ConnectionInput) => settings.saveConnection(input),
    'connections:delete': (_event, id: string) => settings.deleteConnection(id),
    'connections:test': async (_event, id: string) => {
      const creds = await settings.connectionById(id)
      const [found, pages, r2] = await Promise.allSettled([
        workers.listWorkers(creds),
        cloudflare.listProjects(creds),
        cloudflare.r2Access(creds)
      ])
      if (found.status === 'rejected' && pages.status === 'rejected') throw found.reason
      return {
        workers: found.status === 'fulfilled' ? found.value.length : null,
        pages: pages.status === 'fulfilled' ? pages.value.length : null,
        r2: r2.status === 'fulfilled' ? r2.value : 'missing'
      }
    },

    'dialog:pick-file': async (event, title: string) => {
      const window = BrowserWindow.fromWebContents(event.sender)
      const options = {
        title,
        // SSH keys live in ~/.ssh, a hidden folder.
        properties: ['openFile' as const, 'showHiddenFiles' as const],
        defaultPath: join(homedir(), '.ssh')
      }
      const result = window
        ? await dialog.showOpenDialog(window, options)
        : await dialog.showOpenDialog(options)
      return result.canceled ? null : (result.filePaths[0] ?? null)
    },
    'connections:check-server': async (_event, input: ConnectionInput, dir?: string) => {
      const fields = settings.serverFields(input)
      const saved = input.id
        ? (await settings.listConnections()).connections.find((c) => c.id === input.id)
        : undefined
      const sameServer = saved && saved.host === fields.host && saved.port === fields.port
      const connection = {
        id: input.id ?? '',
        type: input.type,
        name: input.name,
        accountId: '',
        ...fields,
        hostKey: sameServer ? saved.hostKey : undefined,
        token: input.token || (input.id ? await settings.connectionSecret(input.id) : '')
      }
      return checkServer(connection, dir, (key) => {
        if (input.id && sameServer) settings.trustHostKey(input.id, key).catch(() => null)
      })
    },

    'projects:recent': async () => {
      const { recentProjects } = await settings.getAppSettings()
      const found = await Promise.all(
        recentProjects.map(async (project) => {
          try {
            if (!(await stat(project.path)).isDirectory()) return null
          } catch {
            return null // moved or deleted: not shown
          }
          const drafts = await readFile(join(project.path, settings.APP_DIR, 'drafts.json'), 'utf8')
            .then((text) => Object.keys(JSON.parse(text)).length)
            .catch(() => 0)
          const site = await settings.getSiteSettings(project.path).catch(() => null)
          return {
            ...project,
            name: site?.siteName.trim() || project.name,
            unsavedPages: drafts,
            deployProject: site ? settings.deployTarget(site) : ''
          }
        })
      )
      return found.filter(Boolean)
    },
    'projects:open': async (_event, path: string) => {
      if (!(await stat(path)).isDirectory()) throw new Error(`${path} is not a folder`)
      await openWorkspace(path)
      return getWorkspace()
    },
    'projects:forget': (_event, path: string) => settings.forgetProject(path),
    'settings:site:get': () => settings.getSiteSettings(requireRoot()),
    'settings:site:save': async (_event, patch: DeepPartial<SiteSettings>) => {
      const saved = await settings.saveSiteSettings(requireRoot(), patch)
      // The site name shows in the sidebar and the project switcher.
      setWorkspace(await scanWorkspace(requireRoot()))
      return saved
    },

    'page:edit': (_event, path: string) => startEditing(path),
    'sync:status': () => sync.syncStatus(requireRoot()),
    'sync:enable': async (_event, setup: SyncSetup) => {
      const root = requireRoot()
      const result = await sync.enableSync(root, setup)
      setWorkspace(await scanWorkspace(root))
      return result
    },
    'sync:disable': () => sync.disableSync(requireRoot()),
    'sync:now': async () => {
      const root = requireRoot()
      const result = await sync.syncNow(root)
      if (result.pulled) {
        setWorkspace(await scanWorkspace(root))
        await refreshSearch(root).catch(() => null)
      }
      return result
    },
    'sync:announce': (_event, page: string | null, mode: string | null) =>
      sync.announce(page, mode),
    'sync:projects': (_event, source: SyncSource) => sync.listProjects(source),
    'sync:get': async (event, source: SyncSource, project: string) => {
      const window = BrowserWindow.fromWebContents(event.sender)
      const options = {
        title: 'Choose an empty folder for the project',
        buttonLabel: 'Download here',
        properties: ['openDirectory' as const, 'createDirectory' as const]
      }
      const result = window
        ? await dialog.showOpenDialog(window, options)
        : await dialog.showOpenDialog(options)
      const folder = result.canceled ? null : result.filePaths[0]
      if (!folder) return null
      if ((await readdir(folder)).some((name) => name !== '.DS_Store'))
        throw new Error('Choose an empty folder: the project is downloaded into it.')
      await sync.getProject(source, project, folder)
      await openWorkspace(folder)
      return getWorkspace()
    },
    'sync:take-theirs': async (_event, path: string) => {
      const root = requireRoot()
      await sync.takeTheirs(root, path)
      setWorkspace(await scanWorkspace(root))
    },
    'versions:list': () => snapshots.summaries(requireRoot()),
    'versions:details': (_event, id: string) => snapshots.details(requireRoot(), id),
    'versions:restore': async (_event, id: string) => {
      const root = requireRoot()
      if (drafts.hasAnyDrafts())
        throw new Error('Save or discard your unsaved edits first: restoring replaces page files.')
      const result = await snapshots.restoreSnapshot(root, id)
      setWorkspace(await scanWorkspace(root))
      await refreshSearch(root).catch(() => null)
      return result
    },
    'versions:export': async (event, id: string) => {
      const window = BrowserWindow.fromWebContents(event.sender)
      const options = {
        title: 'Save this version as a folder',
        buttonLabel: 'Save here',
        properties: ['openDirectory' as const, 'createDirectory' as const]
      }
      const result = window
        ? await dialog.showOpenDialog(window, options)
        : await dialog.showOpenDialog(options)
      const folder = result.canceled ? null : result.filePaths[0]
      if (!folder) return null
      return { folder, files: await snapshots.exportSnapshot(requireRoot(), id, folder) }
    },
    'code:read': (_event, path: string) => code.readSource(requireRoot(), path),
    'code:assets': (_event, path: string) => code.pageAssets(requireRoot(), path),
    'code:asset-usage': (_event, files: string[]) => code.assetUsage(requireRoot(), files),
    'code:preview': (_event, path: string, text: string) => code.previewSource(path, text),
    'code:save': async (_event, path: string, text: string, baseHash: string) => {
      const root = requireRoot()
      const result = await code.saveSource(root, path, text, baseHash)
      setWorkspace(await scanWorkspace(root))
      if (/\.html?$/i.test(path)) await refreshSearch(root).catch(() => null)
      return result
    },
    'draft:set': (_event, path: string, hash: string, changes: NodeChange[], lists?: ListEdits) =>
      drafts.setDraft(path, hash, changes, lists),
    'draft:scope': (_event, path: string, id: string, scope: ComponentScope) =>
      drafts.setComponentScope(path, id, scope),
    'draft:seo:get': (_event, path: string) => drafts.getSeo(path),
    'draft:seo:set': (_event, path: string, seo: PageSeo | null) => drafts.setSeoDraft(path, seo),
    'draft:state': () => drafts.draftState(),
    'draft:save-all': async () => {
      const result = await drafts.saveAll()
      await refreshSearch(requireRoot()).catch(() => null)
      setWorkspace(await scanWorkspace(requireRoot()))
      return result
    },
    'draft:discard': (_event, path: string | null) => drafts.discardDrafts(path),
    'schedule:drafts': (_event, input: ScheduleInput) => scheduler.scheduleDrafts(input),
    'schedule:get': () => scheduler.scheduleOverview(requireRoot()),
    'schedule:release': (_event, id: string, force?: boolean) =>
      scheduler.releaseNow(id, Boolean(force)),
    'schedule:end': (_event, id: string, force?: boolean) =>
      scheduler.endRelease(id, Boolean(force)),
    'schedule:cancel': (_event, id: string) => scheduler.cancelRelease(id),
    'history:revert': async (_event, id: string) => {
      await revert(requireRoot(), id)
      await refreshSearch(requireRoot()).catch(() => null)
      setWorkspace(await scanWorkspace(requireRoot()))
    },
    'images:list': async () => media.listImages(requireRoot(), (await previewServer()).origin),
    'images:optimize': async (_event, paths: string[], apply: boolean) => {
      const result = await media.optimizeImages(requireRoot(), paths, apply)
      if (result.historyId) setWorkspace(await scanWorkspace(requireRoot()))
      return result
    },
    'image:replace': async (event, path: string) => {
      const file = await pickImage(event, 'Replace with…')
      if (!file) return null
      const result = await media.replaceImage(requireRoot(), path, file)
      setWorkspace(await scanWorkspace(requireRoot()))
      return result
    },
    'image:delete': async (_event, path: string) => {
      const result = await media.deleteImage(requireRoot(), path)
      setWorkspace(await scanWorkspace(requireRoot()))
      return result
    },
    'images:dimensions': async (_event, paths?: string[]) =>
      media.addImageDimensions(requireRoot(), paths),
    'images:upload': async (event) => {
      const root = requireRoot()
      const files = await pickImages(event, 'Upload images')
      const site = await settings.getSiteSettings(root)
      const uploaded: ProcessedImage[] = []
      for (const file of files) uploaded.push(await importImage(root, site, file))
      if (uploaded.length) setWorkspace(await scanWorkspace(root))
      return uploaded
    },
    'image:import': async (event) => {
      const root = requireRoot()
      const file = await pickImage(event, 'Upload an image')
      if (!file) return null
      return importImage(root, await settings.getSiteSettings(root), file)
    },
    'interact:url': (_event, path: string) => interactUrl(path),
    'interact:external': (_event, allow: boolean) => {
      externalScripts = allow
    },
    'preview:url': (_event, path: string) => previewUrl(path),
    'shell:open': (_event, url: string) => {
      if (!/^https?:\/\//.test(url)) throw new Error('Only web links can be opened')
      return shell.openExternal(url)
    },
    'selection:report': (_event, selection: Selection | null) => setSelection(selection),

    'blog:setup': () =>
      blogSetup(getWorkspace() ?? { root: requireRoot(), name: '', folder: '', pages: [] }),
    'blog:templates': async (_event, templates: BlogTemplates) => {
      await saveTemplates(requireRoot(), templates)
      return blogSetup(getWorkspace()!)
    },

    'search:get': () => search.searchState(requireRoot()),
    'search:enable': (_event, box: SearchBoxOptions) => search.enableSearch(requireRoot(), box),
    'search:disable': () => search.disableSearch(requireRoot()),
    'search:rebuild': async () => (await refreshSearch(requireRoot())) ?? { pages: 0, bytes: 0 },
    'search:icon-markup': (_event, icon: SearchIconOptions) => search.iconMarkup(icon),
    'search:place-icon': (
      _event,
      path: string,
      locator: ElementLocator,
      position: IconPosition,
      scope: 'all' | 'page',
      icon: SearchIconOptions,
      enableWith?: SearchBoxOptions | null
    ) => search.placeIcon(requireRoot(), path, locator, position, scope, icon, enableWith),
    'search:update-icons': (_event, icon: SearchIconOptions) =>
      search.updateIcons(requireRoot(), icon),
    'search:exclude': (_event, path: string, excluded: boolean) =>
      search.setExcluded(requireRoot(), path, excluded),

    'seo:audit': () => seoSite.auditSite(requireRoot()),
    'languages:state': () => languages.languagesState(requireRoot()),
    'languages:save': async (_event, list: SiteLanguage[]) => {
      const root = requireRoot()
      await settings.saveSiteSettings(root, { languages: list })
      return languages.languagesState(root)
    },
    'languages:update': async () => {
      const result = await languages.updateLanguagePages(requireRoot())
      if (result.changed.length) setWorkspace(await scanWorkspace(requireRoot()))
      return result
    },
    'languages:copy': async (_event, code: string, paths: string[]) => {
      const result = await translations.copyToLanguage(requireRoot(), code, paths)
      if (result.created.length) setWorkspace(await scanWorkspace(requireRoot()))
      return result
    },
    'languages:grid': () => translations.translationsGrid(requireRoot()),
    'switcher:state': () => switcher.switcherState(requireRoot()),
    'switcher:preview': async (
      _event,
      path: string,
      look: SwitcherLook,
      labels?: SiteLanguage[]
    ) => {
      const root = requireRoot()
      const saved = await settings.getSiteSettings(root)
      // Labels and flags as edited, before they're saved.
      const site = labels ? { ...saved, languages: settings.checkLanguages(labels) } : saved
      const { code, links } = languages.switcherTarget(await languages.analyze(root, site))(path)
      return switcher.switcherMarkup(site, look, code, links, true)
    },
    'switcher:place': async (
      _event,
      path: string,
      locator: ElementLocator,
      position: IconPosition,
      scope: 'all' | 'page',
      look: SwitcherLook
    ) => {
      const root = requireRoot()
      const site = await settings.getSiteSettings(root)
      const targets = languages.switcherTarget(await languages.analyze(root, site))
      const result = await switcher.placeSwitcher(
        root,
        path,
        locator,
        position,
        scope,
        look,
        targets
      )
      return afterSwitcher(root, result)
    },
    'switcher:restyle': async (_event, look: SwitcherLook) => {
      const root = requireRoot()
      const site = await settings.getSiteSettings(root)
      const targets = languages.switcherTarget(await languages.analyze(root, site))
      return afterSwitcher(root, await switcher.restyleSwitchers(root, look, targets))
    },
    'switcher:remove': async () =>
      afterSwitcher(requireRoot(), await switcher.removeSwitchers(requireRoot())),
    'languages:page': (_event, path: string) => translations.pageLanguage(requireRoot(), path),
    'languages:mark': (_event, paths: string[]) =>
      translations.markTranslated(requireRoot(), paths),
    'languages:original': (_event, path: string, selector: string) =>
      translations.originalText(requireRoot(), path, selector),
    'languages:changes': (_event, path: string) => translations.sourceChanges(requireRoot(), path),
    'seo:sitemap': async () => {
      const result = await seoSite.writeSitemap(requireRoot())
      setWorkspace(await scanWorkspace(requireRoot()))
      return result
    },
    'seo:robots:get': () => seoSite.readRobots(requireRoot()),
    'seo:robots:save': (_event, text: string) => seoSite.saveRobots(requireRoot(), text),
    'seo:identity:get': () => seoSite.siteIdentity(requireRoot()),
    'seo:identity:add': async (_event, identity: { name: string; url: string; logo: string }) => {
      const added = await seoSite.addSiteIdentity(requireRoot(), identity)
      return { identity: await seoSite.siteIdentity(requireRoot()), added }
    },
    'seo:sitemap:status': () => seoSite.sitemapStatus(requireRoot()),

    'deploy:unpublished': async () => {
      const root = requireRoot()
      const site = await settings.getSiteSettings(root)
      const pages = getWorkspace()?.pages ?? []
      return Object.fromEntries(
        pages
          .map((page) => [page.path, excludedBy(site.deploy.exclude, page.path)] as const)
          .filter(([, pattern]) => pattern !== null)
      )
    },
    'deploy:set-published': async (_event, path: string, published: boolean) => {
      const root = requireRoot()
      const site = await settings.getSiteSettings(root)
      const own = pagePattern(path)
      const exclude = published
        ? site.deploy.exclude.filter((pattern) => pattern !== own && pattern !== path)
        : [...site.deploy.exclude.filter((pattern) => pattern !== own), own]
      const other = published ? excludedBy(exclude, path) : null
      if (other)
        throw new Error(
          `${path} is left out by the pattern “${other}” in Project settings → Deploy → Never upload. Change it there.`
        )
      await settings.saveSiteSettings(root, { deploy: { exclude } })
    },

    'point:start': (_event, path: string) => pointing.startPointing(path),
    'point:at': (_event, key: string, n: number) => pointing.pointAt(key, n),
    'point:resolve': (_event, key: string, locators: ElementLocator[]) =>
      pointing.resolveLocators(key, locators),
    'point:within': (_event, key: string, ancestor: number, n: number) =>
      pointing.pathWithin(key, ancestor, n),
    'point:numbers-within': (_event, key: string, ancestor: number, paths: number[][]) =>
      pointing.numbersWithin(key, ancestor, paths),
    'blog:preview': () => previewBlog(),

    'posts:list': () => posts.listPosts(requireRoot()),
    'blog:generated': () => generatedFiles(requireRoot()),
    'blog:layout-links': (_event, planned?: boolean) => layoutLinks(requireRoot(), !!planned),
    'blog:create': async (_event, fixLinks: boolean) => {
      const root = requireRoot()
      const generated = await generateBlog(root)
      const links = fixLinks ? await fixLayoutLinks(root) : null
      await refreshSearch(root).catch(() => null)
      setWorkspace(await scanWorkspace(root))
      return { generated, links }
    },
    'blog:view-url': (_event, path: string) => viewUrl(path),
    'blog:fix-layout-links': async () => {
      const root = requireRoot()
      const result = await fixLayoutLinks(root)
      if (result.historyId) {
        await refreshSearch(root).catch(() => null)
        setWorkspace(await scanWorkspace(root))
      }
      return result
    },
    'blog:layout-pages': async () => {
      const templates = await readTemplates(requireRoot())
      return { post: templates?.post ?? null, list: templates?.list ?? null }
    },
    'posts:get': (_event, id: string) => posts.getPost(requireRoot(), id),
    'posts:new': () => posts.newPost(),
    'posts:save': (_event, post: PostRecord) => savePost(post),
    'posts:translate': async (_event, id: string, code: string) => {
      const draft = await posts.translationDraft(requireRoot(), id, code)
      // An existing translation is opened as it is; a new one is saved as a draft first.
      const stored = await posts.readPosts(requireRoot())
      if (stored.some((post) => post.record.id === draft.id)) return draft
      return (await savePost(draft)).post
    },
    'posts:delete': async (_event, id: string) => {
      const root = requireRoot()
      const generated = await generateBlog(root, { remove: id })
      await refreshSearch(root).catch(() => null)
      setWorkspace(await scanWorkspace(root))
      scheduler.changed(root)
      return generated
    },
    'posts:preview': async (_event, post: PostRecord) => {
      const root = requireRoot()
      const site = await settings.getSiteSettings(root)
      const draft = {
        ...post,
        title: post.title.trim() || 'Untitled',
        slug: post.slug || 'preview'
      }
      const url = postPath(siteForPost(site, draft).blog.permalink, draft.slug)
      const overlay = new Map([[fileOfPath(url), await buildPostPage(root, draft)]])
      await postPreview?.close()
      postPreview = await startStaticServer({
        getRoot: () => getWorkspace()?.root ?? null,
        overlay
      })
      return postPreview.origin + url
    },
    'gist:fetch': (_event, url: string) => fetchGist(url),
    'forms:accounts': () => craftforms.listFormsAccounts(),
    'forms:connect': () => craftforms.connectFormsAccount(),
    'forms:cancel-connect': () => craftforms.cancelFormsConnect(),
    'forms:account-info': (_event, id: string) => craftforms.formsAccountInfo(id),
    'forms:disconnect': (_event, id: string) => craftforms.disconnectFormsAccount(id),
    'forms:project': () => craftforms.formsProject(requireRoot()),
    'forms:set-project': (
      _event,
      patch: { account?: string; domain?: string; siteAddress?: boolean }
    ) => craftforms.setFormsProject(requireRoot(), patch),
    'forms:list': (_event, domain?: string) => craftforms.formsList(requireRoot(), domain),
    'forms:ensure': (_event, formId: string, domain: string) =>
      craftforms.ensureFormEmbed(requireRoot(), formId, domain),
    'forms:release': (_event, formId: string, domain: string) =>
      craftforms.releaseFormEmbed(requireRoot(), formId, domain),
    'forms:preview-url': (
      _event,
      target: { formId?: string; key?: string },
      page: string,
      styles: 'site' | 'form'
    ) => formPreviewUrl(target, page, styles),
    'forms:update-embed': (
      _event,
      path: string,
      index: number,
      patch: Partial<FormsEmbedSettings> & { key?: string }
    ) => craftforms.updateFormEmbed(requireRoot(), path, index, patch),
    'forms:remove-embed': (_event, path: string, index: number) =>
      craftforms.removeFormEmbed(requireRoot(), path, index),
    'forms:add-loader': (_event, path: string, loaderUrl: string) =>
      craftforms.addFormLoader(requireRoot(), path, loaderUrl),
    'forms:change-form': (_event, path: string, index: number, formId: string) =>
      craftforms.changeEmbedForm(requireRoot(), path, index, formId),
    'forms:change-website': (_event, path: string, index: number, domain: string) =>
      craftforms.changeEmbedWebsite(requireRoot(), path, index, domain),
    'forms:release-website': (_event, domain: string) =>
      craftforms.releaseFormsWebsite(requireRoot(), domain),
    'forms:preview-markup': (_event, formId: string) =>
      craftforms.formPreviewMarkup(requireRoot(), formId),
    'forms:insert': async (
      _event,
      path: string,
      locator: ElementLocator,
      position: IconPosition,
      formId: string,
      domain: string
    ) => {
      const result = await craftforms.insertForm(
        requireRoot(),
        path,
        locator,
        position,
        formId,
        domain
      )
      setWorkspace(await scanWorkspace(requireRoot()))
      return result
    },
    'posts:regenerate': async () => {
      const root = requireRoot()
      const generated = await generateBlog(root)
      await refreshSearch(root).catch(() => null)
      setWorkspace(await scanWorkspace(root))
      return generated
    },
    'image:import-data': async (_event, name: string, data: Uint8Array) => {
      const root = requireRoot()
      const dir = await mkdtemp(join(tmpdir(), 'craftpages-'))
      const file = join(dir, basename(name).replace(/[^\w.-]+/g, '-') || 'image')
      await writeFile(file, Buffer.from(data))
      return importImage(root, await settings.getSiteSettings(root), file)
    },

    'components:scan': () => {
      const root = requireRoot()
      return scanComponents(
        root,
        getWorkspace()!.pages.map((page) => page.path)
      )
    },

    'cf:projects': async () => cloudflare.listProjects(await credentials()),
    'cf:workers': async () => workers.listWorkers(await credentials()).catch(() => null),
    'cf:project:create': async (_event, name: string) => {
      const root = requireRoot()
      const site = await settings.getSiteSettings(root)
      const project = await cloudflare.createProject(
        await credentials(),
        name,
        site.deploy.productionBranch
      )
      await settings.saveSiteSettings(root, { deploy: { projectName: project.name } })
      return project
    },
    'cf:status': async () => {
      const root = requireRoot()
      return cloudflare.deployStatus(root, await settings.getSiteSettings(root))
    },
    'cf:deploy': (_event, target: DeployTarget, force?: boolean) =>
      deployProject(requireRoot(), target, force === true),
    'cf:check-live': () => checkLive(requireRoot()),
    'update:get': () => updateState(),
    'update:check': () => checkForUpdate(),
    'update:install': () => installUpdate(),
    'cf:deployments': () => listDeploymentsFor(requireRoot()),
    'cf:rollback': (_event, id: string) => rollbackFor(requireRoot(), id),

    'mcp:status': () => mcpStatus(),
    'mcp:regenerate-token': async () => {
      setToken(await settings.regenerateMcpToken())
      return mcpStatus()
    },
    'mcp:auto-accept': (_event, on: boolean) => {
      proposals.setAutoAccept(on)
      broadcastMcpStatus()
      return mcpStatus()
    },
    'proposals:list': () => proposals.listProposals(),
    'proposals:accept': (_event, id: string) => proposals.acceptProposal(id),
    'proposals:reject': (_event, id: string, reason?: string) =>
      proposals.rejectProposal(id, reason),
    'proposals:revert': async (_event, id: string) => {
      await proposals.revertProposal(id)
      setWorkspace(await scanWorkspace(requireRoot()))
    },
    'proposals:preview-url': (_event, id: string, path: string) => proposalPreviewUrl(id, path)
  }

  for (const [channel, handler] of Object.entries(handlers))
    ipcMain.handle(channel, async (event, ...args: unknown[]) => {
      // Passwords and passphrases typed into a form never reach the log, even unsaved.
      for (const arg of args) if (arg && typeof arg === 'object') registerFormSecrets(arg)
      try {
        return await handler(event, ...args)
      } catch (error) {
        log.warn('ipc', `${channel} failed`, error)
        throw error
      }
    })
}
