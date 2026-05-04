import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import router from '@/router/index'
import i18n from '@/i18n'
import { useAuthStore } from '@/features/auth/stores/auth'

// Mock the components to speed up tests and avoid loading heavy dependencies
vi.mock('@/features/todo/TodoView.vue', () => ({
  default: { name: 'TodoView', template: '<div></div>' },
}))
vi.mock('@/features/auth/views/LoginView.vue', () => ({
  default: { name: 'LoginView', template: '<div></div>' },
}))
vi.mock('@/features/auth/views/RegisterView.vue', () => ({
  default: { name: 'RegisterView', template: '<div></div>' },
}))
vi.mock('@/features/auth/views/ForgotPasswordView.vue', () => ({
  default: { name: 'ForgotPasswordView', template: '<div></div>' },
}))
vi.mock('@/features/auth/views/ResetPasswordView.vue', () => ({
  default: { name: 'ResetPasswordView', template: '<div></div>' },
}))
vi.mock('@/views/error/NotFoundView.vue', () => ({
  default: { name: 'NotFoundView', template: '<div></div>' },
}))
vi.mock('@/features/mcp/views/McpSettingsView.vue', () => ({
  default: { name: 'McpSettingsView', template: '<div></div>' },
}))
vi.mock('@/features/novel/views/NovelBookshelfView.vue', () => ({
  default: { name: 'NovelBookshelfView', template: '<div></div>' },
}))
vi.mock('@/features/novel/views/NovelDraftView.vue', () => ({
  default: { name: 'NovelDraftView', template: '<div></div>' },
}))
vi.mock('@/features/teaching/views/TeachingDashboardView.vue', () => ({
  default: { name: 'TeachingDashboardView', template: '<div></div>' },
}))

describe('Router Title', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    document.title = ''
  })

  it('首页标题应该显示完整应用名称', async () => {
    await router.push('/')
    const { t } = i18n.global
    const fullAppName = t('common.fullAppName')
    expect(document.title).toBe(fullAppName)
  })

  it('登录页标题应该显示“页面标题 - 应用名称”', async () => {
    await router.push('/login')
    const { t } = i18n.global
    const appName = t('common.appName')
    const loginTitle = t('login.title')
    expect(document.title).toBe(`${loginTitle} - ${appName}`)
  })

  it('注册页标题应该显示“页面标题 - 应用名称”', async () => {
    await router.push('/register')
    const { t } = i18n.global
    const appName = t('common.appName')
    const registerTitle = t('register.title')
    expect(document.title).toBe(`${registerTitle} - ${appName}`)
  })
})

describe('Router Auth Guard', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('未登录访问 /novel 应跳转登录页并携带 redirect 参数', async () => {
    const auth = useAuthStore()
    auth.token = null

    await router.push('/novel')

    expect(router.currentRoute.value.path).toBe('/login')
    expect(router.currentRoute.value.query.redirect).toBe('/novel')
  })

  it('未登录访问 /novel/:id 应携带完整原路径作为 redirect', async () => {
    const auth = useAuthStore()
    auth.token = null

    await router.push('/novel/abc-123')

    expect(router.currentRoute.value.path).toBe('/login')
    expect(router.currentRoute.value.query.redirect).toBe('/novel/abc-123')
  })

  it('未登录访问 /teaching 应被拦截', async () => {
    const auth = useAuthStore()
    auth.token = null

    await router.push('/teaching')

    expect(router.currentRoute.value.path).toBe('/login')
    expect(router.currentRoute.value.query.redirect).toBe('/teaching')
  })

  it('已登录访问受保护路由应正常进入', async () => {
    const auth = useAuthStore()
    auth.token = 'fake-jwt-token'

    await router.push('/novel')

    expect(router.currentRoute.value.path).toBe('/novel')
  })

  it('Todo 主页（/）未登录也能访问（匿名模式）', async () => {
    const auth = useAuthStore()
    auth.token = null

    await router.push('/')

    expect(router.currentRoute.value.path).toBe('/')
  })
})
