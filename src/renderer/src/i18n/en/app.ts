import type { Msg } from '../types'

/** App shell: sidebar, top bar, drafts, projects, page list. */
export default {
  // Views (sidebar + top bar)
  viewPages: 'Pages',
  viewBlog: 'Blog',
  viewComponents: 'Shared parts',
  viewMedia: 'Media',
  viewSeo: 'SEO',
  viewSearch: 'Site search',
  viewAi: 'Template editing (AI)',
  viewPublish: 'Publish',
  viewProject: 'Project settings',
  viewSettings: 'App settings',
  sections: 'Sections',

  // Sidebar
  switchProject: 'Switch project ({shortcut})',
  noProjectOpen: 'No project open',
  openAProject: 'Open a project',
  aiConnected: 'AI connected: {clients}',
  proposalsWaiting: {
    one: '{count} proposal waiting',
    other: '{count} proposals waiting'
  } satisfies Msg,
  publishSite: 'Publish site',

  // Top bar
  dismissError: 'Dismiss this error',
  scheduledToast: '“{label}” goes live {at}. You can follow it in Publish.',
  scheduledToastUntil:
    '“{label}” goes live {at} and comes down {until}. You can follow it in Publish.',
  scheduledOtherProject: '{project}: {message}',

  // Drafts
  savedPages: {
    one: 'Saved {count} page to your site folder · not online yet',
    other: 'Saved {count} pages to your site folder · not online yet'
  } satisfies Msg,
  nothingToSave: 'Nothing to save',
  skippedShared: {
    one: '{count} shared edit skipped: the content differs there',
    other: '{count} shared edits skipped: the content differs there'
  } satisfies Msg,
  skippedDetail: '{component} on {page}: differs from {from}',
  undoSave: 'Undo save',
  unsavedSummary: {
    one: 'Unsaved edits on {count} page',
    other: 'Unsaved edits on {count} pages'
  } satisfies Msg,
  editsCount: { one: '{count} edit', other: '{count} edits' } satisfies Msg,
  fromShared: {
    one: '{count} from shared parts',
    other: '{count} from shared parts'
  } satisfies Msg,
  seoChanges: 'SEO',
  discardPage: 'Discard edits on {page}',
  staleNote: 'Changed on disk, so these edits will be dropped: {pages}',
  confirmDiscardAll: 'Discard every unsaved edit?',
  schedule: 'Schedule…',
  scheduleHint: 'Save these edits at a set time instead of now',
  saveAll: 'Save all',
  saveAllHint: 'Write every edit to the site folder ({shortcut})',

  // Projects
  projects: 'Projects',
  addProject: 'Add project…',
  searchProjects: 'Search recent projects',
  noMatch: 'No project matches “{query}”.',
  noRecent: 'No recent projects yet. Add a site folder to start.',
  currentBadge: 'open',
  unsavedBadge: { one: '{count} unsaved', other: '{count} unsaved' } satisfies Msg,
  deploysTo: 'Deploys to {name}',
  removeFromList: 'Remove {name} from the list (the folder is not touched)',

  // Page list
  openSiteTitle: 'Open a site',
  openSiteBody:
    'Pick the folder with your site’s HTML files. It stays the source of truth: CraftPages edits the files in place.',
  openProjectButton: 'Open project…',
  noPages: 'No HTML pages in this folder yet.',
  colTitle: 'Title',
  badgeBlog: 'blog',
  generatedHint: 'Built by the blog: open it as visitors see it',
  badgeTemplate: 'blog template',
  badgePostTemplate: 'article template',
  postTemplateHint:
    'Every post is built from this page: edit it to change how all posts look. Once the blog is published it is left off the site, and links to it lead to the blog.',
  templateHint:
    'The blog is built from this page: edit it to change how the post list looks. Once the blog is published it is left off the site, and links to it lead to the blog.',
  editPageHint: 'Edit {title}',
  untitled: 'Untitled',
  publishUnsaved: {
    one: '{count} page has unsaved edits: save them to publish them',
    other: '{count} pages have unsaved edits: save them to publish them'
  } satisfies Msg,
  saveFailed: 'Couldn’t save: {error}',
  skippedExplain:
    'These pages have their own version of the shared part, so the edit wasn’t applied there. Open one to edit it by hand.',
  colAddress: 'Address',
  discardAllAction: 'Discard all edits…',
  navContent: 'Content',
  navSite: 'Site',
  allLive: 'All saved · live site up to date',
  navSettings: 'Settings',
  unsavedShort: { one: '{count} unsaved', other: '{count} unsaved' } satisfies Msg,
  savedFiles: {
    one: 'Wrote {count} file · not online yet',
    other: 'Wrote {count} files · not online yet'
  } satisfies Msg,
  readyToPublish: 'Changes ready to publish',
  changesHere: {
    one: '{count} change on this page',
    other: '{count} changes on this page'
  } satisfies Msg,
  pagesUnsaved: { one: '{count} page unsaved', other: '{count} pages unsaved' } satisfies Msg,
  confirmDiscardPage: 'Discard the edits on {page}?',
  pagesReady: {
    one: '{count} page ready to publish',
    other: '{count} pages ready to publish'
  } satisfies Msg
} satisfies Record<string, Msg>
