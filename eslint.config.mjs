import { defineConfig } from 'eslint/config'
import tseslint from '@electron-toolkit/eslint-config-ts'
import eslintConfigPrettier from '@electron-toolkit/eslint-config-prettier'
import eslintPluginReact from 'eslint-plugin-react'
import eslintPluginReactHooks from 'eslint-plugin-react-hooks'
import eslintPluginReactRefresh from 'eslint-plugin-react-refresh'

export default defineConfig(
  { ignores: ['**/node_modules', '**/dist', '**/out'] },
  tseslint.configs.recommended,
  eslintPluginReact.configs.flat.recommended,
  eslintPluginReact.configs.flat['jsx-runtime'],
  {
    settings: {
      react: {
        version: 'detect'
      }
    }
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': eslintPluginReactHooks,
      'react-refresh': eslintPluginReactRefresh
    },
    rules: {
      ...eslintPluginReactHooks.configs.recommended.rules,
      ...eslintPluginReactRefresh.configs.vite.rules
    }
  },
  {
    // Plain browser script injected into the page-editor iframe (see src/main/preview/server.ts).
    files: ['src/main/preview/*.js', 'src/main/*.js', 'src/main/search/*.js'],
    rules: { '@typescript-eslint/explicit-function-return-type': 'off' }
  },
  {
    // The sync Worker, uploaded to Cloudflare as it is (see src/main/sync/cloudflare-store.ts).
    files: ['src/main/sync/worker/*.js'],
    languageOptions: { globals: { WebSocketPair: 'readonly' } },
    rules: { '@typescript-eslint/explicit-function-return-type': 'off' }
  },
  {
    // Site search scripts shipped into users' sites: plain ES2015 without a build step.
    files: ['src/main/search/*.js'],
    rules: {
      '@typescript-eslint/no-this-alias': 'off',
      '@typescript-eslint/no-empty-function': 'off'
    }
  },
  eslintConfigPrettier
)
