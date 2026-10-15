/* eslint-disable react-refresh/only-export-components -- block edit/save components are registered imperatively, not rendered by module */
import { useEffect, useState } from 'react'
import { BlockControls, InspectorControls, useBlockProps } from '@wordpress/block-editor'
import { createBlock, registerBlockType } from '@wordpress/blocks'
import {
  Button,
  Flex,
  Notice,
  PanelBody,
  Placeholder,
  SelectControl,
  TextControl,
  ToolbarButton,
  ToolbarGroup
} from '@wordpress/components'
import { globe, update } from '@wordpress/icons'
import { translate, useT } from '../i18n'
import { errorMessage } from './api'
import {
  CODE_ATTRIBUTES,
  CodeOptions,
  CodePre,
  figureProps,
  useCodeHighlight,
  type CodeAttributes,
  type SetAttributes
} from './code-block'
import { PLAIN, languageOf } from './highlight'
import type { Gist } from '../../../shared/types'

/**
 * A file from a GitHub Gist, shown like a Code block. The editor fetches the gist once and
 * the block saves the code as static HTML, so the published page doesn't load GitHub's
 * embed script (which blocks rendering and writes with document.write). "Update from
 * GitHub" fetches it again: the latest version, or the revision the link names.
 */

export const GIST_BLOCK = 'craftpages/gist'

const GIST_LINK = /^\s*https?:\/\/gist\.github\.com\/\S+\s*$/i

interface GistAttributes extends CodeAttributes {
  /** The link as given; it may name a revision. */
  url: string
  revision: string
  /** The file on GitHub, linked from the file name. */
  link: string
}

type SetGistAttributes = (next: Partial<GistAttributes>) => void

/** GitHub's anchor for a file in a gist: "greet.ts" → "file-greet-ts". */
const anchorOf = (name: string): string => `file-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`

function languageOfFile(file: Gist['files'][number]): string {
  const ext = file.name.includes('.') ? file.name.split('.').pop() : ''
  const byExtension = languageOf(ext)
  return byExtension !== PLAIN
    ? byExtension
    : languageOf(file.language.toLowerCase().replace(/\s+/g, '-'))
}

function GistEdit({
  attributes: a,
  setAttributes
}: {
  attributes: GistAttributes
  setAttributes: SetGistAttributes
}): React.JSX.Element {
  const t = useT()
  const { language, setCode } = useCodeHighlight(
    a,
    setAttributes as SetAttributes,
    `${a.revision}|${a.title}`
  )
  const [input, setInput] = useState(a.url ?? '')
  const [gist, setGist] = useState<Gist | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const show = (g: Gist, url: string, name: string): void => {
    const file = g.files.find((f) => f.name === name) ?? g.files[0]
    if (!file) {
      setError(t('post.gistEmpty'))
      return
    }
    const sameFile = Boolean(a.code) && file.name === a.title
    setAttributes({
      url,
      revision: g.revision,
      link: `${g.url}${g.pinned ? `/${g.revision}` : ''}#${anchorOf(file.name)}`,
      title: file.name,
      // Updating the same file keeps a language picked by hand.
      ...(sameFile ? {} : { language: languageOfFile(file) })
    })
    // Highlighted now when the grammar is loaded; a new file's language follows.
    setCode(file.content)
  }

  const load = async (url: string, name: string): Promise<void> => {
    if (!url.trim() || busy) return
    setBusy(true)
    setError('')
    try {
      const g = await window.api.fetchGist(url.trim())
      setGist(g)
      show(g, url.trim(), name)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  // A pasted link arrives without the code: fetch it straight away.
  useEffect(() => {
    if (!a.url || a.code) return
    const start = setTimeout(() => void load(a.url, ''))
    return () => clearTimeout(start)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the block appears
  }, [])

  const blockProps = useBlockProps(a.code ? figureProps(a, 'cp-gist') : {})

  if (!a.code)
    return (
      <div {...blockProps}>
        <Placeholder
          icon={globe}
          label={t('post.gistTitle')}
          instructions={t('post.gistInstructions')}
        >
          <form
            className="cp-gist__form"
            onSubmit={(e) => {
              e.preventDefault()
              void load(input, '')
            }}
          >
            <input
              type="url"
              className="components-placeholder__input"
              aria-label={t('post.gistUrl')}
              placeholder="https://gist.github.com/…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <Button variant="primary" type="submit" isBusy={busy} disabled={busy || !input.trim()}>
              {t('post.gistEmbed')}
            </Button>
          </form>
          {error ? <p className="cp-gist__error">{error}</p> : null}
        </Placeholder>
      </div>
    )

  const pinned = /\/[0-9a-f]{40}/i.test(a.url)
  return (
    <>
      <BlockControls>
        <ToolbarGroup>
          <ToolbarButton
            icon={update}
            label={t('post.gistUpdate')}
            disabled={busy}
            onClick={() => void load(a.url, a.title)}
          />
        </ToolbarGroup>
      </BlockControls>
      <InspectorControls>
        <PanelBody title={t('post.gistPanel')}>
          <Flex direction="column" gap={4}>
            <TextControl
              label={t('post.gistUrl')}
              value={input}
              onChange={setInput}
              onKeyDown={(e: React.KeyboardEvent) => {
                if (e.key === 'Enter') void load(input, '')
              }}
              __nextHasNoMarginBottom
            />
            {gist && gist.files.length > 1 ? (
              <SelectControl
                label={t('post.gistFile')}
                value={a.title}
                options={gist.files.map((f) => ({ value: f.name, label: f.name }))}
                onChange={(name: string) => show(gist, a.url, name)}
                __nextHasNoMarginBottom
              />
            ) : null}
            <div>
              <Button
                variant="secondary"
                isBusy={busy}
                disabled={busy}
                onClick={() => void load(input, input.trim() === a.url ? a.title : '')}
              >
                {t('post.gistUpdate')}
              </Button>
              <p className="components-base-control__help">
                {t(pinned ? 'post.gistPinnedHelp' : 'post.gistLatestHelp')}
              </p>
            </div>
            {error ? (
              <Notice status="error" isDismissible={false}>
                {error}
              </Notice>
            ) : null}
          </Flex>
        </PanelBody>
        <CodeOptions attributes={a} setAttributes={setAttributes as SetAttributes} />
      </InspectorControls>
      <figure {...blockProps} data-lang={languageOf(language)}>
        <figcaption className="cp-code__title">
          <a href={a.link} onClick={(e) => e.preventDefault()}>
            {a.title}
          </a>
        </figcaption>
        <pre className="cp-code__pre">
          <code dangerouslySetInnerHTML={{ __html: a.html }} />
        </pre>
      </figure>
    </>
  )
}

function GistSave({ attributes: a }: { attributes: GistAttributes }): React.JSX.Element | null {
  // Not fetched yet: only the link is kept, in the block comment.
  if (!a.code) return null
  return (
    <figure {...useBlockProps.save(figureProps(a, 'cp-gist'))} data-lang={languageOf(a.language)}>
      <figcaption className="cp-code__title">
        <a href={a.link}>{a.title}</a>
      </figcaption>
      <CodePre html={a.html} />
    </figure>
  )
}

export function registerGistBlock(): void {
  registerBlockType(GIST_BLOCK, {
    apiVersion: 3,
    title: translate('post.gistTitle'),
    description: translate('post.gistDescription'),
    category: 'embed',
    icon: globe,
    keywords: ['gist', 'github', 'code', 'snippet', 'embed'],
    attributes: {
      ...CODE_ATTRIBUTES,
      url: { type: 'string', default: '' },
      revision: { type: 'string', default: '' },
      link: { type: 'string', source: 'attribute', selector: 'figcaption a', attribute: 'href' }
    },
    supports: { html: false, reusable: false, align: ['wide', 'full'] },
    transforms: {
      from: [
        {
          // A gist link pasted on its own line.
          type: 'raw',
          priority: 1,
          isMatch: (node: Node) => node.nodeName === 'P' && GIST_LINK.test(node.textContent ?? ''),
          transform: (node: Element) =>
            createBlock(GIST_BLOCK, { url: (node.textContent ?? '').trim() })
        }
      ]
    },
    edit: GistEdit,
    save: GistSave
  } as never)
}
