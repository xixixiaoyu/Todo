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
        inputPlaceholder: '添加新的待办事项，或粘贴图片进行分析...',
        inputPlaceholderNoAI: '添加新的待办事项，或粘贴图片分析（需配置 AI）...',
        add: '添加',
        duplicate: '已存在相同的待办事项',
      },
    },
  },
})

describe('TodoInput', () => {
  const defaultProps = {
    modelValue: '',
    showTooltip: false,
    errorMessage: '',
  }

  it('should render input field', () => {
    const wrapper = mount(TodoInput, {
      props: defaultProps,
      global: {
        plugins: [i18n],
      },
    })

    const input = wrapper.find('input[type="text"]')
    expect(input.exists()).toBe(true)
  })

  it('should render add button', () => {
    const wrapper = mount(TodoInput, {
      props: defaultProps,
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
      props: defaultProps,
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
        ...defaultProps,
        modelValue: 'New todo',
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
      props: defaultProps,
      global: {
        plugins: [i18n],
      },
    })

    const input = wrapper.find('input[type="text"]')
    await input.trigger('keydown', { key: 'Enter' })

    expect(wrapper.emitted('keydown')).toBeTruthy()
  })

  it('should apply destructive border when errorMessage is present', () => {
    const wrapper = mount(TodoInput, {
      props: {
        ...defaultProps,
        errorMessage: 'error',
      },
      global: {
        plugins: [i18n],
      },
    })

    const input = wrapper.find('input')
    expect(input.classes()).toContain('border-destructive')
  })

  it('should not apply destructive border when errorMessage is empty', () => {
    const wrapper = mount(TodoInput, {
      props: {
        ...defaultProps,
        errorMessage: '',
      },
      global: {
        plugins: [i18n],
      },
    })

    const input = wrapper.find('input')
    expect(input.classes()).not.toContain('border-destructive')
  })

  it('should show tooltip when showTooltip is true', () => {
    // Tooltip content is often teleported or conditionally rendered by shadcn components.
    // In a unit test without proper setup for tooltips, we can check if the Tooltip component
    // is present and has the correct open prop.
    const wrapper = mount(TodoInput, {
      props: {
        ...defaultProps,
        showTooltip: true,
        errorMessage: 'todo.duplicate',
      },
      global: {
        plugins: [i18n],
        stubs: {
          Tooltip: {
            template: '<div class="tooltip-stub" :data-open="open"><slot /></div>',
            props: ['open'],
          },
          TooltipContent: {
            template: '<div class="tooltip-content-stub"><slot /></div>',
          },
          TooltipProvider: {
            template: '<div><slot /></div>',
          },
          TooltipTrigger: {
            template: '<div><slot /></div>',
          },
        },
      },
    })

    const tooltip = wrapper.find('.tooltip-stub')
    expect(tooltip.exists()).toBe(true)
    expect(tooltip.attributes('data-open')).toBe('true')
    expect(wrapper.find('.tooltip-content-stub').text()).toBe('已存在相同的待办事项')
  })

  it('should not show tooltip when showTooltip is false', () => {
    const wrapper = mount(TodoInput, {
      props: {
        ...defaultProps,
        showTooltip: false,
      },
      global: {
        plugins: [i18n],
        stubs: {
          Tooltip: {
            template: '<div class="tooltip-stub" :data-open="open"><slot /></div>',
            props: ['open'],
          },
          TooltipContent: {
            template: '<div class="tooltip-content-stub"><slot /></div>',
          },
          TooltipProvider: {
            template: '<div><slot /></div>',
          },
          TooltipTrigger: {
            template: '<div><slot /></div>',
          },
        },
      },
    })

    const tooltip = wrapper.find('.tooltip-stub')
    expect(tooltip.attributes('data-open')).toBe('false')
  })

  it('should display current modelValue in input', () => {
    const wrapper = mount(TodoInput, {
      props: {
        ...defaultProps,
        modelValue: 'Test todo',
      },
      global: {
        plugins: [i18n],
      },
    })

    const input = wrapper.find('input[type="text"]')
    expect((input.element as HTMLInputElement).value).toBe('Test todo')
  })

  it('should have correct placeholder', () => {
    const wrapper = mount(TodoInput, {
      props: defaultProps,
      global: {
        plugins: [i18n],
      },
    })

    const input = wrapper.find('input[type="text"]')
    expect(input.attributes('placeholder')).toBe('添加新的待办事项，或粘贴图片分析（需配置 AI）...')
  })
})
