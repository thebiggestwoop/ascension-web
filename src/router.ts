import { createRouter, createWebHistory } from 'vue-router'

import { characterBuilderRoutes } from '@/features/character_builder/routes'
import { characterSheetRoutes } from '@/features/character_sheet/routes'
import { compendiumRoutes } from '@/features/compendium/routes'

const router = createRouter({
  // Matches vite.config.ts's `base` - this app is served at heroclub.app/ascension-web/, not
  // the domain root.
  history: createWebHistory('/ascension-web/'),
  routes: [
    {
      path: '/',
      name: 'main-menu',
      component: () => import('@/features/main_menu/index.vue'),
    },
    ...characterBuilderRoutes,
    ...characterSheetRoutes,
    ...compendiumRoutes,
  ],
})

export default router
