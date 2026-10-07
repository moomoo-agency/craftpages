import type { Msg } from '../types'

/** The post editor (views/PostEditor), its status pill and the blog's own blocks. */
export default {
  // Toolbar
  back: 'All posts',
  stateUnsaved: 'Unsaved changes',
  stateNew: 'Not saved yet',
  stateSaved: 'Saved {date}',
  backToEditor: 'Back to editor',
  unschedule: 'Unschedule',
  unpublish: 'Unpublish',
  update: 'Update',
  saveDraft: 'Save draft',
  schedule: 'Schedule',
  publish: 'Publish',
  goesLive: 'Goes live on {date}',

  // Confirm bar
  leaveMessage: 'You have unsaved changes.',
  keepEditing: 'Keep editing',
  discardChanges: 'Discard changes',
  saveAndLeave: 'Save and leave',
  confirmDelete: 'Delete “{title}”? The post file is kept in .sitecms/trash.',
  confirmDeletePublished:
    'Delete “{title}”? Its page is removed from the site and its URL redirects to the post list. The post file is kept in .sitecms/trash.',
  untitled: 'Untitled',
  deletePost: 'Delete post',
  deletePostConfirm: 'Delete post…',

  // Save results
  scheduledFor:
    'Scheduled for {date} at {path}. CraftPages publishes it then while the app is running, even with the window closed. If the computer is off or asleep, it goes out when it’s back on.',
  publishedAt: 'Published at {path}',
  unpublished:
    'Unpublished: the page was removed from the site, and its URL now redirects to the post list.',
  updated: 'Updated on the site.',
  draftSaved: 'Draft saved.',
  filesWritten: { one: '{count} file written.', other: '{count} files written.' } satisfies Msg,
  filesRemoved: { one: '{count} file removed.', other: '{count} files removed.' } satisfies Msg,
  deployHint: 'To put it online, use “{action}”.',

  // Canvas
  previewTitle: 'Post preview',
  titleLabel: 'Post title',
  titlePlaceholder: 'Add title',
  bodyPlaceholder: 'Start writing, or type / to choose a block',

  // Sidebar
  tabsLabel: 'Post settings',
  tabPost: 'Post',
  tabBlock: 'Block',
  slugLabel: 'URL',
  slugHintPublished: 'Changing it moves the page; the old URL redirects to the new one.',
  slugHintManual: 'Lowercase letters, digits and dashes.',
  slugHintAuto: 'Follows the title until you edit it.',
  dateLabel: 'Publish date',
  dateHintFuture: 'A future date: “Publish” becomes “Schedule”, and the post goes live then.',
  tagsLabel: 'Tags',
  tagsPlaceholder: 'Add a tag and press Enter',
  removeTag: 'Remove tag {tag}',
  tagsHint: 'Each tag gets a page that lists its posts.',
  tagsHintExample: 'Each tag gets a page that lists its posts, e.g. {path}.',
  coverLabel: 'Cover image',
  noCover: 'No cover image',
  chooseCover: 'Choose image…',
  changeCover: 'Change image…',
  coverHint: 'Shown on the post card and as the image for social sharing.',
  altLabel: 'Alt text',
  altPlaceholder: 'Describe the image',
  altHint: 'Read aloud to people who can’t see the image.',
  excerptLabel: 'Excerpt',
  excerptHint: {
    one: '{count} character (aim for 70–160). Shown on the post card, in the feed and as the meta description. Leave empty to use the first words of the post.',
    other:
      '{count} characters (aim for 70–160). Shown on the post card, in the feed and as the meta description. Leave empty to use the first words of the post.'
  } satisfies Msg,
  seoHeading: 'Search & social',
  noDescription: 'No description.',
  seoTitleLabel: 'SEO title',
  seoTitleHint: {
    one: '{count} character. Leave empty to use the post title.',
    other: '{count} characters. Leave empty to use the post title.'
  } satisfies Msg,

  // Status pill
  statusDraft: 'Draft',
  statusScheduled: 'Scheduled',
  statusPublished: 'Published',

  // Our blocks (titles follow the language active at startup)
  breakTitle: 'Banner position',
  breakDescription: 'Where the article is split around the layout’s banner.',
  breakNote: 'The layout’s banner sits here; the article continues below it.',
  columnsTitle: 'Text columns',
  columnsDescription: 'Paragraphs that flow across 2 or 3 columns, like a newspaper.',
  columnsPlaceholder: 'Text that flows across columns…',
  columnsPanel: 'Columns',
  columnsCount: 'Number of columns',
  columnsOption: { one: '{count} column', other: '{count} columns' } satisfies Msg,
  columnsHelp: 'On phones, the text becomes a single column.',
  categoryLabel: 'Category',
  categoryHint:
    'One per post, shown where your layout has a category badge. Each gets a page listing its posts.',
  categoryHintExample: 'Its page: {path}',
  authorLabel: 'Author',
  authorHint: 'Leave empty to keep the name already in your layout.'
} satisfies Record<string, Msg>
