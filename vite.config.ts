import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  // heroclub.app's root is reserved for a future hub/landing page - this app lives at
  // /ascension-web/, so every asset URL Vite emits needs that prefix baked in.
  base: '/ascension-web/',
  plugins: [vue()],
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
