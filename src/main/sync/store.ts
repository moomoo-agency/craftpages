import type { Snapshot } from './snapshots'
import type { SyncPresence } from '../../shared/types'

/**
 * Where a project's versions are shared between computers: a Cloudflare account (a small
 * Worker with R2 and a Durable Object) or a folder on an FTP / SFTP server. Both hold the
 * same things: file contents by hash, snapshots, and one `head` everyone agrees on.
 */

export interface RemoteHead {
  /** The latest version every computer should build on. */
  snapshot: string
  /** Goes up by one with every move; a move names the rev it expects. */
  rev: number
  at: string
  device: string
}

export interface SyncProject {
  id: string
  name: string
  /** When and from where it was last synced. */
  at: string | null
  device: string | null
}

/** Live events: someone opened a page, published, synced. */
export type LiveEvent =
  { type: 'presence'; people: SyncPresence[] } | { type: 'head'; head: RemoteHead }

export interface LiveChannel {
  /** Tells the others what this computer is doing (null page = just the project open). */
  announce: (presence: Omit<SyncPresence, 'at'>) => void
  close: () => void
}

export interface SyncStore {
  /** Null when the store has never seen this project. */
  getHead: () => Promise<RemoteHead | null>
  /**
   * Moves the head to `snapshot` if it is still at rev `expect` (0 = no head yet).
   * Returns the head as it is now either way.
   */
  moveHead: (
    expect: number,
    snapshot: string,
    device: string
  ) => Promise<{ ok: boolean; head: RemoteHead | null }>
  /** The hashes among these that the store doesn't have. */
  missing: (hashes: string[]) => Promise<string[]>
  putObject: (hash: string, data: Buffer) => Promise<void>
  getObject: (hash: string) => Promise<Buffer>
  putSnapshot: (snapshot: Snapshot) => Promise<void>
  getSnapshot: (id: string) => Promise<Snapshot | null>
  /** The project's name, for the "get a project" list on another computer. */
  putInfo: (info: { name: string }) => Promise<void>
  /** Live updates, where the store can do them. */
  live?: (onEvent: (event: LiveEvent) => void) => LiveChannel
  close: () => Promise<void>
}
