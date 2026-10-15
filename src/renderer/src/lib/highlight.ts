import type { HighlighterCore, ThemedToken } from 'shiki/core'
import { bundledLanguages, bundledLanguagesInfo } from 'shiki/langs'
import { bundledThemes, bundledThemesInfo } from 'shiki/themes'

/**
 * Syntax highlighting for the Code block, done in the editor so the saved block is plain
 * static HTML: the published page needs no highlighter, only a small copy-button script.
 *
 * Shiki runs on its JavaScript regex engine (no WebAssembly), and each grammar and theme
 * is its own chunk, loaded the first time a block uses it. Once loaded, highlighting is
 * synchronous, so typing re-highlights in the same frame.
 */

export const PLAIN = 'text'
export const DEFAULT_THEME = 'github-dark'

export const LANGUAGES = bundledLanguagesInfo.map((lang) => ({ id: lang.id, name: lang.name }))
export const THEMES = bundledThemesInfo.map((theme) => ({
  id: theme.id,
  name: theme.displayName,
  dark: theme.type === 'dark'
}))

/** The language id Shiki knows for a name or alias ("ts", "language-js"), or plain text. */
export function languageOf(name: string | undefined): string {
  const id = (name ?? '').toLowerCase().replace(/^(language|lang)-/, '')
  return id in bundledLanguages ? id : PLAIN
}

const themeOf = (name: string | undefined): string =>
  name && name in bundledThemes ? name : DEFAULT_THEME

let core: Promise<HighlighterCore> | null = null

function highlighter(): Promise<HighlighterCore> {
  core ??= Promise.all([import('shiki/core'), import('shiki/engine/javascript')]).then(
    ([{ createHighlighterCore }, { createJavaScriptRegexEngine }]) =>
      createHighlighterCore({ engine: createJavaScriptRegexEngine(), langs: [], themes: [] })
  )
  return core
}

/** The highlighter, with the grammar and theme loaded. */
export async function prepare(language: string, theme: string): Promise<HighlighterCore> {
  const h = await highlighter()
  const lang = languageOf(language)
  const loads: Promise<void>[] = []
  if (lang !== PLAIN && !h.getLoadedLanguages().includes(lang))
    loads.push(h.loadLanguage(bundledLanguages[lang as keyof typeof bundledLanguages]))
  const th = themeOf(theme)
  if (!h.getLoadedThemes().includes(th))
    loads.push(h.loadTheme(bundledThemes[th as keyof typeof bundledThemes]))
  await Promise.all(loads)
  return h
}

/** "2, 4-6" → {2, 4, 5, 6}. Line numbers start at 1. */
export function parseLines(spec: string | undefined): Set<number> {
  const lines = new Set<number>()
  for (const part of (spec ?? '').split(',')) {
    const match = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/)
    if (!match) continue
    const from = Number(match[1])
    const to = Math.min(Number(match[2] ?? match[1]), from + 10_000)
    for (let n = from; n <= to; n++) lines.add(n)
  }
  return lines
}

const escape = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const lineOf = (inner: string, n: number, marked: Set<number>): string =>
  `<span class="${marked.has(n) ? 'line hl' : 'line'}">${inner}</span>`

/** The code as lines, uncoloured: shown until the highlighter is ready. */
export function plain(code: string, marked: Set<number>): string {
  return code
    .split('\n')
    .map((line, i) => lineOf(escape(line), i + 1, marked))
    .join('\n')
}

function styleOf(token: ThemedToken, fg: string): string {
  const style: string[] = []
  if (token.color && token.color.toLowerCase() !== fg) style.push(`color:${token.color}`)
  const font = token.fontStyle ?? 0
  if (font & 1) style.push('font-style:italic')
  if (font & 2) style.push('font-weight:bold')
  if (font & 4) style.push('text-decoration:underline')
  return style.join(';')
}

export interface Highlighted {
  html: string
  bg: string
  fg: string
}

/**
 * Highlighted lines, kept small: the theme's own text colour is left to the block, and
 * neighbouring tokens of the same style share a span.
 */
export function highlight(
  h: HighlighterCore,
  code: string,
  language: string,
  theme: string,
  marked: Set<number>
): Highlighted {
  const result = h.codeToTokens(code, { lang: languageOf(language), theme: themeOf(theme) })
  const fg = (result.fg ?? '').toLowerCase()
  const html = result.tokens
    .map((line, i) => {
      let inner = ''
      let style = ''
      let text = ''
      const flush = (): void => {
        if (text) inner += style ? `<span style="${style}">${escape(text)}</span>` : escape(text)
        text = ''
      }
      for (const token of line) {
        // Spaces show no colour, so they join whatever span they sit in.
        const blank = !/\S/.test(token.content) && !((token.fontStyle ?? 0) & 4)
        const next = blank ? style : styleOf(token, fg)
        if (next !== style) {
          flush()
          style = next
        }
        text += token.content
      }
      flush()
      return lineOf(inner, i + 1, marked)
    })
    .join('\n')
  return { html, bg: result.bg ?? '', fg: result.fg ?? '' }
}
