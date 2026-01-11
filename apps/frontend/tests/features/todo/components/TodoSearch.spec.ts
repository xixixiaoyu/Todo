import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import TodoSearch from '@/features/todo/components/TodoSearch.vue'
import { Input } from '@/components/ui/input'

// Mock vue-i18n
const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  messages: {
    'zh-CN': {
      todo: {
        searchPlaceholder: '搜索待办事项...',
      },
    },
  },
})

describe('TodoSearch', () => {
  it('should render correctly', () => {
    const wrapper = mount(TodoSearch, {
      props: {
        modelValue: '',
      },
      global: {
        plugins: [i18n],
      },
    })

    const input = wrapper.findComponent(Input)
    expect(input.exists()).toBe(true)
    expect(input.attributes('placeholder')).toBe('搜索待办事项...')
  })

  it('should emit update:modelValue when input changes', async () => {
    const wrapper = mount(TodoSearch, {
      props: {
        modelValue: '',
      },
      global: {
        plugins: [i18n],
      },
    })

    const input = wrapper.findComponent(Input)
    await input.vm.$emit('update:modelValue', 'test query')

    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['test query'])
  })

  it('should show clear button when modelValue is not empty', () => {
    const wrapper = mount(TodoSearch, {
      props: {
        modelValue: 'test',
      },
      global: {
        plugins: [i18n],
      },
    })

    const clearBtn = wrapper.find('button')
    expect(clearBtn.exists()).toBe(true)
  })

  it('should not show clear button when modelValue is empty', () => {
    const wrapper = mount(TodoSearch, {
      props: {
        modelValue: '',
      },
      global: {
        plugins: [i18n],
      },
    })

    const clearBtn = wrapper.find('button')
    expect(clearBtn.exists()).toBe(false)
  })

  it('should emit clear event when clear button is clicked', async () => {
    const wrapper = mount(TodoSearch, {
      props: {
        modelValue: 'test',
      },
      global: {
        plugins: [i18n],
      },
    })

    const clearBtn = wrapper.find('button')
    await clearBtn.trigger('click')

    expect(wrapper.emitted('clear')).toBeTruthy()
  })
})
