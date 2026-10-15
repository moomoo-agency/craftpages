/* eslint-disable react-refresh/only-export-components -- block edit/save components are registered imperatively, not rendered by module */
import { useEffect, useMemo, useRef, useState } from 'react'
import { InspectorControls, useBlockProps } from '@wordpress/block-editor'
import { createBlock, registerBlockType } from '@wordpress/blocks'
import {
  ComboboxControl,
  Flex,
  PanelBody,
  SelectControl,
  TextControl,
  ToggleControl
} from '@wordpress/components'
import { RawHTML } from '@wordpress/element'
import { addFilter } from '@wordpress/hooks'
import { code as codeIcon } from '@wordpress/icons'
import type { HighlighterCore } from 'shiki/core'
import { translate, useT } from '../i18n'
import {
  DEFAULT_THEME,
  LANGUAGES,
  PLAIN,
  THEMES,
  highlight,
  languageOf,
  parseLines,
  plain,
  prepare
} from './highlight'
import '../../../shared/code-block.css'

/**
 * Code with syntax highlighting, like Code Block Pro: highlighted in the editor and saved
 * as static HTML. The code itself is read back from the <code> text and the title from
 * the <figcaption>, so neither is stored twice. Replaces core/code in the inserter.
 */

export const CODE_BLOCK = 'craftpages/code'

export interface CodeAttributes {
  code: string
  html: string
  language?: string
  theme?: string
  bg?: string
  fg?: string
  title: string
  lineNumbers: boolean
  highlight: string
  copy: boolean
}

export type SetAttributes = (next: Partial<CodeAttributes>) => void

/** Attributes the Code and Gist blocks share. */
export const CODE_ATTRIBUTES = {
  code: { type: 'string', source: 'text', selector: 'code', default: '' },
  html: { type: 'string', source: 'html', selector: 'code', default: '' },
  language: { type: 'string' },
  theme: { type: 'string' },
  bg: { type: 'string' },
  fg: { type: 'string' },
  title: { type: 'string', source: 'text', selector: 'figcaption', default: '' },
  lineNumbers: { type: 'boolean', default: false },
  highlight: { type: 'string', default: '' },
  copy: { type: 'boolean', default: true }
}

/** Above this size, typing shows plain text and highlights once the typing pauses. */
const LARGE = 30_000
const LAST_USED = 'craftpages.codeBlock'

function lastUsed(): { language: string; theme: string } {
  try {
    const saved = JSON.parse(localStorage.getItem(LAST_USED) ?? '{}')
    return { language: saved.language || PLAIN, theme: saved.theme || DEFAULT_THEME }
  } catch {
    return { language: PLAIN, theme: DEFAULT_THEME }
  }
}

function remember(next: { language?: string; theme?: string }): void {
  try {
    localStorage.setItem(LAST_USED, JSON.stringify({ ...lastUsed(), ...next }))
  } catch {
    // Only a convenience for the next block.
  }
}

const classNameOf = (a: CodeAttributes, extra?: string): string =>
  ['cp-code', a.lineNumbers && 'cp-code--numbers', a.copy && 'cp-code--copy', extra]
    .filter(Boolean)
    .join(' ')

const styleOf = (a: CodeAttributes): Record<string, string | undefined> => ({
  '--cp-code-bg': a.bg || undefined,
  '--cp-code-fg': a.fg || undefined,
  '--cp-code-digits': a.lineNumbers ? String(String(a.code.split('\n').length).length) : undefined
})

/** Props for the block's <figure>, in the editor or when saving. */
export const figureProps = (
  a: CodeAttributes,
  extra?: string
): { className: string; style: Record<string, string | undefined> } => ({
  className: classNameOf(a, extra),
  style: styleOf(a)
})

/** Text of a core/code block's rich text: line breaks become newlines. */
function textOf(content: unknown): string {
  const html =
    typeof content === 'string'
      ? content
      : ((content as { toHTMLString?: () => string })?.toHTMLString?.() ?? String(content ?? ''))
  const doc = new DOMParser().parseFromString(
    `<pre>${html.replace(/<br\s*\/?>/gi, '\n')}</pre>`,
    'text/html'
  )
  return doc.body.textContent ?? ''
}

/**
 * Keeps a block's html highlighted. `source` names where the code came from (the Gist
 * block's file and revision); a change there re-highlights like a language change does.
 * Returns `setCode`, which highlights as it sets.
 */
export function useCodeHighlight(
  a: CodeAttributes,
  setAttributes: SetAttributes,
  source = ''
): { language: string; theme: string; setCode: (next: string) => void } {
  const language = a.language || PLAIN
  const theme = a.theme || DEFAULT_THEME
  const marked = useMemo(() => parseLines(a.highlight), [a.highlight])
  // The highlighter, once it has this block's grammar and theme.
  const [loaded, setLoaded] = useState<{ key: string; h: HighlighterCore } | null>(null)
  const ready = loaded?.key === `${language}|${theme}` ? loaded.h : null
  const code = useRef(a.code)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  // Counts edits, so a late highlight never overwrites newer code.
  const edits = useRef(0)
  // What the saved html was highlighted with. A block that was never highlighted (new,
  // converted or pasted) has no colours yet; others are left alone until something changes.
  const params = `${language}|${theme}|${a.highlight}|${source}`
  const rendered = useRef(a.bg ? params : '')

  useEffect(() => {
    if (!a.language || !a.theme) {
      const last = lastUsed()
      setAttributes({ language: a.language || last.language, theme: a.theme || last.theme })
    }
    return () => clearTimeout(timer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on insert
  }, [])

  useEffect(() => {
    code.current = a.code
  }, [a.code])

  useEffect(() => {
    let live = true
    prepare(language, theme).then(
      (h) => {
        if (!live) return
        setLoaded({ key: `${language}|${theme}`, h })
        if (rendered.current === params) return
        rendered.current = params
        setAttributes(highlight(h, code.current, language, theme, marked))
      },
      () => null
    )
    return () => {
      live = false
    }
  }, [language, theme, marked, params, setAttributes])

  const setCode = (next: string): void => {
    clearTimeout(timer.current)
    const edit = ++edits.current
    if (ready && next.length <= LARGE) {
      setAttributes({ code: next, ...highlight(ready, next, language, theme, marked) })
      return
    }
    setAttributes({ code: next, html: plain(next, marked) })
    // Large code: once typing pauses. Highlighter still loading: as soon as it's there.
    timer.current = setTimeout(
      async () => {
        const h = ready ?? (await prepare(language, theme))
        if (edit === edits.current) setAttributes(highlight(h, next, language, theme, marked))
      },
      ready ? 250 : 0
    )
  }
  return { language, theme, setCode }
}

/** The settings panel: language, theme, line numbers, marked lines, copy button. */
export function CodeOptions({
  attributes: a,
  setAttributes,
  children
}: {
  attributes: CodeAttributes
  setAttributes: SetAttributes
  children?: React.ReactNode
}): React.JSX.Element {
  const t = useT()
  return (
    <PanelBody title={t('post.codePanel')}>
      <Flex direction="column" gap={4}>
        <ComboboxControl
          label={t('post.codeLanguage')}
          value={a.language || PLAIN}
          options={[
            { value: PLAIN, label: t('post.codePlainText') },
            ...LANGUAGES.map((lang) => ({ value: lang.id, label: lang.name }))
          ]}
          onChange={(value?: string | null) => {
            const next = value || PLAIN
            remember({ language: next })
            setAttributes({ language: next })
          }}
          __nextHasNoMarginBottom
        />
        <SelectControl
          label={t('post.codeTheme')}
          value={a.theme || DEFAULT_THEME}
          onChange={(value: string) => {
            remember({ theme: value })
            setAttributes({ theme: value })
          }}
          __nextHasNoMarginBottom
        >
          <optgroup label={t('post.codeThemeDark')}>
            {THEMES.filter((th) => th.dark).map((th) => (
              <option key={th.id} value={th.id}>
                {th.name}
              </option>
            ))}
          </optgroup>
          <optgroup label={t('post.codeThemeLight')}>
            {THEMES.filter((th) => !th.dark).map((th) => (
              <option key={th.id} value={th.id}>
                {th.name}
              </option>
            ))}
          </optgroup>
        </SelectControl>
        {children}
        <ToggleControl
          label={t('post.codeLineNumbers')}
          checked={a.lineNumbers}
          onChange={(value: boolean) => setAttributes({ lineNumbers: value })}
          __nextHasNoMarginBottom
        />
        <TextControl
          label={t('post.codeHighlight')}
          help={t('post.codeHighlightHelp')}
          value={a.highlight}
          onChange={(value: string) => setAttributes({ highlight: value })}
          __nextHasNoMarginBottom
        />
        <ToggleControl
          label={t('post.codeCopy')}
          help={t('post.codeCopyHelp')}
          checked={a.copy}
          onChange={(value: boolean) => setAttributes({ copy: value })}
          __nextHasNoMarginBottom
        />
      </Flex>
    </PanelBody>
  )
}

/** The saved <pre>: static, highlighted HTML. */
export function CodePre({ html }: { html: string }): React.JSX.Element {
  return (
    <pre className="cp-code__pre">
      <code>
        <RawHTML>{html}</RawHTML>
      </code>
    </pre>
  )
}

function CodeEdit({
  attributes: a,
  setAttributes
}: {
  attributes: CodeAttributes
  setAttributes: SetAttributes
}): React.JSX.Element {
  const t = useT()
  const { language, setCode } = useCodeHighlight(a, setAttributes)
  const blockProps = useBlockProps(figureProps(a))
  return (
    <>
      <InspectorControls>
        <CodeOptions attributes={a} setAttributes={setAttributes}>
          <TextControl
            label={t('post.codeFileName')}
            help={t('post.codeFileNameHelp')}
            value={a.title}
            onChange={(value: string) => setAttributes({ title: value })}
            __nextHasNoMarginBottom
          />
        </CodeOptions>
      </InspectorControls>
      <figure {...blockProps} data-lang={languageOf(language)}>
        {a.title ? <figcaption className="cp-code__title">{a.title}</figcaption> : null}
        {/* The highlighted copy sits under a transparent textarea with the same metrics. */}
        <div className="cp-code__edit">
          <pre className="cp-code__pre" aria-hidden="true">
            <code dangerouslySetInnerHTML={{ __html: `${a.html}\n` }} />
          </pre>
          <textarea
            className="cp-code__input"
            aria-label={t('post.codeTitle')}
            placeholder={t('post.codePlaceholder')}
            value={a.code}
            rows={1}
            wrap="off"
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => {
              // Tab indents; Esc then Tab leaves the block, as in other Gutenberg blocks.
              if (e.key !== 'Tab' || e.shiftKey || e.altKey || e.metaKey || e.ctrlKey) return
              e.preventDefault()
              document.execCommand('insertText', false, '  ')
            }}
          />
        </div>
      </figure>
    </>
  )
}

function CodeSave({ attributes: a }: { attributes: CodeAttributes }): React.JSX.Element {
  return (
    <figure {...useBlockProps.save(figureProps(a))} data-lang={languageOf(a.language)}>
      {a.title ? <figcaption className="cp-code__title">{a.title}</figcaption> : null}
      <CodePre html={a.html} />
    </figure>
  )
}

/** A language named by a class: "language-js" on the <code> or the <pre>. */
function languageOfClass(node: Element): string {
  const classes = `${node.className} ${node.querySelector('code')?.className ?? ''}`
  const match = classes.match(/\b(?:language|lang)-([\w+#-]+)/)
  return languageOf(match?.[1])
}

/** core/code stays for posts that have it, but new code goes into the Code block. */
export function hideCoreCode(): void {
  addFilter(
    'blocks.registerBlockType',
    'craftpages/hide-core-code',
    (settings: Record<string, unknown>, name: string) => {
      if (name !== 'core/code') return settings
      const transforms = (settings.transforms ?? {}) as Record<string, unknown>
      return {
        ...settings,
        supports: { ...(settings.supports as object), inserter: false },
        transforms: { ...transforms, from: [] }
      }
    }
  )
}

export function registerCodeBlock(): void {
  registerBlockType(CODE_BLOCK, {
    apiVersion: 3,
    title: translate('post.codeTitle'),
    description: translate('post.codeDescription'),
    category: 'text',
    icon: codeIcon,
    keywords: ['code', 'snippet', 'syntax', 'highlight', 'pre'],
    attributes: CODE_ATTRIBUTES,
    supports: { html: false, reusable: false, align: ['wide', 'full'] },
    transforms: {
      from: [
        {
          type: 'enter',
          regExp: /^```$/,
          transform: () => createBlock(CODE_BLOCK)
        },
        {
          type: 'block',
          blocks: ['core/code'],
          transform: ({ content }: { content: unknown }) => {
            const code = textOf(content)
            return createBlock(CODE_BLOCK, { code, html: plain(code, new Set()) })
          }
        },
        {
          type: 'raw',
          isMatch: (node: Node) => node.nodeName === 'PRE',
          transform: (node: Element) => {
            const code = (node.textContent ?? '').replace(/\n$/, '')
            return createBlock(CODE_BLOCK, {
              code,
              html: plain(code, new Set()),
              language: languageOfClass(node)
            })
          }
        }
      ],
      to: [
        {
          type: 'block',
          blocks: ['core/paragraph'],
          transform: ({ code }: CodeAttributes) =>
            createBlock('core/paragraph', {
              content: code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>')
            })
        }
      ]
    },
    edit: CodeEdit,
    save: CodeSave
  } as never)
}
