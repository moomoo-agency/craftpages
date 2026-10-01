import type { Msg } from '../types'

/** Publish screen: deploy, deployments, scheduled changes. */
export default {
  // Deploy
  emptyTitle: 'Nothing to publish',
  titleWorker: 'Publish to the Worker “{name}”',
  titleAnyWorker: 'Publish to a Cloudflare Worker',
  titlePages: 'Publish to the Pages project “{name}”',
  titleAnyPages: 'Publish to Cloudflare Pages',
  titleCloudflare: 'Publish to Cloudflare',
  checking: 'Checking files…',
  files: { one: '{count} file', other: '{count} files' } satisfies Msg,
  changed: {
    one: '{count} changed since the last deploy',
    other: '{count} changed since the last deploy'
  } satisfies Msg,
  changedSince: {
    one: '{count} changed since the last deploy ({date}, {branch})',
    other: '{count} changed since the last deploy ({date}, {branch})'
  } satisfies Msg,
  deployPreview: 'Deploy preview',
  publishProduction: 'Publish to production',
  hintWorker:
    'Only files whose content changed are uploaded. Every publish is kept as a version you can roll back to.',
  hintPages:
    'Only files whose content changed are uploaded. A preview deploy gets its own URL and leaves the live site as it is.',
  progressLabel: 'Deploy progress',
  deployedTo: 'Deployed to {url}',
  rolledBack: 'Production rolled back to {id}.',
  openSettings: 'Open Settings',
  foreignTitle: 'The live site was published from somewhere else',
  foreignBody:
    'The version online now was published on {date}{by} from another computer, another tool or the Cloudflare dashboard. Publishing replaces the whole site with this folder, so changes made there will be lost. Cloudflare can’t send files back: get the latest files into this folder first (from whoever published, or your git repository).',
  foreignBy: ' by {author}',
  foreignVia: ' ({source})',
  foreignPublish: 'Publish anyway',

  // Deployments
  deployments: 'Deployments',
  noDeployments: 'No deployments yet.',
  colWhen: 'When',
  colEnvironment: 'Environment',
  colBranch: 'Branch',
  colStatus: 'Status',
  colActions: 'Actions',
  envProduction: 'Production',
  envPreview: 'Preview',
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
    '“Take down anyway” puts those pages back exactly as they were before, and the changes made since are lost.'
} satisfies Record<string, Msg>
