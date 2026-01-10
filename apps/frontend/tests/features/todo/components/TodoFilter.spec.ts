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
      },
      global: {
        plugins: [i18n],
      },
    })

    const buttons = wrapper.findAll('button')
    expect(buttons).toHaveLength(2)
  })

  it('should display pending button text', () => {
    const wrapper = mount(TodoFilter, {
      props: {
        filter: 'pending',
      },
      global: {
        plugins: [i18n],
      },
    })

    const buttons = wrapper.findAll('button')
    expect(buttons[0].text()).toBe('待完成')
  })

  it('should display completed button text', () => {
    const wrapper = mount(TodoFilter, {
      props: {
        filter: 'pending',
      },
      global: {
        plugins: [i18n],
      },
    })

    const buttons = wrapper.findAll('button')
    expect(buttons[1].text()).toBe('已完成')
  })

  it('should apply active style to pending button when filter is pending', () => {
    const wrapper = mount(TodoFilter, {
      props: {
        filter: 'pending',
      },
      global: {
        plugins: [i18n],
      },
    })

    const pendingButton = wrapper.findAll('button')[0]
    expect(pendingButton.attributes('data-state')).toBe('active')
  })

  it('should apply inactive style to completed button when filter is pending', () => {
    const wrapper = mount(TodoFilter, {
      props: {
        filter: 'pending',
      },
      global: {
        plugins: [i18n],
      },
    })

    const completedButton = wrapper.findAll('button')[1]
    expect(completedButton.attributes('data-state')).toBe('inactive')
  })

  it('should apply active style to completed button when filter is completed', () => {
    const wrapper = mount(TodoFilter, {
      props: {
        filter: 'completed',
      },
      global: {
        plugins: [i18n],
      },
    })

    const completedButton = wrapper.findAll('button')[1]
    expect(completedButton.attributes('data-state')).toBe('active')
  })

  it('should apply inactive style to pending button when filter is completed', () => {
    const wrapper = mount(TodoFilter, {
      props: {
        filter: 'completed',
      },
      global: {
        plugins: [i18n],
      },
    })

    const pendingButton = wrapper.findAll('button')[0]
    expect(pendingButton.attributes('data-state')).toBe('inactive')
  })

  it('should emit update:filter with pending when pending button clicked', async () => {
    const wrapper = mount(TodoFilter, {
      props: {
        filter: 'completed',
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
