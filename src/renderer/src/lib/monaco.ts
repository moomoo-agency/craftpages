/**
 * Monaco (VS Code's editor) for code mode. Loaded only when code mode opens: the views
 * import it lazily. Workers are bundled by Vite and served from the app itself, so the
 * content security policy needs no changes.
 */
import * as monaco from 'monaco-editor'
import EditorWorker from 'monaco-editor/editor/editor.worker?worker'
import CssWorker from 'monaco-editor/language/css/css.worker?worker'
import HtmlWorker from 'monaco-editor/language/html/html.worker?worker'
import JsonWorker from 'monaco-editor/language/json/json.worker?worker'
import TsWorker from 'monaco-editor/language/typescript/ts.worker?worker'

self.MonacoEnvironment = {
  getWorker(_id: string, label: string): Worker {
    if (label === 'html' || label === 'handlebars' || label === 'razor') return new HtmlWorker()
    if (label === 'css' || label === 'scss' || label === 'less') return new CssWorker()
    if (label === 'json') return new JsonWorker()
    if (label === 'typescript' || label === 'javascript') return new TsWorker()
    return new EditorWorker()
  }
}

/** Monaco's language id for a file. */
export function languageOf(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'htm' || ext === 'html') return 'html'
  if (ext === 'js' || ext === 'mjs') return 'javascript'
  if (ext === 'json' || ext === 'webmanifest') return 'json'
  if (ext === 'svg') return 'xml'
  if (ext === 'md') return 'markdown'
  return ['css', 'xml'].includes(ext) ? ext : 'plaintext'
}

/** The app's theme (data-theme on <html>, else the OS) as a Monaco theme. */
export function currentTheme(): string {
  const forced = document.documentElement.getAttribute('data-theme')
  const dark = forced
    ? forced === 'dark'
    : window.matchMedia('(prefers-color-scheme: dark)').matches
  return dark ? 'vs-dark' : 'vs'
}

/** Keeps Monaco's theme in step with the app's; returns the stop function. */
export function followTheme(): () => void {
  const apply = (): void => monaco.editor.setTheme(currentTheme())
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const observer = new MutationObserver(apply)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  media.addEventListener('change', apply)
  apply()
  return () => {
    observer.disconnect()
    media.removeEventListener('change', apply)
  }
}

export default monaco
