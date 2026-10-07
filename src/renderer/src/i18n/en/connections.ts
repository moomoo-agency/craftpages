import type { Msg } from '../types'

/** Deploy connections (app settings): the accounts projects publish to. */
export default {
  title: 'Deploy connections',
  descriptionKeychain:
    'Where your sites are published: Cloudflare accounts (yours, a client’s) and web hosts over FTP or SFTP. Each project picks one. Tokens and passwords are stored in the OS keychain, never in a project folder.',
  descriptionMemory:
    'Where your sites are published: Cloudflare accounts (yours, a client’s) and web hosts over FTP or SFTP. Each project picks one. No OS keychain was found, so tokens and passwords are kept in memory only and lost when you quit. They’re never stored in a project folder.',
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
  syncReady: 'Sync between computers: ready.',
  syncNeedsPermission:
    'Sync between computers needs one more permission on the token (Workers R2 Storage · Edit).',
  syncR2Off: 'Sync between computers needs R2 storage, which isn’t turned on in this account yet.',
  capPublish: 'Publish',
  capSync: 'Sync between computers',
  capUpdateToken: 'Update the token for sync…',
  capTurnOnR2: 'Turn on R2 for sync…',
  createToken: 'Create a token with the right permissions',
  upgradeTitle: 'This token can publish, but not sync',
  upgradeBody:
    'Publishing keeps working as it is. Sync between computers keeps its data in R2 storage in your Cloudflare account, so the token also needs <b>Account · Workers R2 Storage · Edit</b>.',
  upgradeStep1:
    'Create a new token with everything CraftPages uses (or add that permission to this one in Cloudflare):',
  upgradeCreate: 'Create the token in Cloudflare',
  upgradeStep2:
    'On that page you can limit it to this account under Account Resources. Then copy the token Cloudflare shows and paste it here. It replaces the old one, in the keychain.',
  upgradePaste: 'Paste the new token',
  upgradeSave: 'Save and check',
  upgradeDisabledTitle: 'R2 storage isn’t turned on in this account',
  upgradeDisabledBody:
    'Publishing keeps working as it is. Sync between computers keeps its data in Cloudflare R2, which each account turns on once (the free tier is enough; Cloudflare may ask for a payment method).',
  upgradeOpenR2: 'Open R2 in Cloudflare',
  upgradeCheckAgain: 'Check again',
  upgradeStillMissing:
    'The token still can’t reach R2. Check that it has Workers R2 Storage · Edit for this account.',
  upgradeStillDisabled:
    'R2 still looks turned off for this account. It can take a minute after turning it on.',
  upgradeCantPublish:
    'This token can’t publish (no access to Workers). Use a token with Workers Scripts · Edit and Workers R2 Storage · Edit.',
  upgradeDone: '“{name}” can now publish and sync.',
  serverWorks: 'Connected. The login starts in {home}. Folders there: {folders}.',
  serverNoFolders: 'none',
  serverWorksNamed: '“{name}” works. The login starts in {home}.',
  savedServer:
    'Saved “{name}” and logged in (starts in {home}). Pick the site’s folder in Project settings → Deploy.',
  savedServerFailed: 'Saved “{name}”, but logging in failed: {error}',
  addCloudflare: 'Add Cloudflare…',
  addServer: 'Add FTP / SFTP server…',
  keyFile: 'Key file {file}',
  passwordSaved: 'Password saved',
  noPassword: 'No password',
  checking: 'Connecting…',
  // Form
  newConnection: 'New connection',
  editConnection: 'Edit “{name}”',
  type: 'Type',
  name: 'Name',
  namePlaceholder: 'My Cloudflare',
  accountId: 'Account ID',
  accountIdHint: 'In Cloudflare: Workers & Pages, in the right sidebar.',
  accountIdPlaceholder: '32-character ID',
  token: 'API token',
  tokenHintWorkers:
    'Publishing needs <b>Account · Workers Scripts · Edit</b>; sync between computers also needs <b>Account · Workers R2 Storage · Edit</b>.',
  tokenHint:
    'Needs <b>Account · Workers Scripts · Edit</b> to publish as a Worker, or <b>Account · Cloudflare Pages · Edit</b> for Pages. Create it in Cloudflare → My Profile → API Tokens.',
  tokenKeep: 'Leave empty to keep the saved token',
  tokenPaste: 'Paste the token',
  showToken: 'Show token',
  type_cloudflare: 'Cloudflare (Workers)',
  type_sftp: 'SFTP (recommended)',
  type_ftp: 'FTP / FTPS',
  namePlaceholderServer: 'My hosting',
  host: 'Server',
  hostHint: 'From your hosting control panel, e.g. ftp.example.com.',
  port: 'Port',
  username: 'User name',
  secure: 'Encrypt (FTPS). Turn off only if the server doesn’t support it.',
  plainFtpWarning:
    'Plain FTP sends your password and files readable by anyone on the network. Use FTPS or SFTP if your host offers it.',
  signIn: 'Sign in with',
  signInPassword: 'Password',
  signInKey: 'Key file',
  keyPath: 'Private key file',
  keyPathHint:
    'Usually in ~/.ssh, e.g. id_ed25519. The file stays where it is; only its location is saved.',
  password: 'Password',
  passwordHint: 'Stored in the OS keychain, never in the project folder.',
  passphrase: 'Key passphrase',
  passphraseHint: 'Leave empty if the key has none.',
  passwordKeep: 'Leave empty to keep the saved password',
  testConnection: 'Test connection',
  hostKey: 'Server key {key}: trusted from now on. If it ever changes, CraftPages stops and asks.',
  addConnection: 'Add connection'
} satisfies Record<string, Msg>
