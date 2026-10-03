import type { App } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import { LAUNCH_PAGE_PATH } from './constants'

export { LAUNCH_PAGE_PATH, NETWORK_QUERY_KEY } from './constants'

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
  ],
})

router.onError((error) => {
  console.error('Navigation failed', error)
})

export const setupRouter = (app: App): void => {
  app.use(router)
}
