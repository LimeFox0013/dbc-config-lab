import type { App } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'compare',
      component: () => import('../views/CompareView.vue'),
    },
  ],
})

router.onError((error) => {
  console.error('Navigation failed', error)
})

export const setupRouter = (app: App): void => {
  app.use(router)
}
