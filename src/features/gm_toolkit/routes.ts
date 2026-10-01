import type { RouteRecordRaw } from 'vue-router'

export const gmToolkitRoutes: RouteRecordRaw[] = [
  {
    path: '/gm',
    name: 'gm-toolkit',
    component: () => import('./index.vue'),
  },
]
