import type { RouteRecordRaw } from 'vue-router'

export const characterBuilderRoutes: RouteRecordRaw[] = [
  {
    path: '/builder',
    name: 'character-builder',
    component: () => import('./index.vue'),
  },
]
