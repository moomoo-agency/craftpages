import type { Msg } from '../types'

/** The media library and the image picker. */
export default {
  title: 'Images',
  summary: {
    one: '{count} image, {size} in total.',
    other: '{count} images, {size} in total.'
  } satisfies Msg,
  scanning: 'Looking for images…',
  addSizes: 'Add missing image sizes',
  addSizesTip:
    'Write width and height on every image that lacks them, so pages don’t jump while loading',
  optimizeSelected: {
    one: 'Optimise {count} selected…',
    other: 'Optimise {count} selected…'
  } satisfies Msg,
  optimizeShown: 'Optimise all shown…',
  filterLabel: 'Show',
  filterAll: 'All',
  filterUnused: 'Unused',
  filterLarge: 'Over 400 KB',
  filterWide: 'Wider than {width} px',
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
  sizesNone: 'Every image already has its width and height.',
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
  uploaded: 'Uploaded {name}: {before} → {after}.',
  uploadedSmaller: 'Uploaded {name}: {before} → {after} ({percent}% smaller).',
  pickerUsedIn: '{path} · Used in {files}',
  pickerHint: 'Choose an image, or upload a new one: it is resized and compressed on the way in.',
  useImage: 'Use image'
} satisfies Record<string, Msg>
