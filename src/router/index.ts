import { createRouter, createWebHashHistory } from 'vue-router';

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),

  routes: [
    {
      path: '/',
      redirect: '/activity',
    },
    {
      path: '/activity',
      component: () => import('@/views/activity-view/ActivityView.vue'),
    },
    {
      path: '/studio',
      component: () => import('@/views/studio/StudioView.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/activity',
    },
  ],
});

export default router;
