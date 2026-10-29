/**
 * Stands in for monaco-editor's typescript/tsMode.js, the JavaScript and TypeScript
 * language service, which starts ts.worker (13 MB in the app). Without it .js files keep
 * their colours and Monaco's editing (brackets, folding, find) but get no autocomplete,
 * hovers or error underlines. Swapped in by electron.vite.config.ts.
 */
const unavailable = (): Promise<never> =>
  Promise.reject(new Error('The JavaScript language service is not included in CraftPages.'))

export const setupTypeScript = (): void => {}
export const setupJavaScript = (): void => {}
export const getTypeScriptWorker = unavailable
export const getJavaScriptWorker = unavailable
