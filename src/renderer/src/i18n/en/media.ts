import type { Msg } from '../types'

/** The media library and the image picker. */
export default {
  title: 'Images',
  summary: {
    one: '{count} image, {size} in total.',
    other: '{count} images, {size} in total.'
  } satisfies Msg,
  scanning: 'Looking for images…',
  addSizes: {
    one: 'Add missing size ({count})',
    other: 'Add missing sizes ({count})'
  } satisfies Msg,
  addSizesTip:
    'Some <img> tags on your pages have no width and height, so the page jumps while they load. This writes each image’s real size into those tags.',
  addSizesNoneTip: 'Nothing to fix: every <img> tag on your pages already has width and height.',
  optimizeSelected: {
    one: 'Optimise {count} selected…',
    other: 'Optimise {count} selected…'
  } satisfies Msg,
  optimizeShown: 'Optimise all shown…',
  optimizeNone: 'Optimise selected…',
  optimizeHint: 'Tick the images you want to optimise first.',
  selectShown: 'Select all shown ({count})',
  filterLabel: 'Show',
  filterAll: 'All',
  filterUnused: 'Unused',
  filterLarge: 'Over 400 KB',
  filterWide: 'Wider than {width} px',
  filterUnsized: 'Missing size',
  folder: 'Folder',
  allFolders: 'All folders',
  allFoldersCount: 'All folders ({count})',
  search: 'Search by file name',
  selectedCount: { one: '{count} selected', other: '{count} selected' } satisfies Msg,
  clearSelection: 'Clear selection',
  nothingToGain: 'Nothing to gain: these images are already well compressed.',
  optimized: {
    one: 'Optimised {count} image and saved {size}. Every reference now points at the new file.',
    other: 'Optimised {count} images and saved {size}. Every reference now points at the new files.'
  } satisfies Msg,
  replaced: 'Replaced with {path}.',
  replacedIn: 'Replaced with {path} in {files}.',
  deleted: 'Deleted {path}.',
  sizesAdded: {
    one: 'Added width and height to {count} image.',
    other: 'Added width and height to {count} images.'
  } satisfies Msg,
  sizesPages: 'Pages updated: {count}.',
  sizesSkipped: 'Skipped {files}: they have unsaved edits.',
  sizesNone: 'Nothing to fix: every <img> tag already has width and height.',
  undone: 'Undone.',
  planTitle: {
    one: '{count} image can be optimised, saving {size}.',
    other: '{count} images can be optimised, saving {size}.'
  } satisfies Msg,
  planNote:
    'Optimised files get new names, and pages, stylesheets and the manifest are updated to match. The originals are kept in {folder}.',
  optimize: 'Optimise',
  optimizing: 'Optimising…',
  noImages: 'This project has no images yet.',
  noMatches: 'No images match these filters.',
  select: 'Select {name}',
  unused: 'Unused',
  large: 'over 400 KB',
  details: 'Image details',
  closeDetails: 'Close details',
  usedIn: 'Used in',
  notUsed: 'Not used by any page, stylesheet or manifest.',
  replace: 'Replace everywhere…',
  optimizeOne: 'Optimise…',
  deleteInUse: 'Only unused images can be deleted.',
  upload: 'Upload image…',
  uploadMany: 'Upload images…',
  uploadedMany: {
    one: 'Uploaded {count} image: {before} → {after}.',
    other: 'Uploaded {count} images: {before} → {after}.'
  } satisfies Msg,
  noSize: 'No size in HTML',
  uploaded: 'Uploaded {name}: {before} → {after}.',
  uploadedSmaller: 'Uploaded {name}: {before} → {after} ({percent}% smaller).',
  pickerUsedIn: '{path} · Used in {files}',
  pickerHint: 'Choose an image, or upload a new one: it is resized and compressed on the way in.',
  useImage: 'Use image'
} satisfies Record<string, Msg>
