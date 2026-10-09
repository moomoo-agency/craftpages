import type { Msg } from '../types'

/** Site search: the search view, the guided icon setup and the icon form. */
export default {
  title: 'Site search',

  // Results of a change
  nothingChanged: 'Nothing changed.',
  pagesUpdated: {
    one: '{count} page updated.',
    other: '{count} pages updated.'
  } satisfies Msg,
  skipped: 'Skipped: {list}',
  undone: 'Undone.',
  iconsRestyled: 'Icons restyled.',
  iconAdded: 'Icon added.',
  searchAdded: 'Search added.',
  searchRemoved: 'Search removed: script, icons and index.',
  boxSaved: 'Search box saved.',
  pageSearchable: '{path} is now searchable.',
  pageLeftOut: '{path} is now left out of search.',

  // Intro (search off)
  introTitle: 'Search for your visitors',
  introText:
    'A search icon on your pages opens a clean, floating search box that shows results from every page as visitors type. It looks the same on any site, so there’s nothing to design: you only choose where the icon goes and how it looks.',
  introServerless: 'Works without a server: the index is built from your pages on every save.',
  introKeyboard: '⌘K / Ctrl+K and “/” open it too. Works with the keyboard and screen readers.',
  introClean: 'Everything stays in your HTML, and turning search off removes it cleanly.',
  introAdd: 'Add search to your site…',

  // Status (search on)
  onTitle: 'Site search is on',
  installedOn: {
    one: 'Installed on {with} of {count} page.',
    other: 'Installed on {with} of {count} pages.'
  } satisfies Msg,
  indexInfo: {
    one: 'The index ({count} page, {size}) is rebuilt on every save, blog publish and deploy.',
    other: 'The index ({count} pages, {size}) is rebuilt on every save, blog publish and deploy.'
  } satisfies Msg,
  rebuiltAlways: 'The index is rebuilt on every save, blog publish and deploy.',
  tryIt: 'Try it',
  rebuildIndex: 'Rebuild index',
  indexRebuilt: {
    one: 'Index rebuilt: {count} page, {size}.',
    other: 'Index rebuilt: {count} pages, {size}.'
  } satisfies Msg,
  turnOff: 'Turn off',
  missing: {
    one: '{count} page doesn’t have search yet (a new page?). <link>Add search to it</link>',
    other: '{count} pages don’t have search yet (new pages?). <link>Add search to them</link>'
  } satisfies Msg,
  indexLarge:
    'The index is {size}, which visitors download the first time they search. That stays quick on a fast connection but slows down on mobile. Leave long or archive pages out (“What’s searchable” below) or mark repeated blocks with data-craftpages-search-ignore.',
  tryHelp:
    'Your home page with its scripts running. Press Esc to close the box; click the icon or press ⌘K / Ctrl+K in the preview to open it again. In the page editor, search works in Interact mode (Edit mode switches the site’s scripts off).',
  closePreview: 'Close preview',
  tryFrame: 'Search preview on the home page',

  // Search icon
  iconTitle: 'Search icon',
  triggersSummary: {
    one: 'Icons or buttons that open search: {triggers}, on {count} page.',
    other: 'Icons or buttons that open search: {triggers}, on {count} pages.'
  } satisfies Msg,
  noTriggers: 'Nothing on your pages opens search yet, apart from ⌘K / Ctrl+K.',
  addAnotherIcon: 'Add another icon…',
  addIcon: 'Add an icon…',
  changeLook: 'Change the look…',
  iconPreview: 'Search icon on a light and a dark background',
  iconOwn:
    'Need it somewhere the icon tool can’t reach, or in your own design? Give any button or link the {attr} attribute, or paste the icon’s markup.',
  copyMarkup: 'Copy icon markup',

  // Search box
  boxTitle: 'Search box',
  boxDescription:
    'Its own minimal design on every site, light or dark to match the visitor’s system.',
  accent: 'Accent color',
  accentHint: 'Highlights the selected result and matching words. Leave empty for neutral grey.',
  theme: 'Theme',
  themeAuto: 'Follow system',
  themeLight: 'Light',
  themeDark: 'Dark',
  themeHint: 'Follow system matches each visitor’s setting.',
  placeholder: 'Placeholder',
  placeholderHint: 'Leave empty for “{text}”, in the page’s language.',
  emptyText: 'No results text',
  emptyTextHint: 'Leave empty for “{text}”, in the page’s language.',
  shortcut: 'Open with ⌘K / Ctrl+K and “/”',
  suggested: 'Suggested pages',
  suggestedHint:
    'Shown when the box opens, before anything is typed. Select none for an empty box.',

  // What's searchable
  indexedTitle: 'What’s searchable',
  indexedDescription:
    'The main content of each page, split at its headings; results jump to the heading or section. Header, navigation, footer, forms and anything marked {attr} are skipped.',
  colPage: 'Page',
  colInSearch: 'In search',
  colTriggers: 'Triggers',
  excludedNo: 'No · {reason}',
  excluded404: 'Not found page',
  excludedMeta: 'Left out',
  leaveOutHelp:
    'Leaving a page out adds a {meta} meta tag to it. Blog posts and lists follow their layout page.',

  // Guided setup
  positionAfter: 'After it',
  positionBefore: 'Before it',
  positionEnd: 'Inside, at the end',
  positionStart: 'Inside, at the start',
  markLabel: 'Search icon goes here',
  applyAll: 'Apply to all icons',
  placeIcon: 'Place icon',
  addSearchSite: 'Add search to the site',
  pageSelect: 'Page',
  screenSize: 'Screen size',
  desktop: 'Desktop',
  mobile: 'Mobile',
  setupFrame: 'Page preview: {page}',
  opening: 'Opening {page}…',
  setupRestyle: 'Change the icon’s look',
  setupAddIcon: 'Add a search icon',
  setupAdd: 'Add search',
  steps: 'Steps',
  stepWhere: '1 · Where',
  stepLook: '2 · Look',
  stepDone: '(done)',
  whereTitle: 'Click where the search icon should go',
  whereHint: 'Usually in the header, next to the menu. The icon appears there right away.',
  selectParent: 'Select the surrounding element',
  positionLegend: 'Put the icon',
  scopeLegend: 'Add it to',
  scopeAll: 'Every page with this header',
  scopePage: 'This page only',
  ownTrigger:
    'Using your own trigger instead? <link>Turn search on without an icon</link> and give any button or link the {attr} attribute.',
  noIconsYet: 'No icons placed yet; this look is used for the next one.',
  nextLook: 'Next: the look',

  // Icon form
  icon: 'Icon',
  iconCustom: 'Custom SVG',
  iconSearch: 'Magnifier',
  iconTextSearch: 'Lines',
  iconScanSearch: 'Frame',
  iconSearchCircle: 'Circle',
  iconSearchSquare: 'Square',
  iconCommand: 'Command',
  svgMarkup: 'SVG markup',
  svgHint: 'Scripts, links and event handlers are removed.',
  size: 'Size (px)',
  lineWidth: 'Line width',
  padding: 'Padding (px)',
  radius: 'Corner radius (px)',
  color: 'Color',
  colorHint: '{current} follows the text around it; {variable} works too.',
  background: 'Background',
  backgroundHint: 'Use {transparent} for none.',
  label: 'Label',
  labelHint: 'Read by screen readers and shown on hover.',
  pickColor: '{label}: pick a color'
} satisfies Record<string, Msg>
