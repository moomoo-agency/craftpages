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
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react()]
  }
})
