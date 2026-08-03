import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@content': fileURLToPath(new URL('./content', import.meta.url)),
    },
  },
  build: {
    // GitHub Pages only offers "/ (root)" or "/docs" as the source folder for a branch -
    // building straight to docs/ matches the same "build, then push" convention already used
    // for the other Vite-built project (awesome-trackers), so there's one deploy mental model
    // across projects instead of two.
    outDir: 'docs',
  },
})
