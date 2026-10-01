import type { Msg } from '../types'

/** Blog view: setup, post list, URL settings, and pointing mode (LayoutPointer). */
export default {
  // Loading
  looking: 'Looking for blog pages…',

  // Step 1: choose layouts
  chooseTitle: 'Set up your blog · Step 1: choose layouts',
  chooseDescription:
    'Posts reuse the look of one of your pages, and the post list reuses another. Next, you point at where the text and the cards go.',
  statusBoth:
    'This site already has pages that look like a blog. Check the suggestions, then continue.',
  statusPostOnly:
    'Found a page that looks like a post, but none that lists posts. For the list, pick any page whose look it should borrow.',
  statusListOnly:
    'Found a page that lists posts, but no post page. For posts, pick any page whose look they should borrow.',
  statusNone:
    'This site has no blog pages yet, and that’s fine. Pick pages whose look you want to reuse (a text page like Privacy suits posts). Posts and the list are created as new pages under /blog/; the pages you pick stay as they are.',
  postLayout: 'Post layout',
  postLayoutHint:
    'A page with a text area: a title, maybe a date, and body text. Its header, footer and sidebars wrap every post.',
  listLayout: 'Post list layout',
  listLayoutHint:
    'A page with an area for the post cards (the /blog/ page). A page that already lists posts is ideal; any page with a content section works.',
  latestLayout: 'Latest posts',
  noCandidates: 'Nothing on this site looks like this yet.',
  whySuggested: 'Why suggested: {reasons}.',
  openCandidate: 'Open {page}',
  otherPage: 'Or use another page',
  existingPage: 'Use an existing page as the layout',
  choosePage: 'Choose a page…',

  // Why a page was suggested (reasons found by the scan)
  reasonArticleData: 'Article structured data',
  reasonOgArticle: 'og:type “article”',
  reasonArticle: '<article> with body text',
  reasonDate: 'publish date',
  reasonUnder: 'under {dir}',
  reasonLongText: 'long-form text',
  reasonAddress: 'address {path}',
  reasonCardsPosts: {
    one: '{count} card linking to posts',
    other: '{count} cards linking to posts'
  } satisfies Msg,
  reasonCardsDated: {
    one: '{count} card linking to dated pages',
    other: '{count} cards linking to dated pages'
  } satisfies Msg,
  reasonCardsPages: {
    one: '{count} repeated card linking to pages',
    other: '{count} repeated cards linking to pages'
  } satisfies Msg,
  reasonPagination: 'pagination',

  // AI alternative
  aiTitle: 'Prefer dedicated blog pages? Let your AI create them',
  aiDescription:
    'Your connected AI builds them in the site’s own design. You review the proposal (changes and preview) before anything is written, then come back here and pick them.',
  aiConnected: 'Connected: {clients}',
  aiNotConnected: 'No AI connected yet. Set one up in {view}.',
  copyPrompt: 'Copy prompt',

  // Preview
  backToBlog: 'Back to Blog',
  samplePost: 'Sample post',
  postList: 'Post list',
  sampleNote: 'Sample content, not written to your site.',
  adjustPostLayout: 'Adjust post layout…',
  adjustListLayout: 'Adjust list layout…',
  previewFrame: 'Blog preview',

  // Notices
  postDeleted: 'Post deleted.',
  latestUpdated: 'Latest posts updated on {pages}.',
  savedNotice: 'Saved.',
  republished:
    'Saved and re-published. Files written: {written}. Removed: {removed}. Redirects in _redirects: {redirects}.',

  // Setup overview
  setupTitle: 'Setup',
  setupTitleTodo: 'Set up your blog',
  setupDone: 'Done. You can adjust any part at any time.',
  setupTodo: 'Point at where posts and cards go, then check a preview.',
  stepChoose: 'Choose layouts',
  stepChooseSummary: 'Posts look like {post}; the list looks like {list}.',
  changeLayouts: 'Change layouts',
  stepPost: 'Point at the post parts',
  stepPostTodo:
    'Where the article text goes, plus the title, date and cover image if the layout has them.',
  stepList: 'Point at the list parts',
  stepListTodo:
    'Where the cards go, an existing card and its fields (if the page has one), and the pagination.',
  startPointing: 'Start pointing…',
  adjust: 'Adjust…',
  stepPreview: 'Preview with sample posts',
  stepPreviewHint:
    'See a post and the list page built from your layouts. Nothing is written to the site.',
  stepLatest: 'Latest posts on other pages (optional)',
  stepLatestHint:
    'For example, the three newest posts on the home page. When you publish, only the area you point at changes.',
  stepDone: 'done',
  sumAreas: { one: '{count} article area', other: '{count} article areas' } satisfies Msg,
  sumTitle: 'title',
  sumDate: 'date',
  sumCover: 'cover image',
  sumTags: 'tags',
  sumListArea: 'list area',
  sumCard: { one: 'your card ({count} field)', other: 'your card ({count} fields)' } satisfies Msg,
  sumSimpleCard: 'simple card',
  sumPagination: 'your pagination',
  sumSimplePagination: 'simple pagination',
  sumHeading: 'heading',

  // Latest posts blocks
  latestCount: 'Posts shown',
  latestCountOn: 'Posts shown on {page}',
  adjustLatest: 'Adjust latest posts on {page}',
  removeLatest: 'Remove latest posts from {page}',
  removeLatestHint: 'The area keeps its current cards; they just stop updating.',
  latestPage: 'Page for latest posts',
  pointArea: 'Point at the area…',
  finishLayoutsFirst: 'Finish the post and list layouts first.',

  // Posts
  posts: 'Posts',
  newPost: 'New post',
  noPosts: 'No posts yet',
  noPostsReady: 'Choose New post to write the first one.',
  noPostsSetup: 'Finish the setup to start writing.',
  colTitle: 'Title',
  colUrl: 'URL',
  colTags: 'Tags',
  colStatus: 'Status',
  colDate: 'Date',
  untitled: 'Untitled',

  // Post URLs
  urlTitle: 'Post URLs',
  urlDescription: 'Where posts and the post list live. Each post’s slug is set in the post editor.',
  saveRepublish: 'Save and re-publish',
  presets: 'URL presets',
  presetWordPress: '{path} (like WordPress)',
  permalink: 'Post URL pattern',
  permalinkHint: 'Must contain %postname%.',
  listAddress: 'Post list address',
  listAddressHint: 'Posts live under {prefix}.',
  perPage: 'Posts per list page',
  urlExample: 'Example post: {post} · List: {list} · Page 2: {page2}',
  blogTitle: 'Blog title',
  blogTitleHint: 'Heading and title of the list page. Tag pages show “Blog: tag”.',
  scheduleDeploy: 'Deploy to production when a scheduled post goes live',
  scheduleDeployHint:
    'Uses this project’s Cloudflare settings. CraftPages must be open at that time; otherwise it deploys at the next launch.',
  urlsMove:
    'Published posts move to the new URLs. Their old URLs get 301 redirects in _redirects, so links and search results keep working.',

  // Pointing mode
  opening: 'Opening {page}…',
  layoutFrame: 'Layout of {page}',
  pointSteps: 'Parts to point at',
  markNumbered: '{label} {n}',
  noImage: 'That part has no image. Click an image.',
  wider: 'Wider',
  widerHint: 'Select the element around this one',
  removePick: 'Remove {part}',
  addAnother: 'Click another part of the page to add area {n}.',
  keepOnly: 'Keep only the picked parts of the main content',
  keepOnlyHint:
    'Sections of {page} without your picks are left out; the header, footer and navigation stay.',
  skip: 'Skip',
  saveLayout: 'Save layout',
  saveHintOptional: 'Optional steps you skip stay empty.',
  saveHintRequired: 'Pick the required parts first.',

  // Pointing steps: post layout
  regions: 'Article area',
  regionsPrompt: 'Click the area where the article text goes.',
  regionsHelp:
    'Pick the box that holds the page’s main text; everything inside it is replaced by the post. If only a paragraph is outlined, use “Wider”. If a banner splits the article, add a second area after it.',
  title: 'Title',
  titlePrompt: 'Click the heading that should show the post title.',
  titleHelp:
    'Usually the page’s big H1. If you skip it, the title goes at the top of the article area.',
  titleSkip: 'Skip: title goes into the article area',
  date: 'Date',
  datePrompt: 'Click where the publish date should appear.',
  dateHelp:
    'Any small text near the title, such as “Last updated…”. Its text becomes the post date.',
  dateSkip: 'Skip: no date on the page',
  image: 'Cover image',
  imagePrompt: 'Click the image that should show the post’s cover.',
  imageHelp: 'Skip it if the layout has no hero image.',
  imageSkip: 'Skip: no cover image',
  tags: 'Tags',
  tagsPrompt: 'Click where the post’s tags should be listed.',
  tagsHelp:
    'A small line near the title or under the article works. It shows the tags as links to their tag pages, and stays empty for posts without tags.',
  tagsSkip: 'Skip: don’t show tags',
  remove: 'Leave out',
  removePrompt: 'Click anything else that shouldn’t appear on generated pages.',
  removeHelp:
    'For example, a label or a banner. Whole sections are removed; smaller parts are emptied so the layout around them keeps its shape. With “Keep only the picked parts” on, sections without your picks are already gone.',
  removeSkip: 'Nothing else',

  // Pointing steps: post list and latest posts
  container: 'List area',
  containerPrompt: 'Click the area where the list of posts goes.',
  containerHelp:
    'Everything inside it is replaced by post cards on each list page. A section’s content box works well.',
  card: 'Card',
  cardPrompt: 'Click one card inside the list area, if the page already has one.',
  cardHelp:
    'Its design is copied for every post. No card on the page yet? Skip, and a simple card that follows the site’s fonts is used.',
  cardSkip: 'Skip: use a simple card',
  cardTitle: 'Card · title',
  cardTitlePrompt: 'In the card, click the title.',
  cardTitleHelp: 'Replaced by the post title.',
  cardDate: 'Card · date',
  cardDatePrompt: 'In the card, click the date (if it has one).',
  cardDateHelp: 'Replaced by the post date.',
  cardExcerpt: 'Card · excerpt',
  cardExcerptPrompt: 'In the card, click the short text.',
  cardExcerptHelp: 'Replaced by the post excerpt.',
  cardImage: 'Card · image',
  cardImagePrompt: 'In the card, click the image.',
  cardImageHelp: 'Replaced by the post’s cover image.',
  cardLink: 'Card · link',
  cardLinkPrompt: 'In the card, click the link or button that opens the post.',
  cardLinkHelp: 'Every link in the card that goes to the same place will point to the post.',
  pagination: 'Pagination',
  paginationPrompt: 'Click the pagination (Previous / Next), if the page has one.',
  paginationHelp:
    'If you skip it, simple “Newer / Older posts” links are added under the cards when there is more than one page.',
  paginationSkip: 'Skip: add simple links',
  heading: 'Heading',
  headingPrompt: 'Click the heading that should name the list.',
  headingHelp:
    'It shows the blog title (set under Post URLs), or “Blog: tag” on tag pages. Skip it if the list area has no heading of its own.',
  headingSkip: 'Skip: no heading',
  latestArea: 'Area',
  latestAreaPrompt: 'Click the area where the latest posts should appear.',
  latestAreaHelp:
    'Only this area changes when you publish; the rest of the page stays exactly as it is. If the page already shows a few cards, click their grid and then one card.'
} satisfies Record<string, Msg>
