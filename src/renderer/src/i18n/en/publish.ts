import type { Msg } from '../types'

/** Publish screen: deploy, deployments, scheduled changes. */
export default {
  // Deploy
  emptyTitle: 'Nothing to publish',
  titleWorker: 'Publish to {name} on Cloudflare',
  titleAnyWorker: 'Publish to Cloudflare',
  titlePages: 'Publish to the Pages project “{name}”',
  titleAnyPages: 'Publish to Cloudflare Pages',
  titleCloudflare: 'Publish to Cloudflare',
  titleServer: 'Publish to the server folder {dir}',
  checking: 'Checking files…',
  deployPreview: 'Deploy preview',
  publishProduction: 'Publish to the live site',
  hintWorker:
    'Only files whose content changed are uploaded. Every publish is kept as a version you can roll back to.',
  hintPages:
    'Only files whose content changed are uploaded. A preview deploy gets its own URL and leaves the live site as it is.',
  hintServer:
    'Only files that changed since the last publish are uploaded, then files you deleted are removed. Files on the server that CraftPages didn’t upload are left alone.',
  progressLabel: 'Deploy progress',
  deployedTo: 'Deployed to {url}',
  rolledBack: 'Production rolled back to {id}.',
  openSettings: 'Open Settings',
  foreignTitle: 'The live site was published from somewhere else',
  foreignBody:
    'The version online now was published on {date}{by} from another computer, another tool or the Cloudflare dashboard. Publishing replaces the whole site with this folder, so changes made there will be lost. Cloudflare can’t send files back: get the latest files into this folder first (from whoever published, or your git repository).',
  foreignBy: ' by {author}',
  foreignVia: ' ({source})',
  foreignBodyServer:
    'The version on the server now was published on {date}{by}. Publishing uploads this folder over it, so changes made there will be lost. Get the latest files into this folder first.',
  occupiedTitle: 'The server folder already has files',
  occupiedBody:
    '{dir} holds files that weren’t published with CraftPages, maybe an older site. Publishing uploads your site there: files with the same names are replaced, the others are kept. Check the folder in Project settings → Deploy if you’re not sure.',
  foreignPublish: 'Publish anyway',

  // Deployments
  deployments: 'On Cloudflare',
  deploymentsDescription:
    'The versions Cloudflare keeps. Rolling back here switches the live site without touching your folder.',
  noDeployments: 'No deployments yet.',
  colWhen: 'When',
  colEnvironment: 'Where',
  colBranch: 'Label',
  colComputer: 'Published from',
  colStatus: 'Status',
  colActions: 'Actions',
  envProduction: 'Live site',
  envPreview: 'Preview link',
  live: 'Live',
  openDeployment: 'Open this deployment in the browser',
  rollBack: 'Roll back…',
  rollBackConfirm: 'Make this version live again?',
  rollBackYes: 'Roll back',

  // Scheduled changes
  scheduledTitle: 'Scheduled changes',
  scheduledDescription:
    'Page edits and posts that go live at a set time. CraftPages publishes them while it’s running, even in the background, and catches up after sleep or a restart.',
  nothingScheduled:
    'Nothing scheduled. To schedule page edits, choose {schedule} next to {saveAll}. To schedule a post, give it a future date.',
  deployRetry:
    'A scheduled deploy has been failing since {date}. It’s retried every minute. Error: {error}',
  stateScheduled: 'Scheduled',
  stateLive: 'Live',
  stateDone: 'Done',
  stateBlocked: 'Held back',
  post: 'Post',
  wasLive: 'Was live {from} – {to}',
  wentLive: 'Went live {date}',
  liveSince: 'Live since {date}',
  goesLive: 'Goes live {date}',
  comesDown: 'comes down {date}',
  deploysToProduction: 'deploys to production',
  publishNow: 'Publish now',
  unschedule: 'Unschedule',
  publishAnyway: 'Publish anyway…',
  takeDownAnyway: 'Take down anyway…',
  takeDownNow: 'Take down now',
  keepLive: 'Keep it live',
  overwrite: 'Yes, overwrite',
  helpBlocked:
    '“Publish anyway” replaces those pages with the scheduled version, and the other changes on them are lost. “Unschedule” turns the scheduled edits back into unsaved edits; edits on a page that changed are dropped.',
  helpLive:
    '“Take down anyway” puts those pages back exactly as they were before, and the changes made since are lost.',
  unsavedTitle: {
    one: 'Unsaved edits on {count} page',
    other: 'Unsaved edits on {count} pages'
  } satisfies Msg,
  unsavedBody:
    'They aren’t in your site folder yet, so publishing now would leave them out. Save all and publish to include them.',
  saveAndPublish: 'Save all and publish',
  publishSavedOnly: 'Publish without them',
  liveTitle: 'Your site is live',
  liveBody:
    'Visitors now see the version you just published. To go back, pick an earlier version in Publish history below.',
  viewSite: 'View the site',
  pagesChange: {
    one: '{count} page changes with the next publish',
    other: '{count} pages change with the next publish'
  } satisfies Msg,
  filesOnly: {
    one: '{count} file changes (no pages)',
    other: '{count} files change (no pages)'
  } satisfies Msg,
  upToDate: 'The live site is up to date',
  plusFiles: { one: 'plus {count} file', other: 'plus {count} files' } satisfies Msg,
  lastPublished: 'last published {date}',
  pagesChangeLabel: 'Pages that change',
  pageRemoved: '{page} (removed)',
  morePages: 'and {count} more',
  noWebAddress:
    'Your site’s web address isn’t set yet, so the sitemap and social previews can’t use full links. Add it in {settings}.',
  openProjectSettings: 'Project settings'
} satisfies Record<string, Msg>
