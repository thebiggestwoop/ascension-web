import type { RouteRecordRaw } from 'vue-router'

export const characterSheetRoutes: RouteRecordRaw[] = [
  {
    path: '/sheet',
    name: 'character-sheet',
    component: () => import('./index.vue'),
  },
]
