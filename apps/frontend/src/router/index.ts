import { createRouter, createWebHistory } from 'vue-router'
import i18n from '@/i18n'

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
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/features/auth/views/LoginView.vue'),
      meta: { title: 'login.title' },
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('@/features/auth/views/RegisterView.vue'),
      meta: { title: 'register.title' },
    },
    {
      path: '/forgot-password',
      name: 'forgot-password',
      component: () => import('@/features/auth/views/ForgotPasswordView.vue'),
      meta: { title: 'forgotPassword.title' },
    },
    {
      path: '/reset-password',
      name: 'reset-password',
      component: () => import('@/features/auth/views/ResetPasswordView.vue'),
      meta: { title: 'resetPassword.title' },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/views/error/NotFoundView.vue'),
      meta: { title: 'notFound.title' },
    },
  ],
})

// 路由守卫：更新页面标题
router.beforeEach((to) => {
  const { t } = i18n.global
  const titleKey = to.meta.title as string
  const translatedTitle = titleKey ? t(titleKey) : ''
  const appName = t('common.appName')
  document.title = translatedTitle ? `${translatedTitle} - ${appName}` : appName
})

export default router
