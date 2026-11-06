import type { Msg } from '../types'

/** Cookie consent: what the pages load, what waits for consent, the banner. */
export default {
  title: 'Tracking & consent',
  searchItems: 'Search scripts',

  // Off
  offTitle: 'Cookie consent is off',
  offNeeds: {
    one: 'Your pages load {count} thing that needs visitors’ consent first in the EU and UK: {names}.',
    other:
      'Your pages load {count} things that need visitors’ consent first in the EU and UK: {names}.'
  } satisfies Msg,
  offNothing:
    'Nothing on your pages needs consent right now. Turn it on anyway if you plan to add analytics or embeds: they’ll wait for consent from the start.',
  turnOn: 'Turn on cookie consent',
  pointScan:
    'CraftPages finds the analytics, ads pixels and embeds on every page, and holds each one until the visitor agrees.',
  pointFair:
    'The banner offers Accept and Reject side by side, and visitors can change their mind later.',
  pointFiles:
    'It all stays in your pages: a small script, and a mark on each held tag. Turning it off puts every tag back.',
  turnedOn: 'Cookie consent is on.',

  // On
  onTitle: 'Cookie consent is on',
  onSummary: 'The banner is on {with} of {count} pages. Waiting for consent: {held}.',
  turnOff: 'Turn off',
  turnedOff: 'Cookie consent is off: every tag is back as it was.',
  unknownNotice: {
    one: 'CraftPages doesn’t recognise {names}. It runs without asking until you choose what it is below.',
    other:
      'CraftPages doesn’t recognise {count} scripts ({names}). They run without asking until you choose what they are below.'
  } satisfies Msg,
  missing: {
    one: '{count} page doesn’t have the banner yet (added after it was turned on). <link>Add it</link>',
    other:
      '{count} pages don’t have the banner yet (added after it was turned on). <link>Add it</link>'
  } satisfies Msg,
  tryHelp:
    'Your home page, with the choices open. What you choose here stays in this preview only.',
  tryFrame: 'Cookie banner preview',

  // What the pages load
  itemsTitle: 'What your pages load',
  itemsDescription:
    'Scripts and embeds from other sites, found in every page. Each is held until the visitor allows its category, or runs as part of the site.',
  itemsNone: 'Your pages load nothing from other sites that CraftPages can see.',
  colWhat: 'Script or embed',
  colStatus: 'Now',
  colCategory: 'Category',
  onPages: {
    one: 'On {count} page',
    other: 'On {count} pages'
  } satisfies Msg,
  notRecognised: 'not recognised',
  statusHeld: 'Waits for consent',
  statusPartly: 'Waits on some pages, runs on others',
  statusRuns: 'Runs without asking',
  statusNecessary: 'Runs: needed by the site',
  statusUnknown: 'Runs: not classified yet',
  statusCookieless: 'Runs: sets no cookies',
  noneNeeded: 'No consent needed',
  unknown: 'Not recognised',
  choose: 'Choose…',
  catNecessary: 'Necessary',
  catAnalytics: 'Analytics',
  catMarketing: 'Marketing',
  catEmbeds: 'Embedded content',
  categorySet: '{name}: {category}.',
  howTitle: 'How it works',
  howHeld:
    'A held script is written with {code} and a mark naming its category, so browsers skip it. After the visitor agrees, the banner’s script runs it, in page order. Embeds show a short note with an Allow button until then.',
  howNecessary:
    '“Necessary” lets a script run for everyone (spam protection, payments, the site’s own code). The choice is written into the tag, so it’s kept.',
  howNew:
    'Before each publish, recognised scripts added since (by hand, by your AI, on a new page) are held too.',

  // Banner
  bannerTitle: 'Banner',
  bannerDescription:
    'Where it shows and what it says. Empty fields use the built-in text in the page’s language.',
  bannerSaved: 'Banner saved.',
  position: 'Position',
  positionBar: 'Bar along the bottom',
  positionBox: 'Box in the corner',
  language: 'Text for',
  languageHint: 'Each language’s pages get their own words.',
  reopenButton: 'Show a small button that opens the choices again',
  reopenOwn:
    'Or add the {attr} attribute to any link or button of your own, such as “Cookie settings” in the footer.',
  textTitle: 'Title',
  textMessage: 'Message',
  textAccept: 'Accept button',
  textReject: 'Reject button',
  textChoose: 'Choose button',
  textSave: 'Save button',
  textPrivacy: 'Privacy link text',
  textPrivacyUrl: 'Privacy page',
  privacyUrlHint: 'The page that explains what you collect. Shown as a link in the banner.',
  builtIn: 'Built-in text',
  builtInHelp:
    'Built-in text exists in English, Italian, Ukrainian, German, French and Spanish, picked by the page’s lang attribute. Other languages show English unless you fill in the fields.'
}
