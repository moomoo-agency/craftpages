import { hostname } from 'os'

/**
 * What this computer is called in sync, publish history and on the server's publish
 * record: the name chosen in Project settings → Sync, or else the system's host name.
 * Kept here (not read from settings each time) because the callers are synchronous.
 */
let chosen = ''

export function setComputerName(name: string | undefined): void {
  chosen = (name ?? '').trim().slice(0, 60)
}

export function computerName(): string {
  return chosen || hostname().replace(/\.(local|home|lan|localdomain)$/i, '') || 'This computer'
}
