/**
 * Static hosts with a known SFTP setup, offered as one-click presets in Settings →
 * Deploy connections. A preset is just a filled-in SFTP connection; nothing about it is
 * stored separately, so a connection is recognised by its host alone.
 */
export interface HostPreset {
  id: 'pagehaus'
  name: string
  host: string
  port: number
  /** The live address for a login name, offered as the project's site address. */
  siteUrl: (username: string) => string
  /**
   * The server's published key fingerprints (SHA-256, OpenSSH style). A preset host must
   * present one of these, even on the first connection, so there's nothing to trust blindly.
   */
  hostKeys: string[]
  /** Where the host documents this setup. */
  guideUrl: string
}

export const HOST_PRESETS: HostPreset[] = [
  {
    id: 'pagehaus',
    name: 'Pagehaus',
    host: 'sftp.pagehaus.app',
    port: 2022,
    // Extra logins look like "yoursite.designer"; the site is the part before the dot.
    siteUrl: (username) => `https://${username.split('.')[0].toLowerCase()}.pagehaus.site/`,
    // From https://pagehaus.app/help/sftp, checked against the server on 2026-11-05.
    hostKeys: [
      'SHA256:7xuQDDV9uCI+9RnbkaYrgeOcPk+JS1hsUblH+MvcVOA',
      'SHA256:wkET5chI5j8YpbAxvpEdY/OHdIWuJGZwqzNPK11pkPs',
      'SHA256:l3191214GRjJYz4xTnZ2ggFslbQiPM6AX8DyVXzIC3o'
    ],
    guideUrl: 'https://pagehaus.app/guides/publish-from-craftpages'
  }
]

/** The preset a connection belongs to, by its SFTP host. */
export function hostPreset(connection: { type: string; host?: string }): HostPreset | undefined {
  if (connection.type !== 'sftp' || !connection.host) return undefined
  const host = connection.host.trim().toLowerCase()
  return HOST_PRESETS.find((preset) => preset.host === host)
}
