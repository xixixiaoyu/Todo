import { createRouter, createWebHistory, createWebHashHistory } from 'vue-router'
import type { RouteLocationNormalized } from 'vue-router'
import i18n from '@/i18n'
import { useAuthStore } from '@/features/auth/stores/auth'
import { useToast } from '@/composables/useToast'

/**
 * 应用路由配置
 */
const router = createRouter({
  history: import.meta.env.IS_WAILS
    ? createWebHashHistory(import.meta.env.BASE_URL)
    : createWebHistory(import.meta.env.BASE_URL),
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
      path: '/settings/mcp',
      name: 'mcp-settings',
      component: () => import('@/features/mcp/views/McpSettingsView.vue'),
      meta: { title: 'mcp.settings.title', requiresAuth: true },
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
  const fullAppName = t('common.fullAppName')

  if (translatedTitle) {
    document.title = `${translatedTitle} - ${appName}`
  } else {
    // 如果没有特定标题，则使用完整应用名称，保持与 index.html 一致
    document.title = fullAppName
  }
})

/**
 * 认证守卫：拦截 meta.requiresAuth 的路由
 * - 未登录 → 跳 /login?redirect=<原路径>，并 toast 提示
 * - 已登录 → 放行
 * Todo 主页（/）支持匿名模式，故不加守卫
 */
router.beforeEach((to: RouteLocationNormalized) => {
  if (!to.meta.requiresAuth) return true

  const authStore = useAuthStore()
  if (authStore.isAuthenticated) return true

  const { t } = i18n.global
  const { warning } = useToast()
  warning(t('auth.loginRequired'))

  return {
    path: '/login',
    query: { redirect: to.fullPath },
  }
})

export default router
