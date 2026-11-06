import type { ConsentCategory } from '../../shared/types'

/**
 * Scripts and embeds CraftPages recognises, and what each one needs under the ePrivacy
 * rules: consent for analytics, marketing or embedded content, none for what the site
 * needs to work (`necessary`) or for analytics that set no cookies (`cookieless`).
 *
 * `src` is tested on a script's or iframe's address; `inline` on an inline script's code
 * and on <noscript> fallbacks (tracking pixels). The first match wins.
 */
export interface Signature {
  id: string
  name: string
  category: ConsentCategory | 'cookieless'
  src?: RegExp
  inline?: RegExp
}

export const SIGNATURES: Signature[] = [
  // Analytics
  {
    id: 'gtm',
    name: 'Google Tag Manager',
    category: 'analytics',
    src: /googletagmanager\.com\/(gtm\.js|ns\.html)/i,
    inline: /googletagmanager\.com\/gtm\.js|gtm\.start/i
  },
  {
    id: 'ga4',
    name: 'Google Analytics',
    category: 'analytics',
    src: /googletagmanager\.com\/gtag\/js|google-analytics\.com\/(analytics|ga)\.js/i,
    inline: /\bgtag\s*\(\s*['"]config['"]|google-analytics\.com|\bga\s*\(\s*['"]create['"]/i
  },
  {
    id: 'hotjar',
    name: 'Hotjar',
    category: 'analytics',
    src: /static\.hotjar\.com|script\.hotjar\.com/i,
    inline: /static\.hotjar\.com|\bhjid\b/i
  },
  {
    id: 'clarity',
    name: 'Microsoft Clarity',
    category: 'analytics',
    src: /clarity\.ms\//i,
    inline: /clarity\.ms\/tag/i
  },
  {
    id: 'yandex',
    name: 'Yandex Metrica',
    category: 'analytics',
    src: /mc\.yandex\.(ru|com)|cdn\.jsdelivr\.net\/npm\/yandex-metrica-watch/i,
    inline: /mc\.yandex\.(ru|com)\/metrika/i
  },
  {
    id: 'matomo',
    name: 'Matomo',
    category: 'analytics',
    src: /matomo\.js|piwik\.js/i,
    inline: /\b_paq\b/i
  },
  {
    id: 'mixpanel',
    name: 'Mixpanel',
    category: 'analytics',
    src: /cdn\.mxpnl\.com|mixpanel/i,
    inline: /mixpanel\.init/i
  },
  {
    id: 'heap',
    name: 'Heap',
    category: 'analytics',
    src: /cdn\.heapanalytics\.com/i,
    inline: /heap\.load\(/i
  },
  {
    id: 'posthog',
    name: 'PostHog',
    category: 'analytics',
    src: /posthog/i,
    inline: /posthog\.init/i
  },

  // Analytics without cookies: no consent needed
  { id: 'plausible', name: 'Plausible', category: 'cookieless', src: /plausible/i },
  { id: 'umami', name: 'Umami', category: 'cookieless', src: /umami|cloud\.umami\.is/i },
  {
    id: 'cloudflare-analytics',
    name: 'Cloudflare Web Analytics',
    category: 'cookieless',
    src: /static\.cloudflareinsights\.com\/beacon/i
  },
  { id: 'fathom', name: 'Fathom', category: 'cookieless', src: /cdn\.usefathom\.com/i },
  {
    id: 'simple-analytics',
    name: 'Simple Analytics',
    category: 'cookieless',
    src: /scripts\.simpleanalyticscdn\.com/i
  },
  { id: 'goatcounter', name: 'GoatCounter', category: 'cookieless', src: /gc\.zgo\.at/i },

  // Marketing
  {
    id: 'meta-pixel',
    name: 'Meta Pixel',
    category: 'marketing',
    src: /connect\.facebook\.net\/[^/]+\/fbevents\.js/i,
    inline: /\bfbq\s*\(|facebook\.com\/tr\?/i
  },
  {
    id: 'facebook-sdk',
    name: 'Facebook SDK',
    category: 'marketing',
    src: /connect\.facebook\.net\/[^/]+\/(sdk|all)\.js/i
  },
  {
    id: 'google-ads',
    name: 'Google Ads',
    category: 'marketing',
    src: /googleadservices\.com|googlesyndication\.com|doubleclick\.net/i,
    inline: /googleadservices\.com|adsbygoogle|gtag\s*\(\s*['"]config['"]\s*,\s*['"]AW-/i
  },
  {
    id: 'linkedin',
    name: 'LinkedIn Insight Tag',
    category: 'marketing',
    src: /snap\.licdn\.com/i,
    inline: /_linkedin_partner_id|px\.ads\.linkedin\.com/i
  },
  {
    id: 'tiktok',
    name: 'TikTok Pixel',
    category: 'marketing',
    src: /analytics\.tiktok\.com/i,
    inline: /\bttq\.(load|page)\b|analytics\.tiktok\.com/i
  },
  {
    id: 'pinterest',
    name: 'Pinterest Tag',
    category: 'marketing',
    src: /s\.pinimg\.com\/ct/i,
    inline: /\bpintrk\s*\(|ct\.pinterest\.com/i
  },
  {
    id: 'x-pixel',
    name: 'X (Twitter) Pixel',
    category: 'marketing',
    src: /static\.ads-twitter\.com/i,
    inline: /\btwq\s*\(/i
  },
  {
    id: 'bing-ads',
    name: 'Microsoft Advertising',
    category: 'marketing',
    src: /bat\.bing\.com/i,
    inline: /bat\.bing\.com|\buetq\b/i
  },
  {
    id: 'reddit',
    name: 'Reddit Pixel',
    category: 'marketing',
    src: /redditstatic\.com\/ads/i,
    inline: /\brdt\s*\(/i
  },
  {
    id: 'snapchat',
    name: 'Snap Pixel',
    category: 'marketing',
    src: /sc-static\.net\/scevent/i,
    inline: /\bsnaptr\s*\(/i
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    category: 'marketing',
    src: /js\.hs-scripts\.com|js\.hs-analytics\.net|js\.hsforms\.net/i
  },
  {
    id: 'intercom',
    name: 'Intercom',
    category: 'marketing',
    src: /widget\.intercom\.io/i,
    inline: /widget\.intercom\.io/i
  },

  // Embedded content
  {
    id: 'youtube',
    name: 'YouTube',
    category: 'embeds',
    src: /youtube(-nocookie)?\.com\/(embed|iframe_api)|youtu\.be\//i
  },
  { id: 'vimeo', name: 'Vimeo', category: 'embeds', src: /player\.vimeo\.com/i },
  {
    id: 'google-maps',
    name: 'Google Maps',
    category: 'embeds',
    src: /google\.[a-z.]+\/maps|maps\.google\.|maps\.googleapis\.com/i
  },
  { id: 'spotify', name: 'Spotify', category: 'embeds', src: /open\.spotify\.com\/embed/i },
  { id: 'soundcloud', name: 'SoundCloud', category: 'embeds', src: /w\.soundcloud\.com/i },
  {
    id: 'x-embed',
    name: 'X (Twitter) posts',
    category: 'embeds',
    src: /platform\.twitter\.com|platform\.x\.com/i
  },
  {
    id: 'instagram',
    name: 'Instagram posts',
    category: 'embeds',
    src: /instagram\.com\/(embed|p\/)/i
  },
  { id: 'tiktok-embed', name: 'TikTok videos', category: 'embeds', src: /tiktok\.com\/embed/i },
  { id: 'calendly', name: 'Calendly', category: 'embeds', src: /calendly\.com/i },
  { id: 'disqus', name: 'Disqus comments', category: 'embeds', src: /disqus\.com/i },

  // What the site needs to work
  {
    id: 'captcha',
    name: 'Spam protection (reCAPTCHA, Turnstile, hCaptcha)',
    category: 'necessary',
    src: /google\.com\/recaptcha|gstatic\.com\/recaptcha|challenges\.cloudflare\.com|hcaptcha\.com/i
  },
  { id: 'stripe', name: 'Stripe', category: 'necessary', src: /js\.stripe\.com/i },
  {
    id: 'paypal',
    name: 'PayPal',
    category: 'necessary',
    src: /paypal\.com\/sdk|paypalobjects\.com/i
  },
  { id: 'craftforms', name: 'CraftForms', category: 'necessary', src: /craftforms/i },
  {
    id: 'cdn',
    name: 'Code libraries (cdnjs, jsDelivr, unpkg, jQuery)',
    category: 'necessary',
    src: /cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com|code\.jquery\.com|ajax\.googleapis\.com/i
  }
]

export function matchSource(url: string): Signature | null {
  return SIGNATURES.find((signature) => signature.src?.test(url)) ?? null
}

export function matchInline(code: string): Signature | null {
  return SIGNATURES.find((signature) => signature.inline?.test(code)) ?? null
}
