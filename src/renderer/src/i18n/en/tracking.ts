import type { Msg } from '../types'

/** Analytics & tracking: tags added to every page from an ID, on the Tracking & consent screen. */
export default {
  title: 'Analytics & tracking',
  description:
    'Pick a service and paste its ID: CraftPages adds its tag to every page, and to pages you add later.',
  none: 'No analytics yet.',
  colService: 'Service',
  colStatus: 'Now',
  waits: 'Waits for consent',
  waitsOff: 'Runs without asking (cookie consent is off)',
  runs: 'Runs for everyone',
  cookieless: 'Runs: sets no cookies',
  missing: {
    one: 'Not yet on {count} page',
    other: 'Not yet on {count} pages'
  } satisfies Msg,
  onPages: {
    one: 'On {count} page',
    other: 'On {count} pages'
  } satisfies Msg,
  edit: 'Edit',
  remove: 'Remove',
  removed: '{name} removed from every page.',
  added: '{name} added.',
  changed: '{name} changed.',
  byHand:
    'Your pages already load {name}, added by hand ({count} pages). Adding it here as well would count every visit twice: remove the pasted code first, or leave it as it is.',

  // Adding
  addTitle: 'Add a service',
  editTitle: 'Change {name}',
  service: 'Service',
  chooseService: 'Choose a service…',
  groupAnalytics: 'Analytics',
  groupMarketing: 'Ads and marketing',
  groupCookieless: 'Analytics without cookies',
  groupOther: 'Other',
  add: 'Add to every page',
  save: 'Save',
  cancel: 'Cancel',
  categoryLabel: 'What it does',
  categoryHint: 'Decides which consent the visitor gives before it runs.',
  needsConsentOff:
    'In the EU and UK, {name} needs visitors’ consent before it runs, and cookie consent is off.',
  alsoConsent: 'Also turn on cookie consent (recommended)',
  needsConsentOn: 'It waits for consent: it runs only for visitors who allow {category}.',
  noConsentNeeded: '{name} sets no cookies, so it runs without asking. No banner needed.',

  // Fields
  field_id: 'ID',
  field_domain: 'Domain',
  field_script: 'Script address',
  field_name: 'Name',
  field_code: 'Code',
  scriptHint: 'Only if you host it yourself. Empty uses the service’s own.',
  domainHint: 'As set up in Plausible. Empty uses the site’s address.',
  nameHint: 'How it shows here and on the consent list.',
  codeHint:
    'The code the service gave you. Only its <script> tags are added; a <noscript> part is left out.',
  hint_ga4:
    'Measurement ID, from Google Analytics → Admin → Data streams → your site. It starts with G-.',
  hint_gtm: 'Container ID, at the top of Tag Manager. It starts with GTM-.',
  'hint_meta-pixel': 'Pixel ID (digits), from Meta Events Manager → Data sources.',
  hint_clarity: 'Project ID, from Clarity → Settings → Overview.',
  hint_linkedin: 'Partner ID (digits), from Campaign Manager → Analyze → Insight Tag.',
  hint_tiktok: 'Pixel ID, from TikTok Ads Manager → Assets → Events → Web events.',
  hint_plausible: '',
  hint_umami: 'Website ID, from Umami → Settings → Websites → Edit.',
  'hint_cloudflare-analytics':
    'Token, from Cloudflare → Analytics & Logs → Web Analytics → Manage site → the snippet’s token.',
  hint_custom: '',

  // Pages without tracking
  excludedTitle: 'Pages without tracking',
  excludedDescription:
    'A thank-you page or a private page can be left out. The mark is in the page itself.',
  excludedNone: 'Every page has it.',
  excludePick: 'Leave out a page…',
  exclude: 'Leave out',
  include: 'Add back',
  excludedSet: '{path} is left out.',
  includedSet: '{path} has it again.',

  howTitle: 'How it works',
  howTags:
    'Each tag is written into the page’s <head> with a mark naming the service, so CraftPages can change or remove it later without touching anything else. The ID lives in the tag itself.',
  howConsent:
    'With cookie consent on, tags that need it are written already waiting, so they never run before the visitor agrees.',
  howPublish: 'Before each publish, pages added since get the tags too.'
}
