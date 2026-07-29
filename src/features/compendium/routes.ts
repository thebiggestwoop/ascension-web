import type { RouteRecordRaw } from 'vue-router'

export const compendiumRoutes: RouteRecordRaw[] = [
  {
    path: '/compendium',
    name: 'compendium',
    component: () => import('./index.vue'),
  },
]
