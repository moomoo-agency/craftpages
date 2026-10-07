import type { Msg } from '../types'

/** AI screen: connecting an AI tool over MCP, and the proposals it sends. */
export default {
  // Connect
  openSettings: 'AI connection settings',
  conceptTitle: 'Template editing with AI',
  concept:
    'Today, the effective way to change a site’s templates, or create new ones, is with an AI. Your AI tool (connected in App settings) reads the site and sends its changes here as proposals: check the diff and the preview, then accept or reject each one. Accepted changes can be reverted.',
  conceptCode:
    'For an individual fix on one page or template, open the page and switch to Code mode.',
  notConnected: 'Ready, but no AI is connected. Set it up in App settings → AI connection.',
  connected: 'Connected: {clients}',
  off: 'The AI connection is turned off in Settings.',
  autoAccept: 'Accept proposals automatically until the app quits',
  autoAcceptHint: 'Every change can still be reverted below.',

  // Proposals
  proposals: 'Proposals',
  waitingCount: { one: '{count} waiting', other: '{count} waiting' } satisfies Msg,
  empty: 'No proposals yet. Changes your AI suggests appear here with a diff and a live preview.',
  files: { one: '{count} file', other: '{count} files' } satisfies Msg,
  statusPending: 'Waiting for you',
  statusAccepted: 'Accepted',
  statusRejected: 'Rejected',
  statusReverted: 'Reverted',
  statusFailed: 'Failed',
  accept: 'Accept',
  reject: 'Reject',
  reason: 'Reason for rejecting',
  reasonPlaceholder: 'Why? Sent to the AI (optional)',
  previewAfter: 'Preview the result:',
  hidePreview: 'Hide preview',
  previewTitle: 'Preview of {path} with the proposed changes',

  // Diff
  newFile: 'New file',
  deletedFile: 'Deleted',
  linesAdded: { one: '{count} line added', other: '{count} lines added' } satisfies Msg,
  linesRemoved: { one: '{count} line removed', other: '{count} lines removed' } satisfies Msg,
  changesIn: 'Changes in {path}'
} satisfies Record<string, Msg>
