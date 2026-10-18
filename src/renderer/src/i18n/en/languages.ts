import type { Msg } from '../types'

/** Project settings → Languages: the site's languages, one folder each. */
export default {
  title: 'Languages',
  description:
    'The default language is at the root of the site; every other language has its own folder (/it/, /de/…), with real pages linked to the ones they translate.',
  oneLanguage:
    'This site is in one language. Add a language to manage translations: its pages go in their own folder, linked to the pages they translate.',
  detected: 'This site looks like it’s in {languages}.',
  useDetected: 'Manage these languages',
  root: 'root',
  default: 'Default',
  colLanguage: 'Language',
  colCode: 'Code',
  colFolder: 'Folder',
  colPages: 'Pages',
  colActions: 'Actions',
  addLabel: 'Add a language…',
  add: 'Add',
  turnOff: 'Stop managing languages',
  turnedOff: 'Languages are no longer managed. The pages stay as they are.',
  saved: 'Languages saved.',
  rootNote:
    'Pages at the root of the site are in the first language: it’s the default one. Removing a language here doesn’t touch its pages.',
  outdated: {
    one: '{count} page needs its language or its links to translations updated.',
    other: '{count} pages need their language or their links to translations updated.'
  } satisfies Msg,
  update: 'Update pages',
  updated: {
    zero: 'Nothing needed changing.',
    one: '{count} page updated. You can revert it in Versions.',
    other: '{count} pages updated. You can revert them in Versions.'
  } satisfies Msg,
  skipped: {
    one: '{count} page with unsaved edits was left for later: update again after Save all.',
    other: '{count} pages with unsaved edits were left for later: update again after Save all.'
  } satisfies Msg,
  unsavedNote: {
    one: '({count} has unsaved edits and is updated after Save all.)',
    other: '({count} have unsaved edits and are updated after Save all.)'
  } satisfies Msg,
  whichPages: 'Which pages',
  upToDate: {
    zero: 'Every page says its language. No pages are linked as translations yet.',
    other: 'Every page says its language, and the links between translations are up to date.'
  } satisfies Msg,
  missing: {
    one: '{count} page has no {language} version yet',
    other: '{count} pages have no {language} version yet'
  } satisfies Msg,
  unmanaged: {
    one: '{count} page is in the folder of a language the site doesn’t list ({folders}). It’s left as it is: add the language again to manage it, or delete the folder.',
    other:
      '{count} pages are in folders of languages the site doesn’t list ({folders}). They’re left as they are: add the language again to manage them, or delete the folder.'
  } satisfies Msg,
  conflict: 'Two {language} pages are linked as translations of the same page:',
  needsBaseUrl:
    'Search engines need full addresses in the links between translations. Fill in Base URL in the Site section above, then update the pages.',
  versions: 'Versions in other languages',
  tabPages: 'Pages',
  tabTranslations: 'Translations',
  viewLabel: 'Show',
  statusSource: 'Original',
  statusTranslated: 'Translated',
  statusNeeds: 'Needs translation',
  statusOutdated: 'Outdated',
  create: 'Create',
  creating: 'Creating…',
  createTip: 'Create the {language} version: a copy of this page in its folder, to translate',
  markTranslated: 'Mark as translated',
  openTranslations: 'Open translations',
  leftBehind: {
    one: '{count} page is in {folder}. It won’t move with the folder: after saving, it’s no longer managed. Change the folder back to keep it.',
    other:
      '{count} pages are in {folder}. They won’t move with the folder: after saving, they’re no longer managed. Change the folder back to keep them.'
  } satisfies Msg,
  turnOffConfirm: {
    one: 'Stop managing languages? The {count} page stays exactly as it is; only the list of languages here is forgotten.',
    other:
      'Stop managing languages? The {count} pages stay exactly as they are; only the list of languages here is forgotten.'
  } satisfies Msg,
  turnOffYes: 'Stop managing',
  switcherRemoveConfirm: {
    one: 'Remove the language switcher from {count} page? You can revert it in Versions.',
    other: 'Remove the language switcher from {count} pages? You can revert it in Versions.'
  } satisfies Msg,
  switcherRemoveYes: {
    one: 'Remove from {count} page',
    other: 'Remove from {count} pages'
  } satisfies Msg,
  summaryNeeds: { one: '{count} to translate', other: '{count} to translate' } satisfies Msg,
  summaryOutdated: { one: '{count} outdated', other: '{count} outdated' } satisfies Msg,
  summaryMissing: { one: '{count} not created', other: '{count} not created' } satisfies Msg,
  summaryDone: 'all translated',
  onlyWork: 'Only pages with something to do',
  allDone: 'Every page is translated and up to date.',
  createFor: 'Create the {language} version of {page}',
  whatChanged: {
    one: 'What changed ({count})',
    other: 'What changed ({count})'
  } satisfies Msg,
  changeText: 'Changed',
  changeNew: 'New',
  changeGone: 'Removed',
  changeTitle: 'Page title',
  changeDescription: 'Description',
  changeAlt: 'Image text',
  changeShow: 'Show',
  changesHidden:
    'No text you can see changed: an attribute or hidden text did. Check the page, then mark it as up to date.',
  markUpToDate: 'Mark as up to date',
  outdatedHint: 'The {language} page changed since this one was translated.',
  copyOpen: 'Copy to {language}…',
  copyTitle: 'Copy pages to {language}',
  copyIntro:
    'Each page is copied into {folder}, linked to the page it translates, and marked as needing translation. Its links go to the pages in the same language where there are some. One save: you can revert it in Versions.',
  copyAll: { one: 'All ({count} page)', other: 'All ({count} pages)' } satisfies Msg,
  copyButton: { one: 'Copy {count} page', other: 'Copy {count} pages' } satisfies Msg,
  copied: {
    one: '{count} page copied to {language}. Translate it, then mark it as translated.',
    other: '{count} pages copied to {language}. Translate them, then mark them as translated.'
  } satisfies Msg,
  switcherPosition: 'Put the switcher',
  switcherTitle: 'Language switcher',
  switcherOn: { one: 'On {count} page.', other: 'On {count} pages.' } satisfies Msg,
  switcherOff:
    'Not on the site yet. It’s a row of links, one per language, each to the same page in that language.',
  switcherAddButton: 'Add to the site…',
  switcherAddMore: 'Add in another place…',
  switcherLook: 'Change look…',
  switcherRemoved: {
    one: 'Switcher removed from {count} page.',
    other: 'Switcher removed from {count} pages.'
  } satisfies Msg,
  switcherDone: {
    one: '{count} page updated. You can revert it in Versions.',
    other: '{count} pages updated. You can revert them in Versions.'
  } satisfies Msg,
  switcherAdd: 'Add the language switcher',
  switcherRestyle: 'Language switcher look',
  switcherPlace: 'Add the switcher',
  whereTitle: 'Click where the switcher goes',
  whereHint: 'Usually in the header or the menu. Pick the element, then where it goes around it.',
  markLabel: 'Switcher',
  scopeAll: 'Every page with this part, in every language',
  displayLegend: 'Show',
  displayText: 'Text',
  displayFlag: 'Flag',
  displayBoth: 'Flag and text',
  sizeLabel: 'Size (px)',
  sizeHint: 'Leave empty to use the site’s own text size.',
  sizePlaceholder: 'Site’s size',
  gapLabel: 'Space between (px)',
  labelCol: 'Label',
  flagCol: 'Flag',
  labelFor: 'Label for {language}',
  flagFor: 'Flag for {language}',
  flagDefault: 'Default',
  switcherExplain:
    'Each link goes to the same page in that language, or to the language’s home page when the page has no version there. CraftPages keeps the links up to date as pages are translated.',
  setInLanguages: 'The default language: change it under Languages below.'
}
