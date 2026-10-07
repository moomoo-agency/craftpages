import type { Msg } from '../types'

/** The SEO view: site check, defaults, robots.txt, site identity. */
export default {
  title: 'SEO',

  // Site check
  checkTitle: 'Site check',
  checking: 'Checking every page…',
  checkingShort: 'Checking…',
  checkAgain: 'Check again',
  checkSummary: {
    one: '{count} page checked. Problems: {error} · To improve: {warning} · Notes: {info}',
    other: '{count} pages checked. Problems: {error} · To improve: {warning} · Notes: {info}'
  } satisfies Msg,
  severityFilter: 'Filter by severity',
  kindFilter: 'Filter by topic',
  filterError: 'Problems',
  filterWarning: 'To improve',
  filterInfo: 'Notes',
  tagError: 'Problem',
  tagWarning: 'Improve',
  tagInfo: 'Note',
  allKinds: 'All topics',
  kindTitle: 'Titles',
  kindDescription: 'Descriptions',
  kindHeadings: 'Headings',
  kindImages: 'Images',
  kindLinks: 'Links',
  kindCanonical: 'Canonical',
  kindSocial: 'Social',
  kindLanguage: 'Language',
  kindIndexing: 'Indexing',
  nothingInFilter: 'Nothing matches this filter.',
  noIssues: 'No issues found.',
  openPage: 'Open page',
  openPageLabel: 'Open page {page}',

  // Defaults
  defaultsTitle: 'SEO defaults',
  defaultsDescription: 'Used for the pages the app generates: blog posts, lists and tag pages.',
  defaultsSaved: 'Saved. Applied the next time the blog is published.',
  titlePattern: 'Title pattern',
  titlePatternHint:
    'Use {title} and {site}. Example: “{example}”. A post’s own SEO title replaces it.',
  titlePatternExample: 'My first post',
  defaultImage: 'Default social image',
  defaultImageHint: 'For posts without a cover image. 1200 × 630 px works best.',
  sitemapAuto: 'Keep sitemap.xml complete automatically',
  sitemapAutoHint:
    'Rebuilt from all pages (except 404 and noindex pages) when the blog is published and before each deploy. When off, only blog URLs are added to your own sitemap.',
  sitemapExclude: 'Leave out of the sitemap',
  sitemapExcludeHint: 'One pattern per line, for example {a} or {b}',
  rebuildSitemap: 'Rebuild sitemap',
  sitemapRebuilt: {
    one: 'sitemap.xml rebuilt with {count} page.',
    other: 'sitemap.xml rebuilt with {count} pages.'
  } satisfies Msg,
  sitemapUpToDate: {
    one: 'sitemap.xml is already up to date ({count} page).',
    other: 'sitemap.xml is already up to date ({count} pages).'
  } satisfies Msg,
  sitemapCreated: {
    one: 'sitemap.xml created with {count} page.',
    other: 'sitemap.xml created with {count} pages.'
  } satisfies Msg,
  sitemapSettingsSaved: 'Saved.',
  sitemapDescription:
    'A file at the root of your site (/sitemap.xml) that lists your pages, so search engines find all of them.',
  sitemapCurrent: 'Up to date',
  sitemapStale: 'Out of date',
  sitemapStatus: {
    one: 'Your site has sitemap.xml: it lists {count} page and last changed on {date}.',
    other: 'Your site has sitemap.xml: it lists {count} pages and last changed on {date}.'
  } satisfies Msg,
  sitemapWouldList: {
    one: 'A rebuild would list {count} page.',
    other: 'A rebuild would list {count} pages.'
  } satisfies Msg,
  sitemapMissing: 'Your site has no sitemap.xml yet.',
  createSitemap: 'Create sitemap.xml',
  fileMissing: 'No file',
  fileExists: 'File exists',
  viewFile: 'View file',

  // robots.txt
  robotsDescription:
    'A file at the root of your site (/robots.txt) that tells search engines which parts they may crawl.',
  robotsSaved: 'robots.txt saved.',
  robotsCreated: 'robots.txt created. It goes live with your next publish.',
  robotsMissing:
    'Your site has no robots.txt. Search engines then crawl everything, which is usually fine, but the file is the standard place to point them at your sitemap.',
  robotsCreate: 'Create default robots.txt',
  robotsDefaultLabel: 'Default robots.txt',
  robotsNoSitemap:
    'There’s no Sitemap line, so search engines have to find sitemap.xml on their own. <link>Add the line</link>',

  // Site identity
  identityTitle: 'Site identity (code in index.html)',
  identityDescription:
    'Not a separate file: a block of structured data (JSON-LD) in the <head> of your home page that tells search engines the site’s name and logo.',
  identityLogo: 'logo {logo}',
  identityFound: 'Found in index.html. Blog posts reference it as their publisher.',
  identityFoundWithWebsite:
    'Found in index.html, together with WebSite data. Blog posts reference it as their publisher.',
  identityMissing: 'The home page doesn’t describe the organization yet. Add it here:',
  identityName: 'Name',
  identityUrl: 'Site URL',
  identityLogoLabel: 'Logo',
  identityAdd: 'Add to the home page',
  identityAdded: 'Added to index.html.',
  identityCode: 'This code in {file} describes it (visitors don’t see it):',
  identityAddedCode: 'This code was added to {file}, just before {head}. Visitors don’t see it:',
  identityPreview: 'This code will be added to {file}, just before {head}. Visitors don’t see it:'
} satisfies Record<string, Msg>
