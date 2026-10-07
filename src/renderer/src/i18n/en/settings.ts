import type { Msg } from '../types'

/** App settings: appearance, language, background running, AI connection. */
export default {
  intro: 'These apply to every project. The open site’s own settings are in Project settings.',

  appearance: 'Appearance and language',
  appearanceHint: 'Only for this app. Site previews follow your system theme.',
  language: 'Language',
  languageHint: 'Menus, labels and messages. Your site’s content is never translated.',
  theme: 'Theme',
  themeSystem: 'Match system',
  themeLight: 'Light',
  themeDark: 'Dark',

  background: 'Scheduled changes',
  backgroundHint:
    'CraftPages publishes scheduled posts and page changes itself, on this computer. These options keep it running for that.',
  keepRunningMac:
    'Keep running in the menu bar when the window is closed and something is scheduled',
  keepRunningOther:
    'Keep running in the system tray when the window is closed and something is scheduled',
  openAtLogin: 'Open at login, in the background',
  sleepNote:
    'When a scheduled time is less than 20 minutes away, CraftPages keeps the computer from going to sleep on its own. It can’t prevent a closed lid or a shutdown: anything due then goes out as soon as the computer is back.',

  mcp: 'AI connection (MCP)',
  mcpHint:
    'A WebSocket MCP server that only this computer can reach. Your own AI tool (for example Claude Code) connects to it to read the site and propose template changes.',
  mcpEnabled: 'Accept AI connections',
  port: 'Port',
  portHint: 'Bound to 127.0.0.1 only.',
  token: 'Access token',
  showToken: 'Show token',
  hideToken: 'Hide token',
  regenerate: 'Regenerate token',
  regenerated:
    'New token created. Connected clients were disconnected: update their configuration.',
  listening: 'Listening on port {port}',
  mcpOff: 'AI connection is off',
  statusListening: 'Listening on {url}',
  statusClients: 'connected: {clients}',
  statusNoClients: 'no clients connected',
  notRunning: 'Not running',
  addToClaude: 'Add to Claude Code',
  addToClaudeHint: 'Includes the access token, so keep it private.',
  addToClaudeSteps:
    'Run the command once in Terminal, then start Claude Code by typing “claude”. If Claude Code was already open, restart it: it connects when it starts, and “/mcp” in it shows whether craftpages is connected. What it changes arrives in Template editing as proposals for you to review.',
  copyCommand: 'Copy command'
} satisfies Record<string, Msg>
