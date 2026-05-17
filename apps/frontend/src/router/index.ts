import { createRouter, createWebHistory, createWebHashHistory } from 'vue-router'
import i18n from '@/i18n'

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
      path: '/settings/mcp',
      name: 'mcp-settings',
      component: () => import('@/features/mcp/views/McpSettingsView.vue'),
      meta: { title: 'mcp.settings.title' },
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
export default router
