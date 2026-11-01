import type { DeployConnectionType } from '../../../shared/types'
import type { Key } from '../i18n'

/**
 * Web hosts the server form can fill in: type, server and port as the host documents them.
 * The site's folder is chosen per project, so `note` says what to pick there, and what goes
 * in the user name.
 */
export interface HostPreset {
  id: string
  name: string
  type: Extract<DeployConnectionType, 'sftp' | 'ftp'>
  host: string
  port?: number
  note: Key
  /** The host's own guide to publishing from CraftPages. */
  guide: string
}

export const HOSTS: HostPreset[] = [
  {
    id: 'pagehaus',
    name: 'Pagehaus',
    type: 'sftp',
    host: 'sftp.pagehaus.app',
    port: 2022,
    note: 'connections.hostNote_pagehaus',
    guide: 'https://pagehaus.app/guides/publish-from-craftpages'
  }
]
