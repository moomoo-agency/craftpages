import type { ConsentCategory } from './types'

/**
 * Analytics and ads tags CraftPages can add to every page from an ID. Shared by the main
 * process (which writes the tags) and the screen (which asks for the fields).
 *
 * The ids match the consent signatures (src/main/consent/signatures.ts), so a tag added
 * here and the same tag pasted by hand are the same thing on the consent list.
 */
export type TrackingKind =
  | 'ga4'
  | 'gtm'
  | 'meta-pixel'
  | 'clarity'
  | 'linkedin'
  | 'tiktok'
  | 'plausible'
  | 'umami'
  | 'cloudflare-analytics'
  | 'custom'

export type TrackingFieldKey = 'id' | 'domain' | 'script' | 'name' | 'code'

export interface TrackingField {
  key: TrackingFieldKey
  placeholder: string
  /** Checked on the trimmed value; optional fields may be left empty. */
  pattern?: RegExp
  optional?: boolean
  /** Filled in when empty: from the site's address or a provider default. */
  fallback?: 'site-host' | string
  long?: boolean
}

export interface TrackingProvider {
  kind: TrackingKind
  name: string
  /** What it needs from visitors; 'chosen' for a pasted snippet. */
  category: 'analytics' | 'marketing' | 'cookieless' | 'chosen'
  fields: TrackingField[]
}

export const TRACKING_PROVIDERS: TrackingProvider[] = [
  {
    kind: 'ga4',
    name: 'Google Analytics 4',
    category: 'analytics',
    fields: [{ key: 'id', placeholder: 'G-XXXXXXXXXX', pattern: /^G-[A-Z0-9]{4,16}$/i }]
  },
  {
    kind: 'gtm',
    name: 'Google Tag Manager',
    category: 'analytics',
    fields: [{ key: 'id', placeholder: 'GTM-XXXXXXX', pattern: /^GTM-[A-Z0-9]{4,12}$/i }]
  },
  {
    kind: 'meta-pixel',
    name: 'Meta Pixel',
    category: 'marketing',
    fields: [{ key: 'id', placeholder: '123456789012345', pattern: /^\d{8,20}$/ }]
  },
  {
    kind: 'clarity',
    name: 'Microsoft Clarity',
    category: 'analytics',
    fields: [{ key: 'id', placeholder: 'abcd1234ef', pattern: /^[a-z0-9]{6,16}$/i }]
  },
  {
    kind: 'linkedin',
    name: 'LinkedIn Insight Tag',
    category: 'marketing',
    fields: [{ key: 'id', placeholder: '1234567', pattern: /^\d{3,12}$/ }]
  },
  {
    kind: 'tiktok',
    name: 'TikTok Pixel',
    category: 'marketing',
    fields: [{ key: 'id', placeholder: 'C1ABCDEFGHIJKLMNOPQR', pattern: /^[A-Z0-9]{10,30}$/i }]
  },
  {
    kind: 'plausible',
    name: 'Plausible',
    category: 'cookieless',
    fields: [
      {
        key: 'domain',
        placeholder: 'example.com',
        pattern: /^[a-z0-9.-]+\.[a-z]{2,}(,[a-z0-9.-]+\.[a-z]{2,})*$/i,
        fallback: 'site-host'
      },
      {
        key: 'script',
        placeholder: 'https://plausible.io/js/script.js',
        pattern: /^https:\/\/\S+$/i,
        optional: true,
        fallback: 'https://plausible.io/js/script.js'
      }
    ]
  },
  {
    kind: 'umami',
    name: 'Umami',
    category: 'cookieless',
    fields: [
      {
        key: 'id',
        placeholder: '94db1cb1-74f4-4a40-ad6c-962362670409',
        pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      },
      {
        key: 'script',
        placeholder: 'https://cloud.umami.is/script.js',
        pattern: /^https:\/\/\S+$/i,
        optional: true,
        fallback: 'https://cloud.umami.is/script.js'
      }
    ]
  },
  {
    kind: 'cloudflare-analytics',
    name: 'Cloudflare Web Analytics',
    category: 'cookieless',
    fields: [
      { key: 'id', placeholder: '0123456789abcdef0123456789abcdef', pattern: /^[0-9a-f]{32}$/i }
    ]
  },
  {
    kind: 'custom',
    name: 'Other script',
    category: 'chosen',
    fields: [
      { key: 'name', placeholder: 'Chat widget', pattern: /^.{1,60}$/ },
      { key: 'code', placeholder: '<script src="https://…"></script>', long: true }
    ]
  }
]

export const trackingProvider = (kind: TrackingKind): TrackingProvider | undefined =>
  TRACKING_PROVIDERS.find((provider) => provider.kind === kind)

/** One provider on the site, as its tags say. */
export interface TrackingTag {
  /** The marker on its tags: the kind, or custom:<slug> for a pasted snippet. */
  key: string
  kind: TrackingKind
  name: string
  values: Partial<Record<TrackingFieldKey, string>>
  /** What its tags wait for (the consent mark), or null: runs for everyone. */
  category: ConsentCategory | null
  /** Pages with its tags. */
  pages: number
  /** Pages that should have it and don't (added since, or skipped for unsaved edits). */
  missing: string[]
}

export interface TrackingState {
  /** Cookie consent is on: new tags are written held. */
  consent: boolean
  pages: string[]
  /** Pages with <meta name="craftpages:tracking" content="exclude">. */
  excluded: string[]
  tags: TrackingTag[]
  /** Providers on the pages that CraftPages didn't add: adding the same one would count twice. */
  byHand: { kind: TrackingKind; name: string; pages: number }[]
}

export interface TrackingInput {
  kind: TrackingKind
  values: Partial<Record<TrackingFieldKey, string>>
  /** For a pasted snippet: what it needs from visitors. */
  category?: ConsentCategory
  /** The tag being changed; omitted to add a new one. */
  key?: string
}
