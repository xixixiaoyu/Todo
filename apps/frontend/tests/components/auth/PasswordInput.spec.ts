import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import PasswordInput from '@/components/auth/PasswordInput.vue'

// Mock vue-i18n
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        'password.show': '显示密码',
        'password.hide': '隐藏密码',
        'password.strength.label': '强度',
        'password.strength.weak': '弱',
        'password.strength.medium': '中',
        'password.strength.strong': '强',
        'validation.MIN_LENGTH': '{property} 至少需要 {min} 个字符',
        'common.fields.password': '密码',
      }
      let text = translations[key] || key
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          text = text.replace(`{${k}}`, String(v))
        })
      }
      return text
    },
  }),
}))

describe('PasswordInput', () => {
  it('should render label', () => {
    const wrapper = mount(PasswordInput, {
      props: {
        modelValue: '',
        label: 'Password',
      },
    })

    expect(wrapper.text()).toContain('Password')
  })

  it('should render password input field', () => {
    const wrapper = mount(PasswordInput, {
      props: {
        modelValue: '',
        label: 'Password',
      },
    })

    const input = wrapper.find('input')
    expect(input.exists()).toBe(true)
    expect(input.attributes('type')).toBe('password')
  })

  it('should toggle password visibility when eye button clicked', async () => {
    const wrapper = mount(PasswordInput, {
      props: {
        modelValue: '',
        label: 'Password',
      },
    })

    const input = wrapper.find('input')
    const toggleButton = wrapper.find('button')

    expect(input.attributes('type')).toBe('password')

    await toggleButton.trigger('click')

    expect(input.attributes('type')).toBe('text')

    await toggleButton.trigger('click')

    expect(input.attributes('type')).toBe('password')
  })

  it('should emit update:modelValue when input changes', async () => {
    const wrapper = mount(PasswordInput, {
      props: {
        modelValue: '',
        label: 'Password',
      },
    })

    const input = wrapper.find('input')
    await input.setValue('password123')

    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['password123'])
  })

  it('should display error message when error prop is provided', () => {
    const wrapper = mount(PasswordInput, {
      props: {
        modelValue: '',
        label: 'Password',
        error: 'Password is too short',
      },
    })

    expect(wrapper.text()).toContain('Password is too short')
  })

  it('should apply error styles when error prop is provided', () => {
    const wrapper = mount(PasswordInput, {
      props: {
        modelValue: '',
        label: 'Password',
        error: 'Invalid password',
      },
    })

    const input = wrapper.find('input')
    expect(input.classes()).toContain('border-error/50')
  })

  it('should translate validation key with params when name is provided', () => {
    const wrapper = mount(PasswordInput, {
      props: {
        modelValue: '',
        label: 'Password',
        name: 'password',
        error: 'validation.MIN_LENGTH',
      },
    })

    expect(wrapper.text()).toContain('密码 至少需要 6 个字符')
  })

  it('should be disabled when disabled prop is true', () => {
    const wrapper = mount(PasswordInput, {
      props: {
        modelValue: '',
        label: 'Password',
        disabled: true,
      },
    })

    const input = wrapper.find('input')
    expect(input.attributes('disabled')).toBeDefined()
    expect(input.classes()).toContain('disabled:opacity-50')
  })

  it('should display placeholder when provided', () => {
    const wrapper = mount(PasswordInput, {
      props: {
        modelValue: '',
        label: 'Password',
        placeholder: 'Enter your password',
      },
    })

    const input = wrapper.find('input')
    expect(input.attributes('placeholder')).toBe('Enter your password')
  })
})
