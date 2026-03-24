import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import ThemeColorPicker from '@/features/todo/components/ThemeColorPicker.vue'
import { useTheme } from '@/composables/useTheme'

vi.mock('@/composables/useTheme', () => ({
  useTheme: vi.fn(),
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'common.themeColor.label': '主题色',
        'common.themeColor.desc': '选择喜欢的主题色',
        'common.themeColor.reset': '重置主题色',
        'common.themeColor.custom': '自定义',
        'common.themeColor.presets.celadon': '青瓷',
        'common.themeColor.presets.twilightAmber': '暮色',
        'common.themeColor.presets.mistBlue': '薄雾',
        'common.themeColor.presets.mossGreen': '苔青',
        'common.themeColor.presets.lilacGray': '丁香',
        'common.themeColor.presets.sunsetRose': '晚霞',
        'common.themeColor.presets.graphite': '石墨',
        'common.themeColor.presets.indigo': '靛青',
        'common.themeColor.presets.random': '随机',
      }

      return translations[key] ?? key
    },
  }),
}))

describe('ThemeColorPicker', () => {
  it('should place lilac in the middle with the updated hex', () => {
    const mockedUseTheme = vi.mocked(useTheme)
    mockedUseTheme.mockReturnValue({
      theme: ref<'light' | 'dark' | 'auto'>('auto') as unknown as ReturnType<
        typeof useTheme
      >['theme'],
      setTheme: vi.fn(),
      themeColor: ref<string | null>(null) as unknown as ReturnType<typeof useTheme>['themeColor'],
      setThemeColor: vi.fn(),
      resetThemeColor: vi.fn(),
    })

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
    expect(presetButtons[4]?.attributes('title')).toBe('丁香')

    const lilacDot = presetButtons[4]?.find('span[style]')
    expect(lilacDot?.attributes('style')).toContain('#8e81c0')
  })
})
