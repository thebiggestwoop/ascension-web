import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vuetify, { transformAssetUrls } from 'vite-plugin-vuetify'

export default defineConfig({
  // heroclub.app's root is reserved for a future hub/landing page - this app lives at
  // /ascension-web/, so every asset URL Vite emits needs that prefix baked in.
  base: '/ascension-web/',
  plugins: [
    vue({ template: { transformAssetUrls } }),
    // Auto-imports only the Vuetify components/directives actually used per-file (scanning
    // each SFC's template), instead of main.ts bundling the entire library - was the single
    // biggest contributor to the initial bundle size (~650KB JS + ~825KB CSS unminified).
    vuetify({ autoImport: true }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@content': fileURLToPath(new URL('./content', import.meta.url)),
    },
  },
  build: {
    // GitHub Pages only offers "/ (root)" or "/docs" as the source folder for a branch -
    // building straight to docs/ascension-web/ matches the same "build, then push" convention
    // already used for the other Vite-built project (awesome-trackers), while leaving
    // docs/index.html, docs/CNAME, and docs/404.html (hand-placed, not Vite-managed) alone -
    // Vite only empties the outDir it's told to build into, not docs/ itself.
    outDir: 'docs/ascension-web',
  },
})
