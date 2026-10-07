import type { Msg } from '../types'

/** Code mode in the page editor (Monaco). */
export default {
  loading: 'Loading the code editor…',
  files: 'Files of this page',
  unsaved: 'Unsaved changes',
  wrap: 'Wrap lines',
  preview: 'Live preview',
  previewTitle: 'Preview of the code of {path}',
  revert: 'Revert',
  saveTip:
    'Writes the file right away, outside the drafts. Each save can be undone from the history.',
  saveCount: { one: 'Write file now', other: 'Write {count} files now' } satisfies Msg,
  saved: 'Saved.',
  reload: 'Load the version on disk',
  blocked:
    'This page has unsaved visual edits. Save or discard them before editing its code, so the two don’t overwrite each other.',
  blockedSave: 'Save all edits',
  blockedDiscard: 'Discard this page’s edits',
  leaveUnsaved: {
    one: '{count} file has unsaved code changes.',
    other: '{count} files have unsaved code changes.'
  } satisfies Msg,
  leaveSave: 'Save and continue',
  leaveDiscard: 'Discard changes',
  footer:
    '{find} finds · {format} formats · The preview shows the unsaved HTML; stylesheet and script changes appear once saved',
  sharedFile: { one: '{count} page', other: '{count} pages' } satisfies Msg,
  sharedFileTip: {
    one: '{file} is used by {count} page',
    other: '{file} is used by {count} pages: a change here changes all of them'
  } satisfies Msg,
  shortcutWrites: '{shortcut} writes the file'
} satisfies Record<string, Msg>
