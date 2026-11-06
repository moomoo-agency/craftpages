import type { Msg } from '../types'

/** Site-wide files on the SEO screen: redirects, the 404 page, the site icon. */
export default {
  // Redirects
  redirectsTitle: 'Redirects',
  redirectsWhereCloudflare:
    'Send an old address to a new one, so links and search results keep working after a page moves. Kept in _redirects, which Cloudflare reads.',
  redirectsWhereServer:
    'Send an old address to a new one, so links and search results keep working after a page moves. Kept in _redirects and .htaccess (Apache servers; servers running only nginx ignore it).',
  redirectsNone: 'No redirects yet.',
  redirectsSearch: 'Search redirects',
  redirectAdd: 'Add redirect',
  redirectFrom: 'Old address',
  redirectTo: 'New address',
  redirectKind: 'Kind',
  redirect301: 'Moved for good (301)',
  redirect302: 'For now (302)',
  redirectRemove: 'Remove',
  redirectRemoveLabel: 'Remove the redirect from {from}',
  redirectsSaved: 'Redirects saved. They work once the site is published.',
  redirectsUnsaved: 'Unsaved changes.',
  redirectsBlog: {
    one: 'The blog keeps {count} redirect of its own for moved posts.',
    other: 'The blog keeps {count} redirects of its own for moved posts.'
  } satisfies Msg,
  redirectsOther: {
    one: '_redirects also has {count} rule written by hand; it stays as it is.',
    other: '_redirects also has {count} rules written by hand; they stay as they are.'
  } satisfies Msg,
  redirectsHowTitle: 'Writing addresses',
  redirectsHowFolder:
    'Addresses start with a slash: /old-page, /old-folder/. For everything in a folder, end the old address with {a} and use {b} in the new one where the rest goes.',
  redirectsHowKinds:
    '“Moved for good” tells search engines to show the new address instead. Use “For now” only for a page that’s coming back.',
  warnPageExists:
    'A page is still at this address ({detail}). Remove or move it, or the redirect may not apply.',
  warnTargetMissing: 'The new address isn’t a page of this site.',
  warnChain: 'The new address redirects again ({detail}). Point straight at the final page.',

  // 404 page
  notFoundTitle: '404 page',
  notFoundMissing:
    'What visitors see at an address that doesn’t exist: a mistyped link, a page that was removed. Without one, they get the host’s plain error page.',
  notFoundExists: 'Your site has a 404 page: “{title}”. Edit it like any other page.',
  notFoundMake: 'Make a 404 page',
  notFoundRemake: 'Make it again…',
  notFoundEdit: 'Edit it',
  notFoundFrom: 'Made from',
  notFoundFromHint:
    'The page whose header, footer and styles it takes. Its own content is replaced by the message.',
  notFoundTabTitle: 'Title (browser tab)',
  notFoundHeading: 'Heading',
  notFoundMessage: 'Message',
  notFoundLink: 'Link to the home page',
  notFoundSearch: 'Search button',
  notFoundSearchHint: 'Added when site search is on. Leave empty for none.',
  notFoundCreate: 'Make the page',
  notFoundReplace: 'Replace the page',
  notFoundReplaces: 'This replaces 404.html, including any edits made to it. Undo brings it back.',
  notFoundMade: '404 page made: 404.html. It goes live with the next publish.',
  notFoundServer: 'Your server doesn’t know about the page yet.',
  notFoundServerFix: 'Add it to .htaccess',
  notFoundServerDone: '.htaccess now points to the 404 page.',
  notFoundDefaultTitle: 'Page not found',
  notFoundDefaultHeading: 'This page isn’t here',
  notFoundDefaultMessage: 'It may have moved, or the address may have a typo.',
  notFoundDefaultLink: 'Go to the home page',
  notFoundDefaultSearch: 'Search the site',

  // Site icon
  iconTitle: 'Site icon',
  iconNone:
    'No icon yet: browser tabs, bookmarks and search results show a blank one. Choose one image and CraftPages makes every size.',
  iconOurs: 'Every size is made from one image ({icon} and the rest).',
  iconTheirs: 'Your pages point at {icon}. Choose an image to make the full set from it instead.',
  iconChoose: 'Choose an image…',
  iconChange: 'Change…',
  iconSmall:
    'The image is {width}×{height} px. Use at least 512×512 (or an SVG), or the largest icon comes out blurry.',
  iconNotSquare: 'The image isn’t square: it’s fitted inside a square with clear space around it.',
  iconBackground: 'Home screen background',
  iconBackgroundHint:
    'Phones show a transparent icon on black; this colour fills behind it on the home screen icon.',
  iconReplaces: 'The icon tags already on your pages are replaced.',
  iconMake: 'Make the icon',
  iconMade: 'Site icon made.',
  iconAdded: 'Icon added.',
  iconMissing: {
    one: '{count} page doesn’t have the icon yet. <link>Add it</link>',
    other: '{count} pages don’t have the icon yet. <link>Add it</link>'
  } satisfies Msg,
  iconHelp:
    'Written at the top of the site: favicon.ico (16, 32 and 48 px), apple-touch-icon.png, icon-192.png, icon-512.png and site.webmanifest, plus favicon.svg when the image is an SVG. Each page’s <head> gets the tags.'
}
