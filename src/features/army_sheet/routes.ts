import type { RouteRecordRaw } from 'vue-router'

export const armySheetRoutes: RouteRecordRaw[] = [
  {
    path: '/armies',
    name: 'army-list',
    component: () => import('./ArmyList.vue'),
  },
  {
    path: '/armies/new',
    name: 'army-builder',
    component: () => import('./ArmyBuilder.vue'),
  },
  {
    path: '/armies/:id/edit',
    name: 'army-edit',
    component: () => import('./ArmyBuilder.vue'),
    props: true,
  },
  {
    path: '/armies/:id',
    name: 'army-sheet',
    component: () => import('./index.vue'),
    props: true,
  },
]
