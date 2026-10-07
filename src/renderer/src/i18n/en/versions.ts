import type { Msg } from '../types'

/** Publish → History: published versions of the project. */
export default {
  title: 'Publish history',
  description:
    'Every publish is kept as a version in the project folder, with what changed. Put an older version back, or save it as a separate folder.',
  empty: 'No versions yet. The next publish is kept here.',
  live: 'Live',
  from: 'from {device}',
  firstVersion: {
    one: 'first version, {count} file',
    other: 'first version, {count} files'
  } satisfies Msg,
  changes: '+{added} new · {changed} changed · −{removed} removed',
  keptOff: {
    one: '{count} file kept off the site',
    other: '{count} files kept off the site'
  } satisfies Msg,
  restore: 'Restore…',
  restoreConfirm:
    'Put the site files in this folder back as they were in this version? You can undo it.',
  restoreYes: 'Restore',
  export: 'Save as folder…',
  restored: {
    one: 'Restored {count} file to the version of {date}. Publish to put it live.',
    other: 'Restored {count} files to the version of {date}. Publish to put it live.'
  } satisfies Msg,
  alreadyThere: 'The folder already matches this version.',
  exported: 'Saved as a complete project in {folder}.',
  undone: 'Undone.',
  added: 'New',
  changed: 'Changed',
  removed: 'Removed',
  unpublishedList: 'Kept off the site',
  noChanges: 'No file changed since the version before.',
  more: { one: '…and {count} more', other: '…and {count} more' } satisfies Msg
} satisfies Record<string, Msg>
