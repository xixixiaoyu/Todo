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
      },
    },
    'en-US': {
      todo: {
        title: 'Todo List',
        language: 'Switch Language',
        search: 'Search',
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
      props: {
        isDrawerOpen: false,
        showSearch: false,
      },
      global: {
        plugins: [i18n],
      },
    })

    expect(wrapper.find('h1').text()).toBe('待办事项')
  })

  it('点击 Clover 按钮应该触发 update:isDrawerOpen 事件', async () => {
    const wrapper = mount(TodoHeader, {
      props: {
        isDrawerOpen: false,
        showSearch: false,
      },
      global: {
        plugins: [i18n],
      },
    })

    const cloverButton = wrapper.findAll('button')[0]
    await cloverButton.trigger('click')

    expect(wrapper.emitted('update:isDrawerOpen')).toBeTruthy()
    expect(wrapper.emitted('update:isDrawerOpen')?.[0]).toEqual([true])
  })

  it('点击 Search 按钮应该触发 update:showSearch 事件', async () => {
    const wrapper = mount(TodoHeader, {
      props: {
        isDrawerOpen: false,
        showSearch: false,
      },
      global: {
        plugins: [i18n],
      },
    })

    const searchButton = wrapper.findAll('button')[1]
    await searchButton.trigger('click')

    expect(wrapper.emitted('update:showSearch')).toBeTruthy()
    expect(wrapper.emitted('update:showSearch')?.[0]).toEqual([true])
  })

  it('点击语言切换按钮应该切换语言并保存到 localStorage', async () => {
    const wrapper = mount(TodoHeader, {
      props: {
        isDrawerOpen: false,
        showSearch: false,
      },
      global: {
        plugins: [i18n],
      },
    })

    const langButton = wrapper.findAll('button')[3]

    // 初始是 zh-CN
    expect(i18n.global.locale.value).toBe('zh-CN')

    await langButton.trigger('click')

    // 切换到 en-US
    expect(i18n.global.locale.value).toBe('en-US')
    expect(localStorage.getItem('locale')).toBe('en-US')

    await langButton.trigger('click')

    // 切换回 zh-CN
    expect(i18n.global.locale.value).toBe('zh-CN')
    expect(localStorage.getItem('locale')).toBe('zh-CN')
  })

  it('语言切换按钮应该是最后一个按钮', () => {
    const wrapper = mount(TodoHeader, {
      props: {
        isDrawerOpen: false,
        showSearch: false,
      },
      global: {
        plugins: [i18n],
      },
    })

    const buttons = wrapper.findAll('button')
    expect(buttons.length).toBe(4)

    // 最后一个按钮的 title 应该是语言切换
    expect(buttons[3].attributes('title')).toBe('切换语言')
  })
})
