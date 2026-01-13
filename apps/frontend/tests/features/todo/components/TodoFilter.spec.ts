import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import TodoFilter from '@/features/todo/components/TodoFilter.vue'
import { Tabs } from '@/components/ui/tabs'

// Mock vue-i18n
const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  messages: {
    'zh-CN': {
      todo: {
        pending: '待完成',
        completed: '已完成',
      },
    },
  },
})

describe('TodoFilter', () => {
  it('should render filter buttons', () => {
    const wrapper = mount(TodoFilter, {
      props: {
        filter: 'pending',
        isDrawerOpen: false,
        showSearch: false,
      },
      global: {
        plugins: [i18n],
      },
    })

    const buttons = wrapper.findAll('button')
    // 2 tabs + 2 desktop tools (AI, Search) + 1 desktop expand toggle = 5 buttons
    expect(buttons).toHaveLength(5)
  })

  it('should emit update:isDrawerOpen when AI button clicked', async () => {
    const wrapper = mount(TodoFilter, {
      props: {
        filter: 'pending',
        isDrawerOpen: false,
        showSearch: false,
      },
      global: {
        plugins: [i18n],
      },
    })

    const buttons = wrapper.findAll('button')
    const aiButton = buttons.find((b) => b.find('.lucide-clover').exists())
    await aiButton?.trigger('click')

    expect(wrapper.emitted('update:isDrawerOpen')).toBeTruthy()
    expect(wrapper.emitted('update:isDrawerOpen')?.[0]).toEqual([true])
  })

  it('should emit update:showSearch when Search button clicked', async () => {
    const wrapper = mount(TodoFilter, {
      props: {
        filter: 'pending',
        isDrawerOpen: false,
        showSearch: false,
      },
      global: {
        plugins: [i18n],
      },
    })

    const buttons = wrapper.findAll('button')
    const searchButton = buttons.find((b) => b.find('.lucide-search').exists())
    await searchButton?.trigger('click')

    expect(wrapper.emitted('update:showSearch')).toBeTruthy()
    expect(wrapper.emitted('update:showSearch')?.[0]).toEqual([true])
  })

  it('should display pending button text', () => {
    const wrapper = mount(TodoFilter, {
      props: {
        filter: 'pending',
        isDrawerOpen: false,
        showSearch: false,
      },
      global: {
        plugins: [i18n],
      },
    })

    const buttons = wrapper.findAll('button')
    // buttons[0] is AI, buttons[1] is Search, buttons[2] is Pending, buttons[3] is Completed, buttons[4] is Expand
    expect(buttons[2].text()).toBe('待完成')
  })

  it('should display completed button text', () => {
    const wrapper = mount(TodoFilter, {
      props: {
        filter: 'pending',
        isDrawerOpen: false,
        showSearch: false,
      },
      global: {
        plugins: [i18n],
      },
    })

    const buttons = wrapper.findAll('button')
    // buttons[0] is AI, buttons[1] is Search, buttons[2] is Pending, buttons[3] is Completed, buttons[4] is Expand
    expect(buttons[3].text()).toBe('已完成')
  })

  it('should apply active style to pending button when filter is pending', () => {
    const wrapper = mount(TodoFilter, {
      props: {
        filter: 'pending',
        isDrawerOpen: false,
        showSearch: false,
      },
      global: {
        plugins: [i18n],
      },
    })

    const pendingButton = wrapper.findAll('button')[2]
    expect(pendingButton.attributes('data-state')).toBe('active')
  })

  it('should apply inactive style to completed button when filter is pending', () => {
    const wrapper = mount(TodoFilter, {
      props: {
        filter: 'pending',
        isDrawerOpen: false,
        showSearch: false,
      },
      global: {
        plugins: [i18n],
      },
    })

    const completedButton = wrapper.findAll('button')[3]
    expect(completedButton.attributes('data-state')).toBe('inactive')
  })

  it('should apply active style to completed button when filter is completed', () => {
    const wrapper = mount(TodoFilter, {
      props: {
        filter: 'completed',
        isDrawerOpen: false,
        showSearch: false,
      },
      global: {
        plugins: [i18n],
      },
    })

    const completedButton = wrapper.findAll('button')[3]
    expect(completedButton.attributes('data-state')).toBe('active')
  })

  it('should apply inactive style to pending button when filter is completed', () => {
    const wrapper = mount(TodoFilter, {
      props: {
        filter: 'completed',
        isDrawerOpen: false,
        showSearch: false,
      },
      global: {
        plugins: [i18n],
      },
    })

    const pendingButton = wrapper.findAll('button')[2]
    expect(pendingButton.attributes('data-state')).toBe('inactive')
  })

  it('should emit update:filter with pending when pending button clicked', async () => {
    const wrapper = mount(TodoFilter, {
      props: {
        filter: 'completed',
        isDrawerOpen: false,
        showSearch: false,
      },
      global: {
        plugins: [i18n],
      },
    })

    const tabs = wrapper.findComponent(Tabs)
    await tabs.vm.$emit('update:modelValue', 'pending')

    expect(wrapper.emitted('update:filter')).toBeTruthy()
    expect(wrapper.emitted('update:filter')?.[0]).toEqual(['pending'])
  })

  it('should emit update:filter with completed when completed button clicked', async () => {
    const wrapper = mount(TodoFilter, {
      props: {
        filter: 'pending',
        isDrawerOpen: false,
        showSearch: false,
      },
      global: {
        plugins: [i18n],
      },
    })

    const tabs = wrapper.findComponent(Tabs)
    await tabs.vm.$emit('update:modelValue', 'completed')

    expect(wrapper.emitted('update:filter')).toBeTruthy()
    expect(wrapper.emitted('update:filter')?.[0]).toEqual(['completed'])
  })
})
