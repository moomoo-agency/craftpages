import { app } from 'electron'
import { appendFileSync, mkdirSync, readFileSync, renameSync, statSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { redact } from './redact'

/**
 * A plain-text diagnostic log users can hand over when something goes wrong:
 * `<ISO time> <LEVEL> [scope] message {details}` in the OS logs folder. Passwords,
 * tokens and passphrases never reach it (see redact.ts). Logging never throws.
 */

export { registerSecret, registerSecrets } from './redact'

type Level = 'info' | 'warn' | 'error'

const MAX_BYTES = 1024 * 1024

let file: string | null = null

export function logFile(): string {
  if (!file) file = join(app.getPath('logs'), 'craftpages.log')
  return file
}

function write(level: Level, scope: string, message: string, details?: unknown): void {
  try {
    const path = logFile()
    let line = `${new Date().toISOString()} ${level.toUpperCase().padEnd(5)} [${scope}] ${message}`
    if (details !== undefined) line += ` ${JSON.stringify(redact(details, homedir()))}`
    line = redact(line, homedir()) as string
    mkdirSync(join(path, '..'), { recursive: true })
    try {
      if (statSync(path).size > MAX_BYTES) renameSync(path, `${path}.1`)
    } catch {
      // No log yet.
    }
    appendFileSync(path, line.replace(/\r?\n/g, '\n    ') + '\n')
  } catch {
    // A log that can't be written mustn't break what it describes.
  }
}

export const log = {
  info: (scope: string, message: string, details?: unknown): void =>
    write('info', scope, message, details),
  warn: (scope: string, message: string, details?: unknown): void =>
    write('warn', scope, message, details),
  error: (scope: string, message: string, details?: unknown): void =>
    write('error', scope, message, details)
}

/** The end of the log (the rotated part first when needed), for "Copy log". */
export function readLogTail(bytes = 200 * 1024): string {
  const read = (path: string): string => {
    try {
      return readFileSync(path, 'utf8')
    } catch {
      return ''
    }
  }
  const all = read(`${logFile()}.1`) + read(logFile())
  if (all.length <= bytes) return all
  const tail = all.slice(-bytes)
  return tail.slice(tail.indexOf('\n') + 1)
}

/** Startup line plus crash handlers for the main process. */
export function startLog(): void {
  log.info('app', `CraftPages ${app.getVersion()} started`, {
    os: `${process.platform} ${process.getSystemVersion()}`,
    arch: process.arch,
    electron: process.versions.electron,
    packaged: app.isPackaged
  })
  process.on('uncaughtException', (error) => log.error('app', 'Uncaught exception', error))
  process.on('unhandledRejection', (reason) => log.error('app', 'Unhandled rejection', reason))
}
