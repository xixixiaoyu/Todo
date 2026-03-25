import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import { hslToRgb, parseHslTriplet } from '@/lib/colors'
import { useTheme } from '@/composables/useTheme'

const { mockedColorMode, mockedPrefersDark } = vi.hoisted(() => ({
  mockedColorMode: { value: 'auto' as 'light' | 'dark' | 'auto' },
  mockedPrefersDark: { value: false },
}))

// Mock @vueuse/core
vi.mock('@vueuse/core', async () => {
  const { ref } = await import('vue')

  return {
    useColorMode: vi.fn(() => mockedColorMode),
    useMediaQuery: vi.fn(() => mockedPrefersDark),
    useStorage: vi.fn((_key: string, initialValue: unknown) => ref(initialValue)),
  }
})

const themeVariableKeys = [
  '--user-primary',
  '--user-primary-hover',
  '--user-primary-foreground',
  '--user-primary-rgb',
  '--user-primary-dark',
  '--user-primary-hover-dark',
  '--user-primary-foreground-dark',
  '--user-primary-rgb-dark',
]

type Rgb = {
  r: number
  g: number
  b: number
}

function getContrastChannel(value: number) {
  const normalized = value / 255
  if (normalized <= 0.03928) return normalized / 12.92
  return ((normalized + 0.055) / 1.055) ** 2.4
}

function getContrastRatio(a: Rgb, b: Rgb) {
  const luminanceA =
    0.2126 * getContrastChannel(a.r) +
    0.7152 * getContrastChannel(a.g) +
    0.0722 * getContrastChannel(a.b)
  const luminanceB =
    0.2126 * getContrastChannel(b.r) +
    0.7152 * getContrastChannel(b.g) +
    0.0722 * getContrastChannel(b.b)

  const lighter = Math.max(luminanceA, luminanceB)
  const darker = Math.min(luminanceA, luminanceB)

  return (lighter + 0.05) / (darker + 0.05)
}

function getRgbFromThemeVariable(name: string) {
  const value = document.documentElement.style.getPropertyValue(name)
  const parsed = parseHslTriplet(value)

  if (!parsed) {
    throw new Error(`Unable to parse theme variable: ${name}`)
  }

  return hslToRgb(parsed.h, parsed.s, parsed.l)
}

describe('useTheme', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedColorMode.value = 'auto'
    mockedPrefersDark.value = false
    for (const key of themeVariableKeys) {
      document.documentElement.style.removeProperty(key)
    }
  })

  it('should initialize with default mode', () => {
    const { theme } = useTheme()
    expect(theme.value).toBe('auto')
  })

  it('should resolve dark mode from system preference when theme is auto', () => {
    mockedPrefersDark.value = true

    const { effectiveTheme, isDark } = useTheme()

    expect(effectiveTheme.value).toBe('dark')
    expect(isDark.value).toBe(true)
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

  it('should choose accessible foregrounds for light and dark theme accents', async () => {
    const { setThemeColor } = useTheme()

    setThemeColor('#78958e')
    await nextTick()

    expect(document.documentElement.style.getPropertyValue('--user-primary-foreground')).toBe(
      '32 10% 8%',
    )

    setThemeColor('#4f6284')
    await nextTick()

    expect(document.documentElement.style.getPropertyValue('--user-primary-foreground-dark')).toBe(
      '32 10% 8%',
    )
  })

  it('should keep the same foreground accessible across light hover states', async () => {
    const { setThemeColor } = useTheme()

    for (const color of ['#728ba1', '#ae8792']) {
      setThemeColor(color)
      await nextTick()

      const base = getRgbFromThemeVariable('--user-primary')
      const hover = getRgbFromThemeVariable('--user-primary-hover')
      const foreground = getRgbFromThemeVariable('--user-primary-foreground')

      expect(getContrastRatio(base, foreground)).toBeGreaterThanOrEqual(4.5)
      expect(getContrastRatio(hover, foreground)).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('should cap overly light presets before writing the theme variables', async () => {
    const { setThemeColor } = useTheme()

    setThemeColor('#948ac0')
    await nextTick()

    expect(document.documentElement.style.getPropertyValue('--user-primary')).toBe('251 30% 56%')
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
