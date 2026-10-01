/* eslint-disable react-refresh/only-export-components -- block edit/save components are registered imperatively, not rendered by module */
import { InspectorControls, useBlockProps, useInnerBlocksProps } from '@wordpress/block-editor'
import { __experimentalGetCoreBlocks, registerCoreBlocks } from '@wordpress/block-library'
import { getBlockType, registerBlockType } from '@wordpress/blocks'
import { PanelBody, SelectControl } from '@wordpress/components'
import { translate, useT } from '../i18n'

/**
 * The writer's block set: content blocks only (text, images, a gallery grid,
 * embeds, tables), no layout builders. Two blocks of our own:
 * - Banner position: where an article is split around the layout's banner.
 * - Text columns: paragraphs flowed through 2 or 3 CSS columns.
 * Images, galleries, tables, embeds and text columns can go wide or full width.
 *
 * Block titles and descriptions are registered once, in the language active at startup;
 * the text inside the blocks follows language changes.
 */

export const CORE_BLOCKS = [
  'core/paragraph',
  'core/heading',
  'core/list',
  'core/list-item',
  'core/quote',
  'core/image',
  'core/gallery',
  'core/embed',
  'core/code',
  'core/table',
  'core/separator',
  'core/buttons',
  'core/button',
  'core/html'
]
export const BREAK_BLOCK = 'craftpages/break'
export const COLUMNS_BLOCK = 'craftpages/text-columns'

/** What can go inside text columns: text and simple images. */
const COLUMN_CONTENT = ['core/paragraph', 'core/heading', 'core/list', 'core/quote', 'core/image']

function BreakEdit(): React.JSX.Element {
  const t = useT()
  return (
    <div {...useBlockProps({ className: 'cp-break' })}>
      <span>{t('post.breakTitle')}</span>
      <small>{t('post.breakNote')}</small>
    </div>
  )
}

interface ColumnsAttributes {
  count: number
  align?: string
}

function ColumnsEdit({
  attributes,
  setAttributes
}: {
  attributes: ColumnsAttributes
  setAttributes: (next: Partial<ColumnsAttributes>) => void
}): React.JSX.Element {
  const t = useT()
  const blockProps = useBlockProps({
    className: `cp-text-columns cp-text-columns-${attributes.count}`
  })
  const innerProps = useInnerBlocksProps(blockProps, {
    allowedBlocks: COLUMN_CONTENT,
    template: [['core/paragraph', { placeholder: t('post.columnsPlaceholder') }]],
    // Put the cursor in the first paragraph when the block is inserted.
    templateInsertUpdatesSelection: true
  })
  return (
    <>
      <InspectorControls>
        <PanelBody title={t('post.columnsPanel')}>
          <SelectControl
            label={t('post.columnsCount')}
            value={String(attributes.count) as '2' | '3'}
            options={[
              { label: t('post.columnsOption', { count: 2 }), value: '2' },
              { label: t('post.columnsOption', { count: 3 }), value: '3' }
            ]}
            onChange={(value: string) => setAttributes({ count: Number(value) })}
            help={t('post.columnsHelp')}
            __nextHasNoMarginBottom
          />
        </PanelBody>
      </InspectorControls>
      <div {...innerProps} />
    </>
  )
}

function ColumnsSave({ attributes }: { attributes: ColumnsAttributes }): React.JSX.Element {
  const blockProps = useBlockProps.save({
    className: `cp-text-columns cp-text-columns-${attributes.count}`
  })
  return <div {...useInnerBlocksProps.save(blockProps)} />
}

let registered = false

export function registerBlocks(): void {
  if (registered) return
  registered = true
  // Register only what the writer may insert. Registering every core block also
  // registers formats such as core/footnote, which collide on a Vite reload.
  if (!getBlockType('core/paragraph')) {
    registerCoreBlocks(
      __experimentalGetCoreBlocks().filter((block: { name: string }) =>
        CORE_BLOCKS.includes(block.name)
      )
    )
  }
  if (!getBlockType(BREAK_BLOCK)) {
    registerBlockType(BREAK_BLOCK, {
      apiVersion: 3,
      title: translate('post.breakTitle'),
      description: translate('post.breakDescription'),
      category: 'design',
      icon: 'minus',
      supports: { html: false, reusable: false },
      edit: BreakEdit,
      // Saved as a bare block comment; the generator turns it into the split point.
      save: () => null
    } as never)
  }
  if (!getBlockType(COLUMNS_BLOCK)) {
    registerBlockType(COLUMNS_BLOCK, {
      apiVersion: 3,
      title: translate('post.columnsTitle'),
      description: translate('post.columnsDescription'),
      category: 'text',
      icon: 'columns',
      attributes: { count: { type: 'number', default: 2 } },
      supports: { html: false, reusable: false, align: ['wide', 'full'] },
      edit: ColumnsEdit,
      save: ColumnsSave
    } as never)
  }
}
