import { createRouter, createWebHistory } from 'vue-router'

/**
 * 应用路由配置
 */
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'todo',
      component: () => import('@/features/todo/TodoView.vue'),
      meta: { title: '待办事项' },
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/features/auth/views/LoginView.vue'),
      meta: { title: '登录' },
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('@/features/auth/views/RegisterView.vue'),
      meta: { title: '注册' },
    },
    {
      path: '/forgot-password',
      name: 'forgot-password',
      component: () => import('@/features/auth/views/ForgotPasswordView.vue'),
      meta: { title: '找回密码' },
    },
    {
      path: '/reset-password',
      name: 'reset-password',
      component: () => import('@/features/auth/views/ResetPasswordView.vue'),
      meta: { title: '重置密码' },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/views/error/NotFoundView.vue'),
      meta: { title: '页面未找到' },
    },
  ],
})

// 路由守卫：更新页面标题
router.beforeEach((to) => {
  const title = to.meta.title as string
  document.title = title ? `${title} - My App` : 'My App'
})

export default router
