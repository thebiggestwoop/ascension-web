import type { RouteRecordRaw } from 'vue-router'

export const characterSheetRoutes: RouteRecordRaw[] = [
  {
    path: '/sheet',
    name: 'character-sheet-list',
    component: () => import('./components/CharacterList.vue'),
  },
  {
    path: '/sheet/:id',
    name: 'character-sheet',
    component: () => import('./index.vue'),
    props: true,
  },
]
