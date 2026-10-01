import { BrowserWindow, dialog, ipcMain, shell, type IpcMainInvokeEvent } from 'electron'
import { watch, type FSWatcher } from 'fs'
import { mkdtemp, readFile, stat, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { basename, join } from 'path'
import * as cloudflare from './deploy/cloudflare'
import { blogSetup, previewBlog, saveTemplates } from './blog'
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
import * as pointing from './pointing'
import * as seoSite from './seo-site'
import * as search from './search-site'
import { refreshSearch } from './search-site'
import * as drafts from './drafts'
import { clearSessions, interactUrl, previewServer, previewUrl, startEditing } from './editing'
import { scanComponents } from './html/components'
import { revert } from './history'
import { importImage } from './images'
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
import * as settings from './settings'
import { getWorkspace, onWorkspaceSwitch, requireRoot, setWorkspace } from './state'
import { scanWorkspace } from './workspace'
import type {
  AppSettings,
  BlogTemplates,
  ConnectionInput,
  ComponentScope,
  ElementLocator,
  DeepPartial,
  DeployTarget,
  IconPosition,
  ListEdits,
  SearchBoxOptions,
  SearchIconOptions,
  NodeChange,
  PageSeo,
  PostRecord,
  SavePostResult,
  ScheduleInput,
  Selection,
  SiteSettings
} from '../shared/types'

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
  const window = BrowserWindow.fromWebContents(event.sender)
  const options = {
    title,
    properties: ['openFile' as const],
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
  return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0]
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
      const [found, pages] = await Promise.allSettled([
        workers.listWorkers(creds),
        cloudflare.listProjects(creds)
      ])
      if (found.status === 'rejected' && pages.status === 'rejected') throw found.reason
      return {
        workers: found.status === 'fulfilled' ? found.value.length : null,
        pages: pages.status === 'fulfilled' ? pages.value.length : null
      }
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
    'images:dimensions': async () => media.addImageDimensions(requireRoot()),
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
    'seo:sitemap': async () => {
      const result = await seoSite.writeSitemap(requireRoot())
      setWorkspace(await scanWorkspace(requireRoot()))
      return result
    },
    'seo:robots:get': () => seoSite.readRobots(requireRoot()),
    'seo:robots:save': (_event, text: string) => seoSite.saveRobots(requireRoot(), text),
    'seo:identity:get': () => seoSite.siteIdentity(requireRoot()),
    'seo:identity:add': async (_event, identity: { name: string; url: string; logo: string }) => {
      await seoSite.addSiteIdentity(requireRoot(), identity)
      return seoSite.siteIdentity(requireRoot())
    },

    'point:start': (_event, path: string) => pointing.startPointing(path),
    'point:at': (_event, key: string, n: number) => pointing.pointAt(key, n),
    'point:resolve': (_event, key: string, locators: ElementLocator[]) =>
      pointing.resolveLocators(key, locators),
    'point:within': (_event, key: string, ancestor: number, n: number) =>
      pointing.pathWithin(key, ancestor, n),
    'blog:preview': () => previewBlog(),

    'posts:list': () => posts.listPosts(requireRoot()),
    'blog:generated': () => generatedFiles(requireRoot()),
    'posts:get': (_event, id: string) => posts.getPost(requireRoot(), id),
    'posts:new': () => posts.newPost(),
    'posts:save': (_event, post: PostRecord) => savePost(post),
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
      const url = postPath(site.blog.permalink, draft.slug)
      const overlay = new Map([[fileOfPath(url), await buildPostPage(root, draft)]])
      await postPreview?.close()
      postPreview = await startStaticServer({
        getRoot: () => getWorkspace()?.root ?? null,
        overlay
      })
      return postPreview.origin + url
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

  for (const [channel, handler] of Object.entries(handlers)) ipcMain.handle(channel, handler)
}
