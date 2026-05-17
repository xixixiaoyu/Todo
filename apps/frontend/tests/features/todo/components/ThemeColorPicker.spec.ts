import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import ThemeColorPicker from '@/features/todo/components/ThemeColorPicker.vue'
import { useTheme } from '@/composables/useTheme'

vi.mock('@/composables/useTheme', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/composables/useTheme')>()

  return {
    ...actual,
    useTheme: vi.fn(),
  }
})

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'common.themeColor.label': '主题色',
        'common.themeColor.desc': '选择喜欢的主题色',
        'common.themeColor.reset': '重置主题色',
        'common.themeColor.custom': '自定义',
        'common.themeColor.recommended': '推荐',
        'common.themeColor.recommendedShort': '优选',
        'common.themeColor.presets.celadon': '青瓷',
        'common.themeColor.presets.mistBlue': '薄雾',
        'common.themeColor.presets.lilacGray': '丁香',
        'common.themeColor.presets.autumnGold': '秋叶',
        'common.themeColor.presets.warmOrange': '暖橙',
        'common.themeColor.presets.random': '随机',
      }

      return translations[key] ?? key
    },
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

describe('ThemeColorPicker', () => {
  it('should place lilacGray preset with correct hex', () => {
    const mockedUseTheme = vi.mocked(useTheme)

    mockedUseTheme.mockReturnValue(createUseThemeMock())

    const wrapper = mount(ThemeColorPicker, {
      global: {
        stubs: {
          Tooltip: { template: '<div><slot /></div>' },
          TooltipTrigger: { template: '<div><slot /></div>' },
          TooltipContent: { template: '<div><slot /></div>' },
          Popover: { template: '<div><slot /></div>' },
          PopoverTrigger: { template: '<div><slot /></div>' },
          PopoverContent: { template: '<div><slot /></div>' },
        },
      },
    })

    const presetButtons = wrapper.findAll('button[title]')
    const lilacButton = presetButtons.find((btn) => btn.attributes('title') === '丁香')
    expect(lilacButton?.exists()).toBe(true)

    const lilacDot = lilacButton?.find('span[style]')
    expect(lilacDot?.attributes('style')).toContain('#786ea6')
  })

  it('should mark audited presets as recommended', () => {
    const mockedUseTheme = vi.mocked(useTheme)

    mockedUseTheme.mockReturnValue(createUseThemeMock())

    const wrapper = mount(ThemeColorPicker, {
      global: {
        stubs: {
          Tooltip: { template: '<div><slot /></div>' },
          TooltipTrigger: { template: '<div><slot /></div>' },
          TooltipContent: { template: '<div><slot /></div>' },
          Popover: { template: '<div><slot /></div>' },
          PopoverTrigger: { template: '<div><slot /></div>' },
          PopoverContent: { template: '<div><slot /></div>' },
        },
      },
    })

    expect(wrapper.findAll('[data-recommended="true"]')).toHaveLength(5)
    expect(wrapper.find('button[title="青瓷"] [data-recommended="true"]').text()).toBe('优选')
    expect(wrapper.html()).toContain('grid-cols-2')
    expect(wrapper.html()).toContain('sm:grid-cols-3')
    expect(wrapper.html()).toContain('absolute right-2.5 top-1.5')
    expect(wrapper.find('button[title="随机"] [data-recommended="true"]').exists()).toBe(false)
  })

  it('should include autumnGold and warmOrange as recommended warm tones', () => {
    const mockedUseTheme = vi.mocked(useTheme)

    mockedUseTheme.mockReturnValue(createUseThemeMock())

    const wrapper = mount(ThemeColorPicker, {
      global: {
        stubs: {
          Tooltip: { template: '<div><slot /></div>' },
          TooltipTrigger: { template: '<div><slot /></div>' },
          TooltipContent: { template: '<div><slot /></div>' },
          Popover: { template: '<div><slot /></div>' },
          PopoverTrigger: { template: '<div><slot /></div>' },
          PopoverContent: { template: '<div><slot /></div>' },
        },
      },
    })

    const autumnButton = wrapper.find('button[title="秋叶"]')
    expect(autumnButton.exists()).toBe(true)
    expect(autumnButton.find('[data-recommended="true"]').exists()).toBe(true)
    expect(autumnButton.find('span[style]').attributes('style')).toContain('#b0915e')

    const orangeButton = wrapper.find('button[title="暖橙"]')
    expect(orangeButton.exists()).toBe(true)
    expect(orangeButton.find('[data-recommended="true"]').exists()).toBe(true)
    expect(orangeButton.find('span[style]').attributes('style')).toContain('#bb7d5e')
  })

  it('should reflect the effective random theme color in the custom color input', async () => {
    const mockedUseTheme = vi.mocked(useTheme)
    const effectiveThemeColor = ref<string | null>('#728ba1')

    mockedUseTheme.mockReturnValue(
      createUseThemeMock({
        themeColor: ref<string | null>('random') as unknown as UseThemeResult['themeColor'],
        effectiveThemeColor:
          effectiveThemeColor as unknown as UseThemeResult['effectiveThemeColor'],
      }),
    )

    const wrapper = mount(ThemeColorPicker, {
      global: {
        stubs: {
          Tooltip: { template: '<div><slot /></div>' },
          TooltipTrigger: { template: '<div><slot /></div>' },
          TooltipContent: { template: '<div><slot /></div>' },
          Popover: { template: '<div><slot /></div>' },
          PopoverTrigger: { template: '<div><slot /></div>' },
          PopoverContent: { template: '<div><slot /></div>' },
        },
      },
    })

    const colorInput = wrapper.get('input[type="color"]')
    expect((colorInput.element as HTMLInputElement).value).toBe('#728ba1')

    effectiveThemeColor.value = '#4f6284'
    await nextTick()

    expect((colorInput.element as HTMLInputElement).value).toBe('#4f6284')
  })
})
