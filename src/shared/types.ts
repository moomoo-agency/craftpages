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
  /** craftforms.app accounts connected through the browser; each project picks one. */
  formsAccounts: FormsAccount[]
  background: {
    /** While anything is scheduled, closing the window leaves the app running in the menu bar / tray. */
    keepRunning: boolean
    /** Start hidden at login, so scheduled changes go out after a restart too. */
    openAtLogin: boolean
  }
}

/**
 * A craftforms.app account, connected through the browser (CraftForms integration,
 * unfinished/CRAFTFORMS.md). Its API token is in the keychain, by `id`. Kept apart
 * from deploy connections: it's where forms come from, not where a site publishes.
 */
export interface FormsAccount {
  id: string
  /** The CraftForms app it belongs to, normally https://my.craftforms.app. */
  service: string
  email: string
  name: string
  plan: string
  connectedAt: string
}

export interface FormsAccountView extends FormsAccount {
  hasToken: boolean
}

export interface FormsUsage {
  used: number
  /** 0 means unlimited. */
  limit: number
}

export interface FormsForm {
  /** The embed id (rest name or UUID), not a post ID. */
  id: string
  title: string
  published: boolean
  /** Published and addressable: can be put on a page. */
  embeddable: boolean
  modified: string
}

export type FormsWebsiteStatus = 'authorised' | 'available' | 'over_limit'

/** The project's forms setup, from this computer only (no network). */
export interface FormsProject {
  accounts: FormsAccountView[]
  /** The project's account id, '' when none is chosen (or it was disconnected). */
  account: string
  /** The site address's host, '' when the project has none. */
  siteDomain: string
  /** The website forms are embedded for: the project's choice, else siteDomain. */
  domain: string
  /** Forms already on the site's pages, whoever put them there. */
  embeds: FormsEmbed[]
}

/**
 * Where an embed's form lives, read from its key (whose first part is that site's address):
 * the project's connected account, another craftforms.app account, a self-hosted
 * CraftForms (WordPress) site, or unknown (the key doesn't decode).
 */
export type FormsEmbedSource = 'account' | 'hosted' | 'self' | 'unknown'

/** The snippet's own settings, as data-* attributes (all optional). */
export interface FormsEmbedSettings {
  /** data-lang: the form's language; '' = follow the page. */
  lang: string
  /** data-resource-id: a catalog item (bookings, products). */
  resourceId: string
  /** data-resource-sig: the item's signature; keys made since October 2026 need it. */
  resourceSig: string
  /** data-loader="off" hides the loading spinner. */
  spinner: boolean
  /** data-loading-label: what screen readers hear while it loads. */
  loadingLabel: string
}

/** One embed found on a page, whoever put it there. */
export interface FormsEmbed {
  path: string
  /** Its position among the page's embeds (0-based), to address it for editing. */
  index: number
  key: string
  /** The site the key belongs to, e.g. https://abc.forms.craftforms.app; '' when unknown. */
  site: string
  source: FormsEmbedSource
  /** Known for the connected account's embeds once its forms were listed. */
  formId: string | null
  title: string | null
  /** The website the key works on, or null when unknown (another account, self-hosted). */
  domain: string | null
  /** False when the page has no CraftForms loader script, so the form can't appear. */
  hasLoader: boolean
  /** On a page the blog builds from a post: change it in the post, not here. */
  inPost: boolean
  settings: FormsEmbedSettings
}

/** GET /api/v1/forms: the live list for the project's account. */
export interface FormsList {
  forms: FormsForm[]
  websites: { domain: string; keys: { formId: string; key: string; domain: string }[] }[]
  quota: { forms: FormsUsage; websites: FormsUsage }
  loaderUrl: string
  siteUrl: string
  urls: { newForm: string; forms: string; upgrade: string; dashboard: string }
  requested?: { domain: string; status: FormsWebsiteStatus; keys: Record<string, string> }
}

export interface FormsEnsured {
  key: string
  domain: string
  created: boolean
  snippet: string
}

/** GET /api/v1/me: the account card. */
export interface FormsAccountInfo {
  email: string
  name: string
  plan: string
  status: string
  /** 'none' until the free forms site is created from the dashboard. */
  hostingState: string
  emailVerified: boolean
  siteUrl: string | null
  /** null when there is no forms site yet, or its server couldn't be asked. */
  limits: { forms: FormsUsage; websites: FormsUsage | null } | null
  urls: { dashboard: string; billing: string; connectedApps: string }
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
  /** The root language's code (blog dates…). With `languages` set, it follows the root one. */
  locale: string
  /** The site's languages, one per folder; empty for a site in one language. */
  languages: SiteLanguage[]
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
  /**
   * Speed work done on the published copy only; the folder's files stay as written.
   * All off for new projects.
   */
  optimize: {
    /** Minify CSS and JavaScript. */
    minify: boolean
    /** Versioned copies of stylesheets, fonts and images, cached by browsers for a year. */
    cache: boolean
    /** Stylesheets go into each page while their gzipped size fits this many KB; 0 = off. */
    inlineCssKb: number
  }
  /** CraftForms (optional): where this project's forms come from, and for which website. */
  forms: {
    /** The CraftForms account (app-wide, by id) this project uses; '' = none. */
    account: string
    /** That account's email, so a synced copy on another computer can find its own. */
    accountHint: string
    /** The website forms are embedded for when it isn't the site address; '' = the site address. */
    domain: string
  }
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

/** A GitHub Gist, as the Gist block needs it. */
export interface Gist {
  id: string
  owner: string
  /** The revision fetched: the one in the link, or the latest. */
  revision: string
  /** The link named a revision, so updating keeps to it. */
  pinned: boolean
  url: string
  description: string
  files: { name: string; language: string; content: string }[]
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
  /** On a site with languages: the language whose pages share it (each has its own). */
  language?: string
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
  /** The first of `links`, kept for layouts saved before cards had several links. */
  link?: number[] | null
  /** Every link that opens the post: title, "Read more", the whole card… */
  links?: number[][] | null
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
  /** Card text and feed summary (and meta description unless `seoDescription` is set); made from the body when empty. */
  excerpt: string
  cover: { src: string; alt: string } | null
  /** Image for social sharing when it should differ from the cover. */
  socialImage?: { src: string; alt: string } | null
  /**
   * Where the 1200×630 share crop sits on the shared image, as fractions (0–1) of the room
   * left to move across and down, like CSS `object-position`. Missing means centred, by
   * what looks interesting (sharp's attention strategy).
   */
  shareFocus?: [number, number] | null
  /** Body as Gutenberg block markup. */
  content: string
  /** `<title>` when it should differ from the post title. */
  seoTitle?: string
  /** Meta description when it should differ from the excerpt. */
  seoDescription?: string
  tags?: string[]
  /** One category per post, with its own archive page. */
  category?: string
  /** Empty: the layout's own author name stays. */
  author?: string
  /** On a site with languages: the post's language code; empty for the root language. */
  lang?: string
  /** The post this one translates (its id); posts that translate each other share it. */
  translationOf?: string
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
  /** Language code; empty for the root language. */
  lang: string
  /** Id of the post group this one belongs to (translations share it). */
  group: string
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
  /** Layout pages moved aside because the blog's own pages go where they were. */
  moved?: { from: string; to: string }[]
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

// ---------- Languages ----------

export interface SiteLanguage {
  /** BCP 47 code, as in `<html lang>` and hreflang: "it", "pt-BR". */
  code: string
  name: string
  /** Folder of its pages: '' for the root (the default language), else "en/". */
  path: string
  /** The blog's title in this language (the list's heading); empty: the site's blog title. */
  blogTitle?: string
  /** The language switcher's text for it; empty: its code in capitals (IT, EN). */
  label?: string
  /** The switcher's flag for it (an id of the built-in flags); empty: the language's usual one. */
  flag?: string
}

/** How the site's language switchers look (kept on each one, in its own markup). */
export interface SwitcherLook {
  display: 'text' | 'flag' | 'both'
  /** Every language in a row, or only the current one, opening a list of the others. */
  layout: 'row' | 'dropdown'
  /**
   * A language the page has no version in: left out, or linked to that language's home page.
   * Switchers placed before this choice existed link to the home page.
   */
  missing: 'hide' | 'home'
  /** Text size and flag height, in px; 0 keeps the site's text size. */
  size: number
  /** Space between the languages, in px. */
  gap: number
}

/**
 * Where a page's switcher points, by language code. `exact`: the page's own version (or the
 * same blog list) in that language; otherwise a stand-in, that language's home page or blog.
 */
export type SwitcherLinks = Map<string, { url: string; exact: boolean }>

export interface SwitcherState {
  /** Pages that have a switcher. */
  pages: string[]
  look: SwitcherLook
  flags: { id: string; name: string; svg: string }[]
  /** Each language's flag when none is chosen, by language code. */
  defaultFlags: Record<string, string>
}

/** Pages that translate each other: language code → page path. */
export interface TranslationGroup {
  pages: Record<string, string>
}

export interface LanguagesState {
  languages: SiteLanguage[]
  /** Not set up yet, but the pages look multilingual: what was found. */
  detected: SiteLanguage[] | null
  /** Pages per language code. */
  counts: Record<string, number>
  /** Groups of two or more pages. */
  groups: TranslationGroup[]
  /** Per language code: pages of the root language with no page in that language. */
  missing: Record<string, string[]>
  /** Pages whose `lang` or links to translations (hreflang) need updating. */
  outdated: string[]
  /** Of those, pages with unsaved edits (updated after Save all). */
  unsaved: string[]
  /** Two pages of one language claim to translate the same page. */
  conflicts: { language: string; pages: string[] }[]
  /** Pages in the folder of a language the site doesn't list (left as they are). */
  unmanaged: string[]
}

/**
 * A translation's state: `source` (a page of the root language), `needs` (copied, not
 * translated yet), `outdated` (its source page's text changed since it was translated), or
 * `translated`.
 */
export type TranslationStatus = 'source' | 'needs' | 'outdated' | 'translated'

/** One row of the translations grid: a page and its versions, by language code. */
export interface TranslationRow {
  title: string
  pages: Record<string, { path: string; status: TranslationStatus }>
}

/** The open page's place among its translations (for the editor). */
export interface PageLanguage {
  code: string
  status: TranslationStatus
  /** The page it translates (a page of the root language), if any. */
  source: string | null
  /** Its versions, this one included, by language code. */
  pages: Record<string, string>
  /** The site's languages, in order. */
  languages: SiteLanguage[]
}

/**
 * A text block of a translation's source page that changed. `key` is the block's editor
 * selector, `…@alt` for an image's alt text, or `@title` / `@description`.
 */
export interface TextChange {
  key: string
  /** Null: the block is new. */
  before: string | null
  /** Null: the block is gone. */
  now: string | null
}

export interface LanguagesCopy {
  created: string[]
  /** Pages that already had a version in that language. */
  skipped: string[]
  historyId: string | null
}

export interface LanguagesUpdate {
  changed: string[]
  skipped: string[]
  historyId: string | null
}

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

/** A publish under way: which kind, and the last thing it reported. */
export interface PublishRun {
  target: DeployTarget
  progress: DeployProgress | null
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
  /** Every changed file, site-relative and sorted: what the next publish sends or removes. */
  changes: FileChange[]
  /**
   * The speed settings differ from the last publish's: the next publish sends new
   * optimized copies even if no file changed.
   */
  optimizeChanged: boolean
  lastDeploy: { id: string; url: string; branch: string; at: string } | null
}

export interface FileChange {
  path: string
  change: 'added' | 'changed' | 'removed'
}

/** A font service stylesheet the site loads, and who links it. */
export interface ExternalFonts {
  /** The stylesheet address as written (`&amp;` decoded). */
  url: string
  service: 'Google Fonts' | 'Bunny Fonts'
  families: string[]
  /** Pages (site-relative) that link it. */
  pages: string[]
  /** Stylesheets that @import it. */
  stylesheets: string[]
}

export interface SelfHostResult {
  /** Undo puts every file back. */
  historyId: string
  /** The new stylesheet, e.g. assets/fonts/google-fonts.css. */
  stylesheet: string
  fontFiles: number
  /** Pages and stylesheets now linking the copy. */
  pages: number
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
  /** WebSocket address (Claude Code). */
  url: string
  /** Streamable HTTP address (Codex, Cursor and most other clients). */
  httpUrl: string
  token: string
  clients: string[]
  error: string | null
  autoAccept: boolean
  /** Ready-to-paste `claude mcp add-json …` line. */
  command: string
  /** Ready-to-paste `codex mcp add …` line. */
  codexCommand: string
  /** JSON server entry (url + Authorization header) for other HTTP clients. */
  httpConfig: string
  /** `mcpServers` entry that starts the stdio bridge (Claude Desktop, stdio-only clients). */
  stdioConfig: string
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
  /** The app downloads and installs it (macOS, Windows, AppImage); otherwise the user downloads it. */
  installs: boolean
  checkedAt?: string
  error?: string
}

export type AppEvent =
  | { type: 'workspace'; workspace: Workspace | null }
  | { type: 'mcp'; status: McpStatus }
  | { type: 'proposals'; proposals: Proposal[] }
  | { type: 'deploy'; progress: DeployProgress }
  /** A publish finished (error null) or failed, after everything it records was written. */
  | { type: 'deploy-end'; root: string; target: DeployTarget; error: string | null }
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
  languagesState: () => Promise<LanguagesState>
  /** Saves the site's languages (validated); returns the new state. */
  saveLanguages: (languages: SiteLanguage[]) => Promise<LanguagesState>
  /** Writes `lang` and the links between translations into the pages that need them. */
  updateLanguagePages: () => Promise<LanguagesUpdate>
  /** Copies pages into a language's folder, linked to them, marked as needing translation. */
  copyToLanguage: (code: string, paths: string[]) => Promise<LanguagesCopy>
  translationsGrid: () => Promise<TranslationRow[]>
  pageLanguage: (path: string) => Promise<PageLanguage | null>
  /** Marks translations as translated (and up to date with their source pages). */
  markTranslated: (paths: string[]) => Promise<void>
  /** The source page's text for the element at this selector in a translation. */
  originalText: (path: string, selector: string) => Promise<string | null>
  /** What changed in an outdated translation's source page (null when not known). */
  sourceChanges: (path: string) => Promise<TextChange[] | null>
  switcherState: () => Promise<SwitcherState>
  /** The switcher as it would look on this page (flags inline), for the live preview. */
  switcherPreview: (path: string, look: SwitcherLook, languages?: SiteLanguage[]) => Promise<string>
  placeSwitcher: (
    path: string,
    locator: ElementLocator,
    position: IconPosition,
    scope: 'all' | 'page',
    look: SwitcherLook
  ) => Promise<SearchChange>
  restyleSwitchers: (look: SwitcherLook) => Promise<SearchChange>
  removeSwitchers: () => Promise<SearchChange>
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
  /** Element numbers of child-index paths inside `ancestor`; null where one can't be found. */
  numbersWithin: (key: string, ancestor: number, paths: number[][]) => Promise<(number | null)[]>
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
  /** The post's version in another language: its existing translation, or a new draft. */
  translatePost: (id: string, code: string) => Promise<PostRecord>
  deletePost: (id: string) => Promise<GenerateResult | null>
  /** The post rendered with its layout, as it would be published (not written). */
  previewPost: (post: PostRecord) => Promise<string>
  regenerateBlog: () => Promise<GenerateResult>
  /** Runs an image dropped / pasted into the editor through the import pipeline. */
  importImageData: (name: string, data: Uint8Array) => Promise<ProcessedImage>
  /** A gist's files, for the Gist block. */
  fetchGist: (url: string) => Promise<Gist>

  // CraftForms accounts
  listFormsAccounts: () => Promise<FormsAccountView[]>
  /** Opens the browser to sign in; resolves once the account is connected. */
  connectFormsAccount: () => Promise<FormsAccountView>
  cancelFormsConnect: () => Promise<void>
  formsAccountInfo: (id: string) => Promise<FormsAccountInfo>
  disconnectFormsAccount: (id: string) => Promise<void>
  formsProject: () => Promise<FormsProject>
  /** Chooses the project's account and/or website; `siteAddress` also sets the project's site address. */
  setFormsProject: (patch: {
    account?: string
    domain?: string
    siteAddress?: boolean
  }) => Promise<FormsProject>
  formsList: (domain?: string) => Promise<FormsList>
  ensureFormEmbed: (formId: string, domain: string) => Promise<FormsEnsured>
  releaseFormEmbed: (
    formId: string,
    domain: string
  ) => Promise<{ released: number; domain: string }>
  /** The Forms screen's live preview: the real embed.js, with a page's stylesheets or none. */
  formPreviewUrl: (
    target: { formId?: string; key?: string },
    page: string,
    styles: 'site' | 'form'
  ) => Promise<string>
  /** Changes an embed's key and settings in place (the page's nth embed). */
  updateFormEmbed: (
    path: string,
    index: number,
    patch: Partial<FormsEmbedSettings> & { key?: string }
  ) => Promise<{ historyId: string }>
  /** Removes an embed (and the loader, when no form is left on the page). */
  removeFormEmbed: (path: string, index: number) => Promise<{ historyId: string }>
  /** Adds the CraftForms loader script to a page that has a form but no loader. */
  addFormLoader: (path: string, loaderUrl: string) => Promise<{ historyId: string }>
  /** Connected account: another form, or another website, for an embed (ensures the key). */
  changeEmbedForm: (path: string, index: number, formId: string) => Promise<{ historyId: string }>
  changeEmbedWebsite: (
    path: string,
    index: number,
    domain: string
  ) => Promise<{ historyId: string; oldDomain: string | null; oldStillUsed: boolean }>
  /** Removes every key of a website from the account, freeing its slot. */
  releaseFormsWebsite: (domain: string) => Promise<{ released: number }>
  /** A form's stylesheets and rendered HTML (no scripts), for placing it on a page. */
  formPreviewMarkup: (formId: string) => Promise<string>
  /** Puts the form's snippet at a picked spot on a page (and the loader, once). */
  insertForm: (
    path: string,
    locator: ElementLocator,
    position: IconPosition,
    formId: string,
    domain: string
  ) => Promise<{ path: string; key: string; historyId: string }>

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
  /** Font-service stylesheets (Google Fonts, Bunny Fonts) the site links. */
  detectExternalFonts: () => Promise<ExternalFonts[]>
  /** Downloads one service stylesheet's fonts into the site and links them instead. */
  selfHostFonts: (url: string) => Promise<SelfHostResult>
  /** Pass force to publish over a version that wasn't published from this folder. */
  deploy: (target: DeployTarget, force?: boolean) => Promise<DeployResult>
  /** The live version, if it wasn't published from this folder; null when it was (or none is live). */
  checkLive: () => Promise<ForeignDeploy | null>
  /** The publish running for the open project (started here, elsewhere or by the scheduler). */
  publishRun: () => Promise<PublishRun | null>

  // Updates
  getUpdate: () => Promise<UpdateState>
  checkForUpdate: () => Promise<UpdateState>
  /** Restarts into a downloaded update. */
  installUpdate: () => Promise<void>
  /** Diagnostics: reveals craftpages.log; copies its end (false when there's nothing yet). */
  showLog: () => Promise<void>
  copyLog: () => Promise<boolean>
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
