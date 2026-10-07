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

/** Cloudflare (the id predates Workers), or any web host reached over FTP / SFTP. */
export type DeployConnectionType = 'cloudflare-pages' | 'ftp' | 'sftp'

export const isServerConnection = (type: DeployConnectionType): boolean =>
  type === 'ftp' || type === 'sftp'

/**
 * A place sites deploy to: a Cloudflare account, or a server. The secret (API token,
 * password, or key passphrase) is in the keychain, by `id`.
 */
export interface DeployConnection {
  id: string
  type: DeployConnectionType
  /** Shown in pickers, e.g. "My Cloudflare" or "Acme (client)". */
  name: string
  /** Cloudflare only. */
  accountId: string
  /** FTP / SFTP: where and as whom. */
  host?: string
  port?: number
  username?: string
  /** FTP: encrypt with TLS (FTPS, explicit). Plain FTP sends the password readable. */
  secure?: boolean
  /** SFTP: a private key file instead of a password (the secret is then its passphrase). */
  keyPath?: string
  /** SFTP: the server's key fingerprint (SHA-256), trusted on first connection. */
  hostKey?: string
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
  host?: string
  port?: number
  username?: string
  secure?: boolean
  keyPath?: string
  /** API token (Cloudflare), password, or key passphrase. */
  token?: string
}

/** What a Cloudflare token can do. Publishing needs Workers (or Pages); sync also needs R2. */
export interface TokenCheck {
  workers: number | null
  pages: number | null
  /** 'disabled': the account hasn't turned R2 on; 'missing': the token lacks the permission. */
  r2: 'ok' | 'missing' | 'disabled'
}

/** What a server connection test found. */
export interface ServerCheck {
  /** The folder the server starts in after logging in. */
  home: string
  /** Folders there, to choose the site's folder from. */
  dirs: string[]
  /** SFTP: the server key fingerprint now trusted. */
  hostKey?: string
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
    /**
     * What that connection points at (a Cloudflare account, user@host), so another computer
     * that gets this project through sync can pick its own matching connection.
     */
    connectionHint?: string
    /** Workers static assets (Cloudflare's default for new projects), Pages, or a server. */
    target: DeployKind
    /** Cloudflare Pages project in that account (target "pages"). */
    projectName: string
    /** Worker the site is published as (target "workers"); created on the first deploy. */
    workerName: string
    productionBranch: string
    previewBranch: string
    /** Target "server": the site's folder on the server, e.g. /public_html. */
    remoteDir: string
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
  editing: {
    /**
     * Code mode in the page editor (HTML, CSS, JS). Off: no Code switch anywhere, so a
     * client can't reach the markup. Off for new projects; on for projects set up before
     * the option existed.
     */
    codeEditor: boolean
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
    /** Shown on the post list while there are no posts. */
    emptyText: string
  }
}

export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] }

// ---------- Page editing ----------

export type ComponentScope = 'all' | 'page'

/** A shared component present on the page being edited. */
export interface SessionComponent {
  id: string
  /** The block's selector (nav.site-nav): stable, for code and AI. */
  label: string
  /** Element name (header, nav, section…) and first heading: what people see. */
  tag: string
  heading?: string
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
  /** Files written from Code mode (not drafts): stylesheets and scripts count too. */
  code?: boolean
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
  /** <img> tags showing this file without width and height (the page jumps as it loads). */
  unsized: number
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
  /** The block's first heading, to name it for people. */
  heading?: string
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
  /** The post's tags: one badge (copied per tag) or the group of badges. */
  tags?: ElementLocator | null
  /** The post's category badge (or a group holding it). */
  category?: ElementLocator | null
  /** Where the author's name shows (byline, author box…). */
  author?: ElementLocator[] | null
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
  tags?: number[] | null
  category?: number[] | null
  author?: number[] | null
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
  card?: {
    element: ElementLocator
    fields: CardFields
    /**
     * The card as first found on the page. The area is rewritten in place, so with no
     * posts the page has no card left to copy; this one is used then.
     */
    html?: string
  } | null
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
  /**
   * Layout pages the blog has already taken off the site (once, when it first replaced
   * them); switching one back on in Pages is left alone.
   */
  unpublished?: string[]
}

/** Links on the site's own pages to blog layout pages that are off the site. */
export interface LayoutLinks {
  layouts: string[]
  /** Where the links will point: the blog's list address. */
  blogHome: string
  pages: { path: string; links: number; unsaved: boolean }[]
}

export interface LayoutLinksFix {
  pages: string[]
  links: number
  /** Pages left alone because they have unsaved edits. */
  skipped: string[]
  historyId: string | null
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
  /** As tags or a category: 1 for a single badge, else the badges in this group. */
  badges: number
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
  /** One category per post, with its own archive page. */
  category?: string
  /** Empty: the layout's own author name stays. */
  author?: string
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
  category: string
  author: string
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
  /** The JSON-LD <script> tags in index.html that hold it, as written there. */
  code: string | null
}

/** A text file opened in code mode. `hash` identifies the version that was read. */
export interface SourceFile {
  path: string
  text: string
  hash: string
}

// ---------- Versions (snapshots of the whole project) ----------

/** What made a version: a publish, a sync between computers, or a restore. */
export type SnapshotKind = 'publish' | 'sync' | 'restore'

export interface SnapshotSummary {
  id: string
  kind: SnapshotKind
  at: string
  /** The computer it was made on. */
  device: string
  label: string
  /** Site files in the version, and how many changed since the one before. */
  files: number
  added: number
  changed: number
  removed: number
  /** Site files kept off the site in this publish. */
  unpublished: number
  deploy: { target: string; id: string; url: string; where: string } | null
  /** The oldest version: everything counts as added. */
  first: boolean
}

export interface SnapshotDetails {
  added: string[]
  changed: string[]
  removed: string[]
  unpublished: string[]
}

// ---------- Sync between computers ----------

export type SyncMode = 'off' | 'cloudflare' | 'server'

/** Someone with the project open on another computer (or this one). */
export interface SyncPresence {
  device: string
  /** The page they have open, if any. */
  page: string | null
  /** edit / code / interact */
  mode?: string | null
  at: string
}

/** Turning sync on: where, and the passphrase for a server store. */
export interface SyncSetup {
  mode: Exclude<SyncMode, 'off'>
  connection: string
  /** Server: the sync folder. */
  dir?: string
  /** Server: encrypts everything in the sync folder; other computers need the same one. */
  passphrase?: string
}

export interface SyncStatus {
  mode: SyncMode
  connection: string
  /** Server: the sync folder. Cloudflare: the Worker's address. */
  where: string
  lastSync: string | null
  /** The shared head when last seen: who synced last, and when. */
  remote: { device: string; at: string; rev: number } | null
  /** Another computer synced since this folder did: there's something to get. */
  behind: boolean
  /** This folder has changes the others don't have yet. */
  ahead: boolean
  /** Files changed on both sides at the last sync; the other side's copy is kept aside. */
  conflicts: string[]
  /** Computers with the project open now (this one excluded). */
  people: SyncPresence[]
  /** A sync is running. */
  busy: boolean
  /** The last sync failed with this. */
  error: string | null
}

export interface SyncResult {
  /** Files that came in from other computers. */
  pulled: number
  /** This folder's changes went up. */
  pushed: boolean
  conflicts: string[]
  /** The computer the incoming changes were last synced from. */
  from: string | null
}

/** Where to look for projects shared from other computers. */
export interface SyncSource {
  mode: Exclude<SyncMode, 'off'>
  connection: string
  dir?: string
  passphrase?: string
}

export interface SyncProjectView {
  id: string
  name: string
  at: string | null
  device: string | null
}

export interface SitemapStatus {
  exists: boolean
  /** Addresses listed in the file now. */
  urls: number
  /** When the file last changed (ISO), or null when there's none. */
  modified: string | null
  /** Pages a rebuilt sitemap would list. */
  pages: number
  /** The file is exactly what a rebuild would write. */
  upToDate: boolean
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
  /** HTML pages among the changed files (added, edited or removed), site-relative. */
  changedPages: string[]
  lastDeploy: { id: string; url: string; branch: string; at: string } | null
}

export type DeployKind = 'workers' | 'pages' | 'server'

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
  /** Sync state of the open project changed (synced, someone else synced, people came and went). */
  | { type: 'sync'; status: SyncStatus }

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
  /**
   * Checks the token: how many Workers and Pages projects it can see (null = no access),
   * and whether it reaches R2, which sync between computers needs.
   */
  testConnection: (id: string) => Promise<TokenCheck>
  /**
   * Logs in to an FTP / SFTP server before saving: a saved connection's secret is used
   * when `input.token` is empty. Lists the folders in `dir` (default: where it starts).
   */
  checkServer: (input: ConnectionInput, dir?: string) => Promise<ServerCheck>
  /** Asks for any file (starting in ~/.ssh); null when cancelled. */
  pickFile: (title: string) => Promise<string | null>

  // Versions
  listVersions: () => Promise<SnapshotSummary[]>
  versionDetails: (id: string) => Promise<SnapshotDetails>
  /** Puts the site files back as in that version (one undoable step). */
  restoreVersion: (id: string) => Promise<{ historyId: string | null; files: number }>
  /** Asks for an empty folder and writes the version there; null when cancelled. */
  exportVersion: (id: string) => Promise<{ folder: string; files: number } | null>

  // Sync between computers
  getSyncStatus: () => Promise<SyncStatus>
  /** Sets up the store (Cloudflare: the sync Worker) and makes the first sync. */
  enableSync: (setup: SyncSetup) => Promise<SyncResult>
  disableSync: () => Promise<void>
  syncNow: () => Promise<SyncResult>
  /** Tells other computers which page this one has open. */
  announcePresence: (page: string | null, mode: string | null) => Promise<void>
  /** Projects in a sync store, to open one on this computer. */
  listSyncProjects: (source: SyncSource) => Promise<SyncProjectView[]>
  /** Asks for an empty folder, downloads the project there and opens it; null when cancelled. */
  getSyncProject: (source: SyncSource, project: string) => Promise<Workspace | null>
  /** Uses the other computer's copy of a file that conflicted. */
  takeTheirs: (path: string) => Promise<void>

  // Code mode
  readSource: (path: string) => Promise<SourceFile>
  /** The page's own stylesheets and scripts, as site paths. */
  pageAssets: (path: string) => Promise<string[]>
  /** Pages using each stylesheet / script (an edit there changes them all). */
  assetUsage: (files: string[]) => Promise<Record<string, number>>
  /** A URL showing unsaved HTML as that page. */
  previewSource: (path: string, text: string) => Promise<string>
  /** Saves a file opened at `baseHash`; refuses when it changed since or has visual edits. */
  saveSource: (
    path: string,
    text: string,
    baseHash: string
  ) => Promise<{ hash: string; historyId: string }>

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
  /** Writes width and height on <img> tags that lack them; only for `paths` when given. */
  addImageDimensions: (
    paths?: string[]
  ) => Promise<{ images: number; pages: string[]; skipped: string[] }>
  /** Asks for one or more files and imports them (resized and compressed). */
  uploadImages: () => Promise<ProcessedImage[]>
  previewUrl: (path: string) => Promise<string>
  /** The page with its own scripts running and unsaved drafts applied. */
  interactUrl: (path: string) => Promise<string>
  setAllowExternalScripts: (allow: boolean) => Promise<void>
  openExternal: (url: string) => Promise<void>
  reportSelection: (selection: Selection | null) => Promise<void>

  // SEO
  auditSeo: () => Promise<SeoReport>
  rebuildSitemap: () => Promise<{ urls: number; changed: boolean }>
  /** robots.txt, or null when the site has none. */
  getRobots: () => Promise<string | null>
  getSitemapStatus: () => Promise<SitemapStatus>
  /** Pages left out of publishing, with the pattern (Project settings) that leaves each out. */
  getUnpublished: () => Promise<Record<string, string>>
  /** Keeps a page off the site (or puts it back) with its own exclude pattern. */
  setPublished: (path: string, published: boolean) => Promise<void>
  saveRobots: (text: string) => Promise<void>
  getSiteIdentity: () => Promise<SiteIdentity>
  /** Adds the structured data to index.html; returns it with the tag that was added. */
  addSiteIdentity: (identity: {
    name: string
    url: string
    logo: string
  }) => Promise<{ identity: SiteIdentity; added: string }>

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
  /** The blog's layout pages: the post (article) template and the list template. */
  blogLayoutPages: () => Promise<{ post: string | null; list: string | null }>
  /**
   * Links to blog layout pages that are off the site; null when there are none. `planned`:
   * the links that creating the blog will leave pointing at layout pages.
   */
  getLayoutLinks: (planned?: boolean) => Promise<LayoutLinks | null>
  /** Generates the blog (an empty list when there are no posts), optionally fixing links. */
  createBlog: (
    fixLinks: boolean
  ) => Promise<{ generated: GenerateResult; links: LayoutLinksFix | null }>
  /** A URL showing a page as visitors see it (no editing), for generated pages. */
  blogViewUrl: (path: string) => Promise<string>
  fixLayoutLinks: () => Promise<LayoutLinksFix>
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
