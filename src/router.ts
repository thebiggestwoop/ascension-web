import { createRouter, createWebHistory } from 'vue-router'

import { characterBuilderRoutes } from '@/features/character_builder/routes'
import { characterSheetRoutes } from '@/features/character_sheet/routes'
import { armySheetRoutes } from '@/features/army_sheet/routes'
import { compendiumRoutes } from '@/features/compendium/routes'
import { gmToolkitRoutes } from '@/features/gm_toolkit/routes'

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
    ...armySheetRoutes,
    ...compendiumRoutes,
    ...gmToolkitRoutes,
  ],
})

export default router
