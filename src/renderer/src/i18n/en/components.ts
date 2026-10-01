import type { Msg } from '../types'

/** Shared components: blocks repeated across pages. */
export default {
  title: 'Shared components',
  empty: 'Open a project to find blocks repeated across its pages.',
  scanning: 'Scanning pages…',
  intro:
    'Shared components are blocks that appear on more than one page, like a header or a footer. Choose <b>Edit</b> or a page to open the block in the editor, then click any text inside it. A bar above the page lets you apply your edits to <b>all pages</b> or <b>this page only</b>.',
  variantsNote:
    'Variants are copies that differ somewhere: your edits reach them only where the edited text matches.',
  none: 'No repeated blocks found.',
  editLabel: 'Edit {name}',
  variants: { one: '{count} variant', other: '{count} variants' } satisfies Msg,
  variant: 'Variant {n}',
  openPage: 'Open {page} in the editor'
} satisfies Record<string, Msg>
