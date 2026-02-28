import { describe, it, expect, vi, beforeEach } from 'vitest'
import router from '@/router/index'
import i18n from '@/i18n'

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
vi.mock('@/features/auth/views/AuthCallbackView.vue', () => ({
  default: { name: 'AuthCallbackView', template: '<div></div>' },
}))
vi.mock('@/views/error/NotFoundView.vue', () => ({
  default: { name: 'NotFoundView', template: '<div></div>' },
}))

describe('Router Title', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock document.title
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
