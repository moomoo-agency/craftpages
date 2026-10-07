import { FEATURES } from '../../../shared/features'

/**
 * Opens Cloudflare's "create API token" page with CraftPages' permissions already ticked
 * (https://developers.cloudflare.com/fundamentals/api/how-to/account-owned-token-template/):
 * Workers Scripts to publish, Workers R2 Storage for sync between computers.
 */
export function tokenTemplateUrl(): string {
  const keys = [
    { key: 'workers_scripts', type: 'edit' },
    { key: 'workers_r2', type: 'edit' },
    ...(FEATURES.pages ? [{ key: 'page', type: 'edit' }] : [])
  ]
  const params = [
    `permissionGroupKeys=${encodeURIComponent(JSON.stringify(keys))}`,
    // The documented form: all accounts. Cloudflare's page lets you narrow it to one.
    'accountId=*',
    'zoneId=all',
    `name=${encodeURIComponent('CraftPages')}`
  ]
  return `https://dash.cloudflare.com/profile/api-tokens?${params.join('&')}`
}

/** Cloudflare's R2 page for an account, to turn R2 on. */
export const r2Url = (accountId: string): string =>
  `https://dash.cloudflare.com/${encodeURIComponent(accountId)}/r2/overview`
