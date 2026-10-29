import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'

/**
 * Monaco's JavaScript/TypeScript service (tsMode.js) starts ts.worker, 13 MB of the app,
 * for autocomplete and error underlines in .js files. It is swapped for a stub; see it.
 */
function withoutMonacoTypeScript(): Plugin {
  const stub = resolve('src/renderer/src/lib/stubs/monaco-ts-mode.ts')
  return {
    name: 'craftpages:without-monaco-typescript',
    enforce: 'pre',
    resolveId(source, importer) {
      const fromMonaco = importer?.replace(/\\/g, '/').includes('/features/typescript/')
      return source === './tsMode.js' && fromMonaco ? stub : null
    }
  }
}

export default defineConfig({
  main: {
    // @noble/hashes is ESM-only; bundle it instead of require()-ing it at runtime.
    build: { externalizeDeps: { exclude: ['@noble/hashes'] } }
  },
  preload: {},
  renderer: {
    resolve: {
      alias: [
        { find: '@renderer', replacement: resolve('src/renderer/src') },
        // Gutenberg's in-browser image processing (wasm-vips, 13 MB), never enabled here:
        // see the stub.
        {
          find: /^@wordpress\/vips\/worker$/,
          replacement: resolve('src/renderer/src/lib/stubs/vips-worker.ts')
        }
      ]
    },
    plugins: [react(), withoutMonacoTypeScript()]
  }
})
