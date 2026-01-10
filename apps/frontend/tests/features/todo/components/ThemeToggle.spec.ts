import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ThemeToggle from '@/features/todo/components/ThemeToggle.vue'
import { useTheme } from '@/composables/useTheme'
import { ref } from 'vue'

// Mock useTheme
vi.mock('@/composables/useTheme', () => ({
  useTheme: vi.fn(),
}))

// Mock vue-i18n
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

describe('ThemeToggle', () => {
  it('should cycle through themes when clicked', async () => {
    const theme = ref('light')
    const setTheme = vi.fn((val) => {
      theme.value = val
    })

    ;(useTheme as any).mockReturnValue({
      theme,
      setTheme,
    })

    const wrapper = mount(ThemeToggle)

    // Initial state: light
    await wrapper.trigger('click')
    expect(setTheme).toHaveBeenCalledWith('dark')

    // Change theme to dark
    theme.value = 'dark'
    await wrapper.trigger('click')
    expect(setTheme).toHaveBeenCalledWith('auto')

    // Change theme to auto
    theme.value = 'auto'
    await wrapper.trigger('click')
    expect(setTheme).toHaveBeenCalledWith('light')
  })
})
