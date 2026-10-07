import type { Msg } from '../types'

/** Project settings: site details, images, and where the project deploys. */
export default {
  title: 'Project settings',

  // Site
  site: 'Site',
  siteDescription: 'Stored with the site in {path}.',
  siteName: 'Site name',
  baseUrl: 'Base URL',
  baseUrlHint: 'Used for canonical links, the sitemap and RSS.',
  language: 'Language',
  languageHint: 'Language code, e.g. en, en-US, it, uk.',
  images: 'Images',
  maxWidth: 'Max width (px)',
  quality: 'JPEG / WebP quality',
  qualityHint: 'From 30 to 100.',
  folder: 'Folder',
  folderHint: 'Relative to the site root.',
  pngToJpeg: 'Convert PNG photos without transparency to JPEG',
  blog: 'Blog',
  blogNote: 'Post URLs, the post list address and posts per page are set in Blog → Post URLs.',
  savedSite: 'Saved to .sitecms/site.json.',

  // Deploy
  deploy: 'Deploy',
  deployDescription:
    'Where this project is published. Pick one of your deploy connections (yours, a client’s…). Add connections in {settings}.',
  listWorkers: 'List Workers',
  listPages: 'List Pages projects',
  savedDeploy: 'Deploy settings saved for this project.',
  connection: 'Connection',
  noConnections: 'No connections yet: add one in {settings}.',
  noToken: 'This connection has no API token yet.',
  choose: '— Choose —',
  unknownConnection: 'Unknown connection (set up on another computer?)',
  servers: 'Servers (FTP / SFTP)',
  noPassword: 'This connection has no password yet.',
  remoteDir: 'Folder on the server',
  remoteDirHint:
    'Where the site’s files go, usually public_html, www or htdocs. Empty = the folder the login starts in. CraftPages only ever deletes files it uploaded itself.',
  browse: 'Browse…',
  browseLabel: 'Folders on the server',
  browsePath: 'Current folder',
  browseSuggested: 'Hosts usually serve sites from a folder with this name',
  browseEmpty: 'No folders here.',
  browseUse: 'Use {dir}',
  publishAs: 'Publish as',
  targetWorkers: 'Worker (recommended)',
  targetPages: 'Pages project',
  workersHint:
    'What Cloudflare creates by default for new projects: a Worker serves the site’s files. Static files are served for free.',
  pagesHint:
    'For projects that already live on Cloudflare Pages. Adds preview deploys on their own URL.',
  worker: 'Worker',
  workerHint: 'Pick one or type a new name.',
  workerExplain:
    'A new Worker is created on the first publish, at name.your-subdomain.workers.dev. To use your own domain, add it to the Worker in Cloudflare.',
  workersHidden: 'Not listed because publishing would replace their code: {names}.',
  workerPlaceholder: 'my-site',
  pagesProject: 'Pages project',
  pagesProjectPlaceholder: 'List Pages projects to pick one',
  productionBranch: 'Production branch',
  previewBranch: 'Preview branch',
  previewBranchHint: 'Preview deploys get their own URL.',
  neverUpload: 'Never upload',
  neverUploadHint:
    'One pattern per line. * matches within a folder, ** across folders. .sitecms and dot-files are always skipped (except .htaccess when publishing to a server).',
  newProjectName: 'New Pages project name',
  newProjectPlaceholder: 'new-project-name',
  createProject: 'Create Pages project',
  created: 'Created {name} ({subdomain}).',

  // Results of listing projects and Workers
  pagesFound: {
    one: '{count} Pages project in this account.',
    other: '{count} Pages projects in this account.'
  } satisfies Msg,
  noPagesButWorkers: {
    one: 'No Pages projects in this account. It has {count} Worker ({names}), which is a different kind of project. Create a Pages project below, or publish as a Worker.',
    other:
      'No Pages projects in this account. It has {count} Workers ({names}), which are a different kind of project. Create a Pages project below, or publish as a Worker.'
  } satisfies Msg,
  noPages:
    'No Pages projects in this account. Projects created as Workers (the Cloudflare dashboard’s default) don’t show here. Create a Pages project below, or publish as a Worker.',
  workersNoAccess:
    'The token can’t read Workers. In Cloudflare → My Profile → API Tokens, give it Account · Workers Scripts · Edit.',
  workersFound: {
    one: '{count} Worker in this account; CraftPages can publish to {usable}. Pick one or type a new name.',
    other:
      '{count} Workers in this account; CraftPages can publish to {usable}. Pick one or type a new name.'
  } satisfies Msg,
  noWorkers: 'No Workers yet. Type a name: the Worker is created on the first publish.',
  editing: 'Editing',
  codeEditor: 'Show the code editor',
  codeEditorHint:
    'Adds Code next to Edit and Preview, to change the page’s HTML, CSS and JavaScript. Leave it off for people who only edit content.',
  unsavedChanges: 'Unsaved changes'
} satisfies Record<string, Msg>
