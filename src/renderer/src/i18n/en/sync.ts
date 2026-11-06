import type { Msg } from '../types'

/** Sync between computers: Project settings → Sync, the sidebar status, getting a project. */
export default {
  title: 'Sync between computers',
  description:
    'Work on this project from several computers. Every computer gets the others’ changes, unsaved edits and publish history, and sees who has which page open.',
  where: 'Keep the sync data in',
  modeCloudflare: 'Cloudflare',
  modeServer: 'FTP / SFTP server',
  modeCloudflareHint:
    'Your own Cloudflare account. Changes and who’s editing show up on the other computers within seconds.',
  modeServerHint:
    'A folder on your hosting, encrypted with a passphrase. The other computers notice changes within a minute or so.',
  connection: 'Connection',
  noConnections: 'No fitting connection yet: add one in App settings → Deploy connections.',
  tokenCheckFailed:
    'Couldn’t check what this token can do. Check the internet connection, or test the connection in App settings.',
  folder: 'Sync folder on the server',
  folderHint:
    'Best outside the website folder (next to public_html, not in it). Several projects can share it.',
  passphrase: 'Sync passphrase',
  passphraseChooseHint:
    'Encrypts everything in the sync folder. The other computers need it too; it can’t be recovered, so keep it somewhere safe.',
  passphraseHint: 'The passphrase chosen when sync was turned on.',
  passphraseRepeat: 'Repeat the passphrase',
  passphraseMismatch: 'The two passphrases don’t match.',
  setupCloudflare:
    'Turning sync on sets up a small Worker named craftpages-sync and an R2 bucket in this account (both within the free tier). The API token needs Workers Scripts · Edit and Workers R2 Storage · Edit.',
  setupServer:
    'Turning sync on creates the sync folder if needed. Only this app can read it: everything in it is encrypted.',
  turnOn: 'Turn on sync',
  settingUp: 'Setting up…',
  enabled: 'Sync is on.',
  syncNow: 'Sync now',
  turnOff: 'Turn off sync',
  turnOffConfirm: 'Stop syncing on this computer? Nothing is deleted, here or in the sync store.',
  turnedOff: 'Sync is off on this computer.',
  factWhere: 'Sync data',
  factLast: 'Last sync here',
  factLatest: 'Latest sync',
  factPeople: 'Open now on',
  latest: '{device}, {date}',
  newer: 'Newer than this folder',
  nobody: 'No other computer',
  personOn: '{device} ({page})',
  presenceNote:
    '{names} also has this project open. Edits to the same page on two computers are merged when you sync; if both changed the same file, you choose which to keep.',
  neverSynced: 'Not synced yet',
  lastSync: 'Last synced {date}',
  resultPulled: {
    one: '{count} change came in from {device}.',
    other: '{count} changes came in from {device}.'
  } satisfies Msg,
  resultPushed: 'This folder’s changes went up.',
  resultConflicts: {
    one: '{count} file was changed on both computers: see below.',
    other: '{count} files were changed on both computers: see below.'
  } satisfies Msg,
  resultNothing: 'Already in step: nothing to sync.',
  conflictsTitle: 'Changed on both computers',
  conflictsHelp:
    'Both computers changed the same part of these files, so they couldn’t be combined. This folder still has its own version; the other one is kept aside. Compare them, then keep one. To keep something from both, keep one and type the other change in again.',
  exposed:
    'The sync folder is inside the folder your site is published to, so it can be downloaded from the web (it’s encrypted, but it shouldn’t be public). Turn sync off, then on again with a folder next to the site’s, e.g. /craftpages-sync.',
  computerName: 'This computer’s name',
  computerNameHint: 'How your other computers and the publish history call this one.',
  computerNamePlaceholder: 'e.g. Rosa’s laptop',
  compare: 'Compare',
  keepMine: 'Keep mine',
  keptMine: 'Keeping this folder’s {path}. It goes to the other computers on the next sync.',
  onlyMine: 'Only in your version',
  onlyMineHelp: 'Lost if you use theirs.',
  onlyTheirs: 'Only in theirs',
  onlyTheirsHelp: 'Lost if you keep yours.',
  sameText: 'Same text (only code or layout differs).',
  deletedHere: 'You deleted this file.',
  deletedThere: 'They deleted this file.',
  resultMerged: {
    one: 'Changes to {files} from both computers were combined.',
    other: 'Changes from both computers were combined in {count} files ({files}).'
  } satisfies Msg,
  useTheirs: 'Use theirs',
  tookTheirs: 'Using the other computer’s {path}. Sync to share it.',
  pillOk: 'Synced',
  pillBusy: 'Syncing…',
  pillBehind: 'Get changes from {device}',
  pillAhead: 'Sync your changes',
  pillConflicts: {
    one: '{count} conflict to check',
    other: '{count} conflicts to check'
  } satisfies Msg,
  pillError: 'Sync failed: retry',
  alsoOpen: 'Also open on {names}',
  alsoEditing: 'Also open on {names}. Save often and sync, so your edits don’t collide.',
  openThere: 'Open on {device} right now',
  getButton: 'From another computer…',
  getIntro:
    'Get a project that another computer syncs: choose where its sync data is, then download it into an empty folder here.',
  find: 'Find projects',
  noProjects: 'No synced projects there yet.',
  download: 'Download…',
  downloading: 'Downloading…'
} satisfies Record<string, Msg>
