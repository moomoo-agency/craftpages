export type ThemeSource = 'system' | 'light' | 'dark'

export interface PageEntry {
  /** Path relative to the workspace root, always with forward slashes. */
  path: string
  title: string
  bytes: number
}

export interface Workspace {
  root: string
  /** The site's name (Project settings), shown in the app. */
  name: string
  /** Folder name: the stable id the AI connection names the project by. */
  folder: string
  pages: PageEntry[]
}

// ---------- Settings ----------

export interface RecentProject {
  path: string
  name: string
  openedAt: string
}

/** App-wide settings, stored in the user data folder. Secrets live in the keychain. */
export interface AppSettings {
  mcp: { enabled: boolean; port: number }
  lastWorkspace: string | null
  recentProjects: RecentProject[]
  /** Deploy connections (accounts); each project picks one. */
  connections: DeployConnection[]
  background: {
    /** While anything is scheduled, closing the window leaves the app running in the menu bar / tray. */
    keepRunning: boolean
    /** Start hidden at login, so scheduled changes go out after a restart too. */
    openAtLogin: boolean
  }
}

/** Only Cloudflare Pages for now; Netlify, GitHub Pages and SFTP are planned. */
export type DeployConnectionType = 'cloudflare-pages'

/** A place sites deploy to: an account and its token (in the keychain, by `id`). */
export interface DeployConnection {
  id: string
  type: DeployConnectionType
  /** Shown in pickers, e.g. "My Cloudflare" or "Acme (client)". */
  name: string
  accountId: string
}

export interface DeployConnectionView extends DeployConnection {
  hasToken: boolean
  /** Recent projects that deploy through it. */
  usedBy: string[]
}

export interface ConnectionsView {
  connections: DeployConnectionView[]
  /** False when the OS offers no keychain; tokens then last only until quit. */
  keychainAvailable: boolean
}

/** Saving a connection: no `id` creates one. `token` undefined keeps the stored one. */
export interface ConnectionInput {
  id?: string
  type: DeployConnectionType
  name: string
  accountId: string
  token?: string
}

export type AppSettingsView = AppSettings

/** A recent project that still exists where it was last opened. */
export interface RecentProjectView extends RecentProject {
  unsavedPages: number
  deployProject: string
}

/** Per-site settings, stored in `.sitecms/site.json` inside the site folder. */
export interface SiteSettings {
  /** Stable id of this project, used to find its secrets in the keychain even after a move. */
  id: string
  siteName: string
  /** Canonical origin, e.g. https://example.com (no trailing slash). */
  baseUrl: string
  locale: string
  deploy: {
    /** The deploy connection (app-wide account) this project uses: yours or a client's. */
    connection: string
    /** Workers static assets (Cloudflare's default for new projects) or Pages. */
    target: DeployKind
    /** Cloudflare Pages project in that account (target "pages"). */
    projectName: string
    /** Worker the site is published as (target "workers"); created on the first deploy. */
    workerName: string
    productionBranch: string
    previewBranch: string
    /** Glob patterns (`*`, `**`) of files never uploaded. No slash = match the file name. */
    exclude: string[]
  }
  images: { maxWidth: number; quality: number; pngToJpeg: boolean; dir: string }
  seo: {
    /** For generated pages (blog): %title% and %site%, e.g. "%title% · %site%". */
    titlePattern: string
    /** Social image for pages and posts without their own (site path, e.g. /assets/og.jpg). */
    defaultImage: string
    /** Rebuild sitemap.xml from all pages on every publish and deploy. */
    sitemapAuto: boolean
    /** Glob patterns of pages left out of the sitemap. */
    sitemapExclude: string[]
  }
  blog: {
    /** Post URL pattern with %postname%: /blog/%postname%/, /%postname%/, /articles/%postname%/ */
    permalink: string
    /** Where the post list lives, e.g. /blog/ */
    listPath: string
    postsPerPage: number
    /** Shown in the list page's heading and title, e.g. "Blog" or "Journal". */
    title: string
    /** When a scheduled post comes due (app open), also deploy to production. */
    scheduleDeploy: boolean
  }
}

export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] }

// ---------- Page editing ----------

export type ComponentScope = 'all' | 'page'

/** A shared component present on the page being edited. */
export interface SessionComponent {
  id: string
  label: string
  /** Pages that have this component, this one included. */
  pages: string[]
  scope: ComponentScope
}

export interface EditSession {
  key: string
  path: string
  /** Hash of the file text the node ids refer to; drafts are tied to it. */
  hash: string
  /** Instrumented copy of the page on the local preview server. */
  url: string
  editable: number
  /** Unsaved edits made on this page. */
  own: NodeChange[]
  /** Unsaved edits to shared components made on other pages, shown here too. */
  inherited: NodeChange[]
  /** Unsaved changes to repeating lists (items added, removed, moved). */
  lists: ListEdits
  components: SessionComponent[]
  /** Set when a draft was dropped because the file changed on disk. */
  warning?: string
}

/**
 * An item of an edited repeating list (cards, team members, testimonials…):
 * original item `from`, or, with `html`, a new item made from a copy of it.
 */
export interface ListItem {
  from: number
  html?: string
}

/** New order of each edited list on a page, by list id. */
export type ListEdits = Record<string, ListItem[]>

/** One edited node, as reported by the editor script inside the preview iframe. */
export interface NodeChange {
  id: string
  html?: string
  /** `null` removes the attribute. */
  attrs?: Record<string, string | null>
}

export interface DraftPage {
  path: string
  /** Edits made on this page. */
  own: number
  /** Edits arriving from shared components edited on other pages. */
  inherited: number
  seo: boolean
}

export interface DraftState {
  pages: DraftPage[]
  /** Pages whose drafts no longer match the file (changed on disk); they are dropped on save. */
  stale: string[]
}

export interface SkippedChange {
  page: string
  component: string
  from: string
}

export interface SaveResult {
  pages: string[]
  historyId: string | null
  /** Shared-component edits not applied on a page because its content there differs. */
  skipped: SkippedChange[]
}

export interface SeoState {
  file: PageSeo
  draft: PageSeo | null
}

export interface ImageEntry {
  path: string
  url: string
  bytes: number
  width: number
  height: number
  /** Pages and stylesheets that mention this file. */
  usedIn: string[]
}

export interface PageSeo {
  title: string
  description: string
  canonical: string
  robots: string
  ogTitle: string
  ogDescription: string
  ogImage: string
}

// ---------- Site search ----------

/** Options of the search box, kept as data-* attributes on the loader's <script> tag. */
export interface SearchBoxOptions {
  /** Any CSS color; empty = neutral. */
  accent: string
  theme: 'auto' | 'light' | 'dark'
  /** Empty = the built-in text in the page's language. */
  placeholder: string
  empty: string
  /** Page URLs shown before typing. */
  suggest: string[]
  /** ⌘K / Ctrl+K and "/" open the box. */
  shortcut: boolean
}

/** Look of the icon button that opens search; written into the button's own markup. */
export interface SearchIconOptions {
  /** One of the built-in icons, or 'custom'. */
  icon: string
  /** Custom SVG (sanitized) when icon is 'custom'. */
  svg: string
  size: number
  stroke: number
  /** CSS colors, e.g. #1f2937, var(--brand), transparent. */
  color: string
  background: string
  radius: number
  padding: number
  /** Accessible name, e.g. "Search". */
  label: string
}

export type IconPosition = 'before' | 'after' | 'start' | 'end'

export interface SearchPageState {
  path: string
  url: string
  title: string
  /** Has the search script. */
  script: boolean
  /** Left out of the index, and why. */
  excluded: '' | 'meta' | 'noindex' | '404'
  /** Elements with data-craftpages-search. */
  triggers: number
}

export interface SearchState {
  /** The script is on at least one page. */
  enabled: boolean
  box: SearchBoxOptions
  /** Look of the first icon found (or the default). */
  icon: SearchIconOptions
  icons: { id: string; label: string; svg: string }[]
  pages: SearchPageState[]
  index: { pages: number; bytes: number } | null
}

export interface SearchChange {
  /** Pages written. */
  pages: string[]
  /** Pages left alone, with the reason. */
  skipped: { path: string; reason: string }[]
  historyId: string | null
}

export interface OptimizeItem {
  path: string
  newPath: string
  before: number
  after: number
  width: number
  height: number
}

export interface OptimizeResult {
  items: OptimizeItem[]
  skipped: { path: string; reason: string }[]
  /** Bytes saved in total (can be negative when only resizing wins). */
  saved: number
  /** Set when the changes were applied (undo entry). */
  historyId: string | null
}

export interface MediaChangeResult {
  /** The image's path after the change. */
  path: string
  /** Files whose references were updated. */
  files: string[]
  historyId: string
}

export interface ProcessedImage {
  src: string
  width: number
  height: number
  bytes: number
  originalBytes: number
  format: string
}

/** What the user clicked in the page editor; pushed to connected AI clients. */
export interface Selection {
  path: string
  selector: string
  tag: string
  text: string
  html: string
}

// ---------- Shared components ----------

export interface ComponentVariant {
  hash: string
  pages: string[]
}

export interface ComponentGroup {
  id: string
  label: string
  tag: string
  /** Every page with an instance; variants split them by exact content. */
  pages: string[]
  variants: ComponentVariant[]
  preview: string
}

// ---------- Blog ----------

/**
 * Points at one element of a template page. `path` is the chain of element-child
 * indices from <body>; tag / id / classes let it be found again if the page shifts.
 */
export interface ElementLocator {
  path: number[]
  tag: string
  id?: string
  classes: string[]
  /** Human label, e.g. `section.cf-band "Privacy Policy…"`. */
  hint: string
}

/** Where a post goes inside the post layout page. */
export interface PostLayout {
  /** Article areas in reading order; more than one when a banner splits the article. */
  regions: ElementLocator[]
  title?: ElementLocator | null
  date?: ElementLocator | null
  image?: ElementLocator | null
  /** Where the post's tag links go. */
  tags?: ElementLocator | null
  /** Drop the rest of the main content (header, footer and nav stay). */
  keepOnly?: boolean
  /** Extra parts of the layout page to leave out. */
  remove?: ElementLocator[]
}

/** Paths are element-child indices inside the card. */
export interface CardFields {
  title?: number[] | null
  excerpt?: number[] | null
  date?: number[] | null
  image?: number[] | null
  link?: number[] | null
}

/** How the list page shows posts. */
export interface ListLayout {
  /** Where the cards go (replaced on each generated list page). */
  container: ElementLocator
  /** An existing card to copy for every post; without one, a simple built-in card is used. */
  card?: { element: ElementLocator; fields: CardFields } | null
  pagination?: ElementLocator | null
  /** Heading that shows the blog title, or the tag on tag pages. */
  heading?: ElementLocator | null
  /** Drop the rest of the main content (header, footer and nav stay). */
  keepOnly?: boolean
  /** Extra parts of the layout page to leave out. */
  remove?: ElementLocator[]
}

/** A "latest posts" block on an existing page (e.g. the home page), updated in place. */
export interface LatestLayout {
  id: string
  page: string
  container: ElementLocator
  card?: { element: ElementLocator; fields: CardFields } | null
  count: number
}

/** Which pages act as the blog's templates, and the pointed-at parts (`.sitecms/templates.json`). */
export interface BlogTemplates {
  /** A page whose layout every post uses. */
  post?: string | null
  /** The page whose layout the post list uses. */
  list?: string | null
  postLayout?: PostLayout | null
  listLayout?: ListLayout | null
  latest?: LatestLayout[]
}

/** A pointing session: a template page served so any element can be clicked. */
export interface PointSession {
  key: string
  url: string
}

/** An element the user clicked in pointing mode. */
export interface PickedElement {
  /** Number of the element in this session's served copy. */
  n: number
  locator: ElementLocator
  tag: string
  text: string
  /** The parent, for "select a wider area"; null at <body>. */
  parent: number | null
  hasImage: boolean
}

export type PostStatus = 'draft' | 'published'

/** A post as stored in `.sitecms/posts/<id>.json`. */
export interface PostRecord {
  id: string
  title: string
  slug: string
  status: PostStatus
  /** Publish date (ISO). */
  date: string
  modified: string
  /** Card text, meta description and feed summary; made from the body when empty. */
  excerpt: string
  cover: { src: string; alt: string } | null
  /** Body as Gutenberg block markup. */
  content: string
  /** `<title>` when it should differ from the post title. */
  seoTitle?: string
  tags?: string[]
}

export interface PostSummary {
  id: string
  title: string
  slug: string
  status: PostStatus
  /** Published with a date still in the future: goes live when the date comes. */
  scheduled: boolean
  date: string
  modified: string
  excerpt: string
  /** Site path, e.g. /blog/my-post/ */
  url: string
  tags: string[]
}

/** What a blog regeneration wrote into the site folder. */
export interface GenerateResult {
  written: string[]
  removed: string[]
  /** Old URL → new URL redirects in the managed block of _redirects. */
  redirects: number
  historyId: string | null
  /** Generated files that were edited by hand and therefore left alone. */
  kept: string[]
}

export interface SavePostResult {
  post: PostRecord
  generated: GenerateResult | null
}

export interface BlogPreview {
  post: string
  list: string
}

/** What the scheduler did in one project when something came due. */
export interface ScheduledRun {
  root: string
  /** Site name, for notifications about a project that isn't open. */
  project: string
  /** Posts now on the site (titles). */
  posts: string[]
  /** Scheduled page changes now on the site (labels). */
  released: string[]
  /** Scheduled page changes taken down at their end time (labels). */
  ended: string[]
  /** Held back because the page changed in the same place since scheduling (labels). */
  blocked: string[]
  deployed: boolean
  error?: string
}

// ---------- Scheduled page changes ----------

export type ReleaseState = 'scheduled' | 'live' | 'done' | 'blocked'

/**
 * Unsaved page edits set aside to go live at a time, and optionally to be
 * taken down again (a promo). Kept in `.sitecms/scheduled/<id>.json`.
 */
export interface PageRelease {
  id: string
  label: string
  createdAt: string
  /** When the changes go live (ISO). */
  at: string
  /** When they are taken down again, or null to keep them. */
  until: string | null
  /** Deploy to production right after going live / being taken down. */
  deploy: boolean
  /** scheduled → live (has an end time) → done; blocked when it couldn't be applied. */
  state: ReleaseState
  pages: string[]
  releasedAt?: string
  endedAt?: string
  /** Why it's blocked, or what went wrong last. */
  message?: string
}

export interface ScheduleInput {
  label: string
  at: string
  until: string | null
  deploy: boolean
}

/** Everything waiting on a time in the open project. */
export interface ScheduleOverview {
  releases: PageRelease[]
  posts: { id: string; title: string; date: string; url: string }[]
  /** A scheduled deploy that failed and is being retried. */
  deployRetry: { since: string; error: string } | null
}

export interface TemplateCandidate {
  path: string
  title: string
  score: number
  /** Why it looks like a post / list page, in plain words. */
  reasons: string[]
}

export interface BlogSetup {
  templates: BlogTemplates | null
  candidates: { post: TemplateCandidate[]; list: TemplateCandidate[] }
}

// ---------- SEO ----------

export interface SeoIssue {
  page: string
  severity: 'error' | 'warning' | 'info'
  kind:
    | 'title'
    | 'description'
    | 'headings'
    | 'images'
    | 'links'
    | 'canonical'
    | 'social'
    | 'language'
    | 'indexing'
  message: string
  /** Examples: the images, links or files concerned. */
  detail?: string[]
}

export interface SeoReport {
  pages: number
  issues: SeoIssue[]
  counts: { error: number; warning: number; info: number }
}

export interface SiteIdentity {
  organization: { name: string; url: string; logo: string } | null
  website: { name: string; url: string } | null
}

// ---------- Deploy ----------

export type DeployTarget = 'preview' | 'production'

export interface DeployProgress {
  phase: 'scan' | 'check' | 'upload' | 'deploy' | 'done' | 'error'
  message: string
  done?: number
  total?: number
}

export interface DeployResult {
  id: string
  url: string
  uploaded: number
  total: number
}

export interface DeployStatus {
  files: number
  changed: number
  lastDeploy: { id: string; url: string; branch: string; at: string } | null
}

export type DeployKind = 'workers' | 'pages'

/** A Worker in the account, and whether CraftPages may publish over it. */
export interface CloudflareWorker {
  name: string
  /** Made by CraftPages, or only static files: safe to replace. */
  usable: boolean
  /** Why not, in plain words. */
  reason?: string
}

export interface CloudflareProject {
  name: string
  subdomain: string
  productionBranch: string
  domains: string[]
}

/**
 * The version Cloudflare is serving now, when it wasn't put live from this folder: published
 * from another computer, with wrangler, or from the Cloudflare dashboard.
 */
export interface ForeignDeploy {
  id: string
  createdOn: string
  /** How it was published, as Cloudflare reports it ("wrangler", "dashboard", "ad_hoc", …). */
  source: string
  /** The account email that published it, when Cloudflare says (Workers only). */
  author: string
}

export interface Deployment {
  id: string
  url: string
  environment: string
  branch: string
  createdOn: string
  status: string
  aliases: string[]
}

// ---------- AI (MCP) ----------

export interface McpStatus {
  running: boolean
  port: number
  url: string
  token: string
  clients: string[]
  error: string | null
  autoAccept: boolean
  /** Ready-to-paste `claude mcp add-json …` line. */
  command: string
}

export interface ProposalFile {
  path: string
  /** `null` = file doesn't exist before / after. */
  before: string | null
  after: string | null
}

export type ProposalStatus = 'pending' | 'accepted' | 'rejected' | 'reverted' | 'failed'

export interface Proposal {
  id: string
  /** Project folder the proposal was made for. */
  root: string
  title: string
  description: string
  client: string
  createdAt: string
  status: ProposalStatus
  reason?: string
  historyId?: string
  files: ProposalFile[]
}

// ---------- Events (main → renderer) ----------

/** New versions of CraftPages (see src/main/updates.ts). */
export interface UpdateState {
  /** The running version. */
  current: string
  /** unsupported: development builds, which never update. */
  status:
    | 'unsupported'
    | 'idle'
    | 'checking'
    | 'current'
    | 'available'
    | 'downloading'
    | 'ready'
    | 'error'
  /** The new version, once one is found. */
  version?: string
  /** Its release page: notes and downloads. */
  url?: string
  /** Download progress, 0–100. */
  percent?: number
  /** The app downloads and installs it (Windows, AppImage); otherwise the user downloads it. */
  installs: boolean
  checkedAt?: string
  error?: string
}

export type AppEvent =
  | { type: 'workspace'; workspace: Workspace | null }
  | { type: 'mcp'; status: McpStatus }
  | { type: 'proposals'; proposals: Proposal[] }
  | { type: 'deploy'; progress: DeployProgress }
  | { type: 'drafts'; drafts: DraftState }
  | { type: 'scheduled'; run: ScheduledRun }
  /** Something scheduled changed in the open project (created, released, cancelled). */
  | { type: 'schedule'; root: string }
  | { type: 'update'; update: UpdateState }

export interface Api {
  // Workspace
  pickWorkspace: () => Promise<Workspace | null>
  getWorkspace: () => Promise<Workspace | null>

  // Settings
  getAppSettings: () => Promise<AppSettingsView>
  saveAppSettings: (patch: DeepPartial<AppSettings>) => Promise<AppSettingsView>
  listConnections: () => Promise<ConnectionsView>
  saveConnection: (input: ConnectionInput) => Promise<DeployConnectionView>
  deleteConnection: (id: string) => Promise<void>
  /** Checks the token: how many Workers and Pages projects it can see (null = no access). */
  testConnection: (id: string) => Promise<{ workers: number | null; pages: number | null }>

  // Projects
  listRecentProjects: () => Promise<RecentProjectView[]>
  openProject: (path: string) => Promise<Workspace>
  forgetProject: (path: string) => Promise<void>
  getSiteSettings: () => Promise<SiteSettings>
  saveSiteSettings: (patch: DeepPartial<SiteSettings>) => Promise<SiteSettings>

  // Page editing (every edit is a draft until saveAll)
  editPage: (path: string) => Promise<EditSession>
  setDraft: (path: string, hash: string, changes: NodeChange[], lists?: ListEdits) => Promise<void>
  setComponentScope: (path: string, componentId: string, scope: ComponentScope) => Promise<void>
  getPageSeo: (path: string) => Promise<SeoState>
  setSeoDraft: (path: string, seo: PageSeo | null) => Promise<void>
  getDrafts: () => Promise<DraftState>
  saveAll: () => Promise<SaveResult>
  /** `null` discards every draft. */
  discardDrafts: (path: string | null) => Promise<void>
  /** Moves every unsaved page edit into a release that goes live at `input.at`. */
  scheduleDrafts: (input: ScheduleInput) => Promise<PageRelease>
  getSchedule: () => Promise<ScheduleOverview>
  /** Goes live now (`force` also over a conflicting change made since scheduling). */
  releaseNow: (id: string, force?: boolean) => Promise<PageRelease>
  /** Takes a live release down now (puts the pages back as they were). */
  endRelease: (id: string, force?: boolean) => Promise<PageRelease>
  /** Drops a release that hasn't gone live; its edits become unsaved drafts again. */
  cancelRelease: (id: string) => Promise<void>
  revertHistory: (historyId: string) => Promise<void>
  listImages: () => Promise<ImageEntry[]>
  importImage: () => Promise<ProcessedImage | null>
  optimizeImages: (paths: string[], apply: boolean) => Promise<OptimizeResult>
  /** Asks for a file and puts it in place of `path` everywhere. Null when cancelled. */
  replaceImage: (path: string) => Promise<MediaChangeResult | null>
  deleteImage: (path: string) => Promise<MediaChangeResult>
  addImageDimensions: () => Promise<{ images: number; pages: string[]; skipped: string[] }>
  previewUrl: (path: string) => Promise<string>
  /** The page with its own scripts running and unsaved drafts applied. */
  interactUrl: (path: string) => Promise<string>
  setAllowExternalScripts: (allow: boolean) => Promise<void>
  openExternal: (url: string) => Promise<void>
  reportSelection: (selection: Selection | null) => Promise<void>

  // SEO
  auditSeo: () => Promise<SeoReport>
  rebuildSitemap: () => Promise<{ urls: number; changed: boolean }>
  getRobots: () => Promise<string>
  saveRobots: (text: string) => Promise<void>
  getSiteIdentity: () => Promise<SiteIdentity>
  addSiteIdentity: (identity: { name: string; url: string; logo: string }) => Promise<SiteIdentity>

  // Blog
  getBlogSetup: () => Promise<BlogSetup>
  saveBlogTemplates: (templates: BlogTemplates) => Promise<BlogSetup>
  startPointing: (path: string) => Promise<PointSession>
  /** Describes element `n` of a pointing session. */
  pointAt: (key: string, n: number) => Promise<PickedElement>
  /** Element numbers (in this session) of saved locators; null where one can't be found. */
  resolveLocators: (key: string, locators: ElementLocator[]) => Promise<(number | null)[]>
  /** Child-index path of `n` inside `ancestor`, or null when it isn't inside. */
  pathWithin: (key: string, ancestor: number, n: number) => Promise<number[] | null>
  /** Renders a sample post and list page from the templates (not written to the site). */
  previewBlog: () => Promise<BlogPreview>

  // Posts
  listPosts: () => Promise<PostSummary[]>
  /** Pages written by the blog generator (edit their posts, not the pages). */
  generatedPages: () => Promise<string[]>
  getPost: (id: string) => Promise<PostRecord>
  newPost: () => Promise<PostRecord>
  /** Saves; when the post is (or was) published, regenerates the blog pages in the site. */
  savePost: (post: PostRecord) => Promise<SavePostResult>
  deletePost: (id: string) => Promise<GenerateResult | null>
  /** The post rendered with its layout, as it would be published (not written). */
  previewPost: (post: PostRecord) => Promise<string>
  regenerateBlog: () => Promise<GenerateResult>
  /** Runs an image dropped / pasted into the editor through the import pipeline. */
  importImageData: (name: string, data: Uint8Array) => Promise<ProcessedImage>

  // Site search
  getSearch: () => Promise<SearchState>
  /** Adds (or updates) the script on every page and writes the assets and index. */
  enableSearch: (box: SearchBoxOptions) => Promise<SearchChange>
  /** Removes the script, the icons CraftPages inserted, the assets and the index. */
  disableSearch: () => Promise<SearchChange>
  rebuildSearchIndex: () => Promise<{ pages: number; bytes: number }>
  searchIconMarkup: (icon: SearchIconOptions) => Promise<string>
  /** Inserts the icon next to a picked element; `all` = on every page sharing that block. */
  placeSearchIcon: (
    path: string,
    locator: ElementLocator,
    position: IconPosition,
    scope: 'all' | 'page',
    icon: SearchIconOptions,
    /** When search is off: turn it on in the same undoable step. */
    enableWith?: SearchBoxOptions | null
  ) => Promise<SearchChange>
  /** Restyles every icon CraftPages inserted. */
  updateSearchIcons: (icon: SearchIconOptions) => Promise<SearchChange>
  setSearchExcluded: (path: string, excluded: boolean) => Promise<SearchChange>

  // Shared components
  scanComponents: () => Promise<ComponentGroup[]>

  // Deploy
  listCloudflareProjects: () => Promise<CloudflareProject[]>
  /** The account's Workers (null when the token can't read them). */
  listCloudflareWorkers: () => Promise<CloudflareWorker[] | null>
  createCloudflareProject: (name: string) => Promise<CloudflareProject>
  deployStatus: () => Promise<DeployStatus>
  /** Pass force to publish over a version that wasn't published from this folder. */
  deploy: (target: DeployTarget, force?: boolean) => Promise<DeployResult>
  /** The live version, if it wasn't published from this folder; null when it was (or none is live). */
  checkLive: () => Promise<ForeignDeploy | null>

  // Updates
  getUpdate: () => Promise<UpdateState>
  checkForUpdate: () => Promise<UpdateState>
  /** Restarts into a downloaded update. */
  installUpdate: () => Promise<void>
  listDeployments: () => Promise<Deployment[]>
  rollback: (deploymentId: string) => Promise<void>

  // AI (MCP)
  getMcpStatus: () => Promise<McpStatus>
  regenerateMcpToken: () => Promise<McpStatus>
  setAutoAccept: (on: boolean) => Promise<McpStatus>
  listProposals: () => Promise<Proposal[]>
  acceptProposal: (id: string) => Promise<void>
  rejectProposal: (id: string, reason?: string) => Promise<void>
  revertProposal: (id: string) => Promise<void>
  proposalPreviewUrl: (id: string, path: string) => Promise<string>

  onEvent: (listener: (event: AppEvent) => void) => () => void
}
