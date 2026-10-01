import type { Msg } from '../types'

/** The page editor: toolbar, component bar, image and SEO side panels. */
export default {
  backToPages: 'Back to pages',
  modeLabel: 'Editor mode',
  modeEdit: 'Edit',
  modeEditTip: 'Click text on the page to edit it',
  modeInteract: 'Interact',
  modeInteractTip: 'Use the page like a visitor: buttons, menus and links work',
  viewportLabel: 'Preview width',
  viewportDesktop: 'Desktop',
  viewportTablet: 'Tablet',
  viewportMobile: 'Mobile',
  openInBrowser: 'Open in browser, with unsaved edits',
  confirmDiscardPage: 'Discard the unsaved edits on this page?',
  discardPage: 'Discard page edits',
  discardPageTip: 'Throw away the unsaved edits made on this page',
  sharedBar: {
    one: '{name} appears on {count} page. Apply edits to:',
    other: '{name} appears on {count} pages. Apply edits to:'
  } satisfies Msg,
  scopeLabel: 'Apply edits to',
  scopeAll: { one: 'All {count} page', other: 'All {count} pages' } satisfies Msg,
  scopePage: 'This page only',
  scopeHint: 'Other pages get an edit only where their copy of the element matches this one.',
  interactBar: 'Interact mode: the page runs its own scripts, with your unsaved edits applied.',
  allowExternal: 'Allow external scripts (analytics, payments, embeds)',
  frameEdit: 'Editing {path}',
  framePreview: 'Preview of {path}',
  imagePanel: 'Image',
  closePanel: 'Close panel',
  imageSize: '{width} × {height} px',
  changeImage: 'Change image…',
  chooseImage: 'Choose image…',
  altText: 'Alt text',
  altHint: 'Describe the image for screen readers and search engines.',
  untitled: 'Untitled',
  noDescription: 'No description.',
  searchPreview: 'Search result preview',
  seoTitle: 'Title',
  charCount: {
    one: '{count} character (aim for {min}–{max})',
    other: '{count} characters (aim for {min}–{max})'
  } satisfies Msg,
  metaDescription: 'Meta description',
  canonical: 'Canonical URL',
  robots: 'Robots',
  robotsHint: 'For example “noindex, nofollow”. Leave empty to let search engines index the page.',
  ogTitle: 'Social title (og:title)',
  ogDescription: 'Social description (og:description)',
  ogImage: 'Social image',
  ogImageExternal: 'Image on another site',
  ogImageNone: 'No image set',
  ogImageSize: '1200 × 630 px works best.',
  ogImageBaseUrl: 'Set the base URL in Project settings to turn this into a full URL.',
  seoDraftNote: 'SEO changes are drafts too: Save all writes them to the site folder.',
  footer: {
    one: '{count} editable element · Click text to edit it, or an image to change it · Shift+Enter adds a line break · Edits stay as drafts until you Save all (⌘S)',
    other:
      '{count} editable elements · Click text to edit it, or an image to change it · Shift+Enter adds a line break · Edits stay as drafts until you Save all (⌘S)'
  } satisfies Msg,
  pickerSocial: 'Social image',
  pickerChange: 'Change image'
} satisfies Record<string, Msg>
