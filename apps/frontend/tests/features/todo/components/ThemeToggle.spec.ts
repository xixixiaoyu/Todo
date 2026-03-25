import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ThemeToggle from '@/features/todo/components/ThemeToggle.vue'
import { useTheme } from '@/composables/useTheme'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ref, h } from 'vue'

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

type UseThemeResult = ReturnType<typeof useTheme>

function createUseThemeMock(overrides: Partial<UseThemeResult> = {}): UseThemeResult {
  return {
    theme: ref<'light' | 'dark' | 'auto'>('auto') as unknown as UseThemeResult['theme'],
    effectiveTheme: ref<'light' | 'dark'>('light') as unknown as UseThemeResult['effectiveTheme'],
    isDark: ref(false) as unknown as UseThemeResult['isDark'],
    setTheme: vi.fn(),
    themeColor: ref<string | null>(null) as unknown as UseThemeResult['themeColor'],
    effectiveThemeColor: ref<string | null>(
      null,
    ) as unknown as UseThemeResult['effectiveThemeColor'],
    setThemeColor: vi.fn(),
    resetThemeColor: vi.fn(),
    ...overrides,
  } as unknown as UseThemeResult
}

describe('ThemeToggle', () => {
  it('should cycle through themes when clicked', async () => {
    const theme = ref<'light' | 'dark' | 'auto'>('light')
    const setTheme = vi.fn((val: 'light' | 'dark' | 'auto') => {
      theme.value = val
    })

    const mockedUseTheme = vi.mocked(useTheme)
    mockedUseTheme.mockReturnValue(
      createUseThemeMock({
        theme: theme as unknown as UseThemeResult['theme'],
        setTheme,
      }),
    )

    const wrapper = mount({
      setup() {
        return () =>
          h(TooltipProvider, null, {
            default: () => h(ThemeToggle),
          })
      },
    })

    // Initial state: light
    await wrapper.find('button').trigger('click')
    expect(setTheme).toHaveBeenCalledWith('dark')

    // Change theme to dark
    theme.value = 'dark'
    await wrapper.find('button').trigger('click')
    expect(setTheme).toHaveBeenCalledWith('auto')

    // Change theme to auto
    theme.value = 'auto'
    await wrapper.find('button').trigger('click')
    expect(setTheme).toHaveBeenCalledWith('light')
  })
})
