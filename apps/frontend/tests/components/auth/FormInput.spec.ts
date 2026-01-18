import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import FormInput from '@/components/auth/FormInput.vue'

// Mock vue-i18n
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

describe('FormInput', () => {
  it('should render label', () => {
    const wrapper = mount(FormInput, {
      props: {
        modelValue: '',
        label: 'Email',
      },
    })

    expect(wrapper.text()).toContain('Email')
  })

  it('should render input field', () => {
    const wrapper = mount(FormInput, {
      props: {
        modelValue: '',
        label: 'Email',
      },
    })

    const input = wrapper.find('input')
    expect(input.exists()).toBe(true)
  })

  it('should have default type as text', () => {
    const wrapper = mount(FormInput, {
      props: {
        modelValue: '',
        label: 'Name',
      },
    })

    const input = wrapper.find('input')
    expect(input.attributes('type')).toBe('text')
  })

  it('should have email type when specified', () => {
    const wrapper = mount(FormInput, {
      props: {
        modelValue: '',
        label: 'Email',
        type: 'email',
      },
    })

    const input = wrapper.find('input')
    expect(input.attributes('type')).toBe('email')
  })

  it('should have password type when specified', () => {
    const wrapper = mount(FormInput, {
      props: {
        modelValue: '',
        label: 'Password',
        type: 'password',
      },
    })

    const input = wrapper.find('input')
    expect(input.attributes('type')).toBe('password')
  })

  it('should display placeholder when provided', () => {
    const wrapper = mount(FormInput, {
      props: {
        modelValue: '',
        label: 'Email',
        placeholder: 'Enter your email',
      },
    })

    const input = wrapper.find('input')
    expect(input.attributes('placeholder')).toBe('Enter your email')
  })

  it('should emit update:modelValue when input changes', async () => {
    const wrapper = mount(FormInput, {
      props: {
        modelValue: '',
        label: 'Email',
      },
    })

    const input = wrapper.find('input')
    await input.setValue('test@example.com')

    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['test@example.com'])
  })

  it('should display error message when error prop is provided', () => {
    const wrapper = mount(FormInput, {
      props: {
        modelValue: '',
        label: 'Email',
        error: 'Invalid email format',
      },
    })

    expect(wrapper.text()).toContain('Invalid email format')
  })

  it('should apply error styles when error prop is provided', () => {
    const wrapper = mount(FormInput, {
      props: {
        modelValue: '',
        label: 'Email',
        error: 'Invalid email',
      },
    })

    const input = wrapper.find('input')
    expect(input.classes()).toContain('border-error')
  })

  it('should not apply error styles when error prop is not provided', () => {
    const wrapper = mount(FormInput, {
      props: {
        modelValue: '',
        label: 'Email',
      },
    })

    const input = wrapper.find('input')
    expect(input.classes()).toContain('border-border')
  })

  it('should be disabled when disabled prop is true', () => {
    const wrapper = mount(FormInput, {
      props: {
        modelValue: '',
        label: 'Email',
        disabled: true,
      },
    })

    const input = wrapper.find('input')
    expect(input.attributes('disabled')).toBeDefined()
    expect(input.classes()).toContain('disabled:opacity-50')
  })

  it('should not be disabled when disabled prop is false', () => {
    const wrapper = mount(FormInput, {
      props: {
        modelValue: '',
        label: 'Email',
        disabled: false,
      },
    })

    const input = wrapper.find('input')
    expect(input.attributes('disabled')).toBeUndefined()
  })
})
