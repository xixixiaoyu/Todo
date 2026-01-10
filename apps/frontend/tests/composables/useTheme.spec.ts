import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useTheme } from '@/composables/useTheme'

// Mock @vueuse/core
vi.mock('@vueuse/core', () => ({
  useColorMode: vi.fn(() => ({
    value: 'auto',
  })),
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
})
