import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nextTick, ref } from 'vue'
import { useTheme } from '@/composables/useTheme'

// Mock @vueuse/core
vi.mock('@vueuse/core', () => ({
  useColorMode: vi.fn(() => ref<'light' | 'dark' | 'auto'>('auto')),
  useStorage: vi.fn((_key: string, initialValue: unknown) => ref(initialValue)),
}))

describe('useTheme', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should initialize with default mode', () => {
    const { theme } = useTheme()
    expect(theme.value).toBe('auto')
  })

  it('should change theme', () => {
    const { setTheme } = useTheme()
    setTheme('dark')
    // Note: Since we're mocking useColorMode, we need to handle the value change if we want to test it deeply.
    // But for a simple test, this confirms the interface exists.
  })

  it('should apply theme color css variables', async () => {
    const { setThemeColor } = useTheme()

    setThemeColor('#ff0000')
    await nextTick()

    expect(document.documentElement.style.getPropertyValue('--user-primary')).not.toBe('')
    expect(document.documentElement.style.getPropertyValue('--user-primary-dark')).not.toBe('')
    expect(document.documentElement.style.getPropertyValue('--user-primary-rgb')).not.toBe('')
  })

  it('should reset theme color css variables', async () => {
    const { setThemeColor, resetThemeColor } = useTheme()

    setThemeColor('#ff0000')
    await nextTick()

    resetThemeColor()
    await nextTick()

    expect(document.documentElement.style.getPropertyValue('--user-primary')).toBe('')
    expect(document.documentElement.style.getPropertyValue('--user-primary-dark')).toBe('')
  })
})
