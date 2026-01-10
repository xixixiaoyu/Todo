import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import TodoInput from '@/features/todo/components/TodoInput.vue'

// Mock vue-i18n
const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  messages: {
    'zh-CN': {
      todo: {
        inputPlaceholder: '添加新的待办事项...',
        add: '添加',
        duplicate: '已存在相同的待办事项',
      },
    },
  },
})

describe('TodoInput', () => {
  it('should render input field', () => {
    const wrapper = mount(TodoInput, {
      props: {
        modelValue: '',
        isShaking: false,
        showTooltip: false,
      },
      global: {
        plugins: [i18n],
      },
    })

    const input = wrapper.find('input[type="text"]')
    expect(input.exists()).toBe(true)
  })

  it('should render add button', () => {
    const wrapper = mount(TodoInput, {
      props: {
        modelValue: '',
        isShaking: false,
        showTooltip: false,
      },
      global: {
        plugins: [i18n],
      },
    })

    const button = wrapper.find('button')
    expect(button.exists()).toBe(true)
    expect(button.text()).toBe('添加')
  })

  it('should emit update:modelValue when input changes', async () => {
    const wrapper = mount(TodoInput, {
      props: {
        modelValue: '',
        isShaking: false,
        showTooltip: false,
      },
      global: {
        plugins: [i18n],
      },
    })

    const input = wrapper.find('input[type="text"]')
    await input.setValue('New todo')

    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['New todo'])
  })

  it('should emit add event when button clicked', async () => {
    const wrapper = mount(TodoInput, {
      props: {
        modelValue: 'New todo',
        isShaking: false,
        showTooltip: false,
      },
      global: {
        plugins: [i18n],
      },
    })

    const button = wrapper.find('button')
    await button.trigger('click')

    expect(wrapper.emitted('add')).toBeTruthy()
  })

  it('should emit keydown event when keydown occurs', async () => {
    const wrapper = mount(TodoInput, {
      props: {
        modelValue: '',
        isShaking: false,
        showTooltip: false,
      },
      global: {
        plugins: [i18n],
      },
    })

    const input = wrapper.find('input[type="text"]')
    await input.trigger('keydown', { key: 'Enter' })

    expect(wrapper.emitted('keydown')).toBeTruthy()
  })

  it('should apply shaking class when isShaking is true', () => {
    const wrapper = mount(TodoInput, {
      props: {
        modelValue: '',
        isShaking: true,
        showTooltip: false,
      },
      global: {
        plugins: [i18n],
      },
    })

    // The shaking class is applied to the input container div (third div)
    const container = wrapper.findAll('div')[2]
    expect(container.classes()).toContain('border-[#d97757]')
    expect(container.classes()).toContain('animate-shake')
  })

  it('should not apply shaking class when isShaking is false', () => {
    const wrapper = mount(TodoInput, {
      props: {
        modelValue: '',
        isShaking: false,
        showTooltip: false,
      },
      global: {
        plugins: [i18n],
      },
    })

    // The shaking class is applied to the input container div (third div)
    const container = wrapper.findAll('div')[2]
    expect(container.classes()).not.toContain('border-[#d97757]')
    expect(container.classes()).not.toContain('animate-shake')
  })

  it('should show tooltip when showTooltip is true', () => {
    const wrapper = mount(TodoInput, {
      props: {
        modelValue: '',
        isShaking: false,
        showTooltip: true,
      },
      global: {
        plugins: [i18n],
      },
    })

    const tooltip = wrapper.find('.absolute')
    expect(tooltip.exists()).toBe(true)
    expect(tooltip.text()).toBe('已存在相同的待办事项')
  })

  it('should not show tooltip when showTooltip is false', () => {
    const wrapper = mount(TodoInput, {
      props: {
        modelValue: '',
        isShaking: false,
        showTooltip: false,
      },
      global: {
        plugins: [i18n],
      },
    })

    const tooltip = wrapper.find('.absolute')
    expect(tooltip.exists()).toBe(false)
  })

  it('should display current modelValue in input', () => {
    const wrapper = mount(TodoInput, {
      props: {
        modelValue: 'Test todo',
        isShaking: false,
        showTooltip: false,
      },
      global: {
        plugins: [i18n],
      },
    })

    const input = wrapper.find('input[type="text"]')
    expect(input.attributes('value')).toBe('Test todo')
  })

  it('should have correct placeholder', () => {
    const wrapper = mount(TodoInput, {
      props: {
        modelValue: '',
        isShaking: false,
        showTooltip: false,
      },
      global: {
        plugins: [i18n],
      },
    })

    const input = wrapper.find('input[type="text"]')
    expect(input.attributes('placeholder')).toBe('添加新的待办事项...')
  })
})
