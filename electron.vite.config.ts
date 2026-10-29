import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

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
    plugins: [react()]
  }
})
