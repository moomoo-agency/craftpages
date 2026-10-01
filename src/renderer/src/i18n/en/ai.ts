import type { Msg } from '../types'

/** AI screen: connecting an AI tool over MCP, and the proposals it sends. */
export default {
  // Connect
  connectTitle: 'Connect your AI',
  connectDescription:
    'CraftPages has no AI of its own. Connect the AI tool you already use: it reads the site and proposes changes you review here.',
  openSettings: 'Open Settings',
  connected: 'Connected: {clients}',
  waiting: 'Waiting for a connection on {url}',
  off: 'The AI connection is turned off in Settings.',
  command: 'Command that adds CraftPages to Claude Code',
  copyCommand: 'Copy the command',
  stepOpen:
    'Open the site you want to work on here in CraftPages, even an empty folder. Keep the app open while the AI works.',
  stepCommand: 'Copy this command, paste it into Terminal and press Return:',
  stepCommandHint:
    'You only do this once. Do it again only if you change the port or regenerate the token. It contains the token, so keep it private.',
  stepStart:
    'Start Claude Code: in Terminal, type “claude” and press Return. When it connects, the status above says “Connected”.',
  stepStartHint:
    'Claude Code already open? Quit it and start it again, because it only connects when it starts. Type “/mcp” in it to check that craftpages is connected.',
  stepAsk:
    'Tell Claude what you want, for example “create a base layout with a header and footer, plus Home, About and Contact pages”. You can also select an element in the page editor and ask it to restyle “the selected section”. Its changes show up below as proposals: check the preview, then click Accept or Reject.',
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
