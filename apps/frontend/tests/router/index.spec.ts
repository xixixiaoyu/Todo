import { describe, it, expect, vi, beforeEach } from 'vitest'
import router from '@/router/index'
import i18n from '@/i18n'

describe('Router Title', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock document.title
    document.title = ''
  })

  it('首页标题应该只显示应用名称', async () => {
    await router.push('/')
    const { t } = i18n.global
    const appName = t('common.appName')
    expect(document.title).toBe(appName)
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
