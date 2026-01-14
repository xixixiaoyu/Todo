import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import TodoHeader from '@/features/todo/components/TodoHeader.vue'

// Mock vue-i18n
const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  messages: {
    'zh-CN': {
      todo: {
        title: '待办事项',
        language: '切换语言',
        search: '搜索',
        visualMode: '视觉模式',
      },
      common: {
        theme: {
          system: '系统默认',
        },
        toggleLanguage: '切换语言',
      },
    },
    'en-US': {
      todo: {
        title: 'Todo List',
        language: 'Switch Language',
        search: 'Search',
        visualMode: 'Visual Mode',
      },
      common: {
        theme: {
          system: 'System',
        },
        toggleLanguage: 'Switch Language',
      },
    },
  },
})

describe('TodoHeader', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('应该正确渲染标题', () => {
    const wrapper = mount(TodoHeader, {
      global: {
        plugins: [i18n],
      },
    })

    expect(wrapper.find('h1').text()).toBe('待办事项')
  })

  it('点击语言切换按钮应该切换语言并保存到 localStorage', async () => {
    const wrapper = mount(TodoHeader, {
      global: {
        plugins: [i18n],
      },
    })

    const buttons = wrapper.findAll('button')
    const langButton = buttons.find((b) => b.find('.lucide-languages').exists())

    // 初始是 zh-CN
    expect(i18n.global.locale.value).toBe('zh-CN')

    await langButton?.trigger('click')

    // 切换到 en-US
    expect(i18n.global.locale.value).toBe('en-US')
    expect(localStorage.getItem('locale')).toBe('en-US')

    await langButton?.trigger('click')

    // 切换回 zh-CN
    expect(i18n.global.locale.value).toBe('zh-CN')
    expect(localStorage.getItem('locale')).toBe('zh-CN')
  })

  it('应该包含语言切换按钮', () => {
    const wrapper = mount(TodoHeader, {
      global: {
        plugins: [i18n],
      },
    })

    const buttons = wrapper.findAll('button')
    const langButton = buttons.find((b) => b.find('.lucide-languages').exists())
    expect(langButton?.exists()).toBe(true)
  })
})
