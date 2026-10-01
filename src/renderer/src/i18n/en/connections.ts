import type { Msg } from '../types'

/** Deploy connections (app settings): the accounts projects publish to. */
export default {
  title: 'Deploy connections',
  descriptionKeychain:
    'Accounts your sites deploy to, e.g. your own Cloudflare account and a client’s. Each project picks one. Tokens are stored in the OS keychain, never in a project folder.',
  descriptionMemory:
    'Accounts your sites deploy to, e.g. your own Cloudflare account and a client’s. Each project picks one. No OS keychain was found, so tokens are kept in memory only and lost when you quit. They’re never stored in a project folder.',
  add: 'Add connection…',
  empty: 'No connections yet. Add one to publish your projects.',
  tokenSaved: 'Token saved',
  noToken: 'No token',
  usedBy: 'Used by {projects}',
  notUsed: 'Not used by recent projects',
  test: 'Test',
  testLabel: 'Test “{name}”',
  editLabel: 'Edit “{name}”',
  removeLabel: 'Remove “{name}”',
  remove: 'Remove…',
  confirmRemove: 'Remove “{name}” and its token?',
  confirmRemoveUsed: 'Remove “{name}” and its token? {projects} will need another connection.',
  removeYes: 'Remove',

  // Results
  workers: { one: '{count} Worker', other: '{count} Workers' } satisfies Msg,
  pagesProjects: { one: '{count} Pages project', other: '{count} Pages projects' } satisfies Msg,
  seesBoth: 'The token sees {workers} and {pages}.',
  seesWorkersOnly: 'The token works: it sees {workers}.',
  seesWorkers:
    'The token sees {workers}. It has no access to Pages, which is fine unless you publish there.',
  seesPages:
    'The token sees {pages}. It can’t publish Workers: add Account · Workers Scripts · Edit to it.',
  seesNothing: 'The token can’t publish Workers: add Account · Workers Scripts · Edit to it.',
  saved: 'Saved “{name}”. {details}',
  savedBadTokenWorkers:
    'Saved “{name}”, but the token didn’t work. It needs Account · Workers Scripts · Edit.',
  savedBadToken:
    'Saved “{name}”, but the token didn’t work. It needs Account · Workers Scripts · Edit (to publish as a Worker) or Account · Cloudflare Pages · Edit.',
  works: '“{name}” works. {details}',
  removed: 'Removed “{name}” and its token.',

  // Form
  newConnection: 'New connection',
  editConnection: 'Edit “{name}”',
  type: 'Type',
  typeHint: 'Netlify, GitHub Pages and SFTP are planned.',
  name: 'Name',
  namePlaceholder: 'My Cloudflare',
  accountId: 'Account ID',
  accountIdHint: 'In Cloudflare: Workers & Pages, in the right sidebar.',
  accountIdPlaceholder: '32-character ID',
  token: 'API token',
  tokenHintWorkers:
    'Needs <b>Account · Workers Scripts · Edit</b>. Create it in Cloudflare → My Profile → API Tokens.',
  tokenHint:
    'Needs <b>Account · Workers Scripts · Edit</b> to publish as a Worker, or <b>Account · Cloudflare Pages · Edit</b> for Pages. Create it in Cloudflare → My Profile → API Tokens.',
  tokenKeep: 'Leave empty to keep the saved token',
  tokenPaste: 'Paste the token',
  showToken: 'Show token',
  addConnection: 'Add connection'
} satisfies Record<string, Msg>
