import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import router from '@/router/index'
import i18n from '@/i18n'

// Mock the components to speed up tests and avoid loading heavy dependencies
vi.mock('@/features/todo/TodoView.vue', () => ({
  default: { name: 'TodoView', template: '<div></div>' },
}))
vi.mock('@/views/error/NotFoundView.vue', () => ({
  default: { name: 'NotFoundView', template: '<div></div>' },
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
})
