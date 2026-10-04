import type { App } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import {
  HANDOFF_PAGE_PATH,
  LAUNCH_PAGE_PATH,
  REPORT_PAGE_PATH,
} from './constants'

export {
  HANDOFF_PAGE_PATH,
  LAUNCH_PAGE_PATH,
  NETWORK_QUERY_KEY,
  REPORT_PAGE_PATH,
} from './constants'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'compare',
      component: () => import('../views/CompareView.vue'),
    },
    {
      path: `${LAUNCH_PAGE_PATH}/:config`,
      name: 'launch',
      component: () => import('../views/LaunchView.vue'),
    },
    {
      path: `${REPORT_PAGE_PATH}/:config`,
      name: 'report',
      component: () => import('../views/ReportView.vue'),
    },
    {
      path: HANDOFF_PAGE_PATH,
      name: 'act',
      component: () => import('../views/ActView.vue'),
    },
  ],
})

router.onError((error) => {
  console.error('Navigation failed', error)
})

export const setupRouter = (app: App): void => {
  app.use(router)
}
