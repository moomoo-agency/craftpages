import type { Msg } from '../types'

/** Shared parts: blocks repeated across pages (header, footer, nav…). */
export default {
  title: 'Shared parts',
  empty: 'Open a project to find parts repeated across its pages.',
  scanning: 'Scanning pages…',
  intro:
    'Shared parts appear on more than one page, like a header or a footer. Choose <b>Edit part</b> or a page to open the part in the editor, then click any text inside it. The first time, you choose whether your edits go to <b>all pages</b> or <b>this page only</b>.',
  variantsNote:
    'Variants are copies that differ somewhere: your edits reach them only where the edited text matches.',
  none: 'No repeated parts found.',
  editLabel: 'Edit {name}',
  variants: { one: '{count} variant', other: '{count} variants' } satisfies Msg,
  variant: 'Variant {n}',
  openPage: 'Open {page} in the editor',
  textLabel: 'Text in this part',
  noText: 'No text: only images, icons or links without words.',
  usedOn: 'Appears on',
  editAll: 'Edit part',
  kind_header: 'Header',
  kind_footer: 'Footer',
  kind_nav: 'Navigation',
  kind_aside: 'Sidebar',
  kind_section: 'Section',
  kind_form: 'Form',
  kind_article: 'Article',
  kind_div: 'Block',
  named: '{kind} “{name}”'
} satisfies Record<string, Msg>
