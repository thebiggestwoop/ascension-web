import { createRouter, createWebHistory } from 'vue-router'

import { characterBuilderRoutes } from '@/features/character_builder/routes'
import { characterSheetRoutes } from '@/features/character_sheet/routes'
import { compendiumRoutes } from '@/features/compendium/routes'

const router = createRouter({
  history: createWebHistory(),
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
