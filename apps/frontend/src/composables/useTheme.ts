import { useColorMode, useStorage } from '@vueuse/core'
import { watch } from 'vue'

type Hsl = {
  h: number
  s: number
  l: number
}

type Rgb = {
  r: number
  g: number
  b: number
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function normalizeHex(hex: string) {
  const trimmed = hex.trim()
  if (!trimmed) return null
  if (trimmed === 'random') return 'random'

  const normalized = trimmed.startsWith('#') ? trimmed : `#${trimmed}`
  if (!/^#[0-9a-fA-F]{6}$/.test(normalized)) return null
  return normalized.toLowerCase()
}

const PRESET_COLORS = [
  '#78958e', // 青瓷 (Celadon) - 更经典耐看的低饱和青瓷
  '#9b8574', // 暮色 (Twilight Amber) - 低饱和暖棕
  '#728ba1', // 薄雾 (Mist Blue) - 平衡冷暖的灰蓝
  '#7c9585', // 苔青 (Moss Green) - 稳定的自然绿
  '#ae8792', // 晚霞 (Sunset Rose) - 克制的玫瑰灰粉
  '#918aa1', // 丁香 (Lilac Gray) - 温柔的紫灰
  '#647587', // 石墨 (Graphite) - 柔化后的深灰蓝
  '#4f6284', // 靛青 (Indigo) - 沉静的夜蓝
]

let randomTimer: ReturnType<typeof setTimeout> | null = null

function hexToRgb(hex: string): Rgb {
  const normalized = normalizeHex(hex)
  if (!normalized) {
    return { r: 0, g: 0, b: 0 }
  }

  const value = normalized.slice(1)
  const r = Number.parseInt(value.slice(0, 2), 16)
  const g = Number.parseInt(value.slice(2, 4), 16)
  const b = Number.parseInt(value.slice(4, 6), 16)

  return { r, g, b }
}

function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rr = r / 255
  const gg = g / 255
  const bb = b / 255

  const max = Math.max(rr, gg, bb)
  const min = Math.min(rr, gg, bb)
  const delta = max - min

  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1))

    if (max === rr) {
      h = ((gg - bb) / delta) % 6
    } else if (max === gg) {
      h = (bb - rr) / delta + 2
    } else {
      h = (rr - gg) / delta + 4
    }

    h *= 60
    if (h < 0) h += 360
  }

  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  }
}

function hslToRgb({ h, s, l }: Hsl): Rgb {
  const hh = ((h % 360) + 360) % 360
  const ss = clamp(s, 0, 100) / 100
  const ll = clamp(l, 0, 100) / 100

  const c = (1 - Math.abs(2 * ll - 1)) * ss
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1))
  const m = ll - c / 2

  let r1 = 0
  let g1 = 0
  let b1 = 0

  if (hh < 60) {
    r1 = c
    g1 = x
  } else if (hh < 120) {
    r1 = x
    g1 = c
  } else if (hh < 180) {
    g1 = c
    b1 = x
  } else if (hh < 240) {
    g1 = x
    b1 = c
  } else if (hh < 300) {
    r1 = x
    b1 = c
  } else {
    r1 = c
    b1 = x
  }

  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  }
}

function applyThemeColor(hex: string | null) {
  if (typeof document === 'undefined') return

  const root = document.documentElement
  if (hex === 'random') {
    // 随机模式下，如果不手动调用，这里不直接处理
    // 逻辑由 useTheme 里的 watch 处理
    return
  }

  const normalized = hex ? normalizeHex(hex) : null

  const keys = [
    '--user-primary',
    '--user-primary-hover',
    '--user-primary-foreground',
    '--user-primary-rgb',
    '--user-primary-dark',
    '--user-primary-hover-dark',
    '--user-primary-foreground-dark',
    '--user-primary-rgb-dark',
  ]

  if (!normalized) {
    for (const key of keys) root.style.removeProperty(key)
    return
  }

  const baseRgb = hexToRgb(normalized)
  const baseHsl = rgbToHsl(baseRgb)

  const h = baseHsl.h
  const s = clamp(baseHsl.s, 18, 55)
  const lightL = clamp(baseHsl.l, 38, 58)
  const darkL = clamp(lightL + 18, 56, 74)

  const lightHoverL = clamp(lightL - 6, 22, 56)
  const darkHoverL = clamp(darkL + 5, 58, 78)

  const lightRgb = hslToRgb({ h, s, l: lightL })
  const darkRgb = hslToRgb({ h, s, l: darkL })

  const lightForeground = '0 0% 100%'
  const darkForeground = darkL >= 60 ? '32 10% 8%' : '0 0% 100%'

  root.style.setProperty('--user-primary', `${h} ${s}% ${lightL}%`)
  root.style.setProperty('--user-primary-hover', `${h} ${s}% ${lightHoverL}%`)
  root.style.setProperty('--user-primary-foreground', lightForeground)
  root.style.setProperty('--user-primary-rgb', `${lightRgb.r}, ${lightRgb.g}, ${lightRgb.b}`)

  root.style.setProperty('--user-primary-dark', `${h} ${s}% ${darkL}%`)
  root.style.setProperty('--user-primary-hover-dark', `${h} ${s}% ${darkHoverL}%`)
  root.style.setProperty('--user-primary-foreground-dark', darkForeground)
  root.style.setProperty('--user-primary-rgb-dark', `${darkRgb.r}, ${darkRgb.g}, ${darkRgb.b}`)
}

export function useTheme() {
  const mode = useColorMode({
    attribute: 'class',
    emitAuto: true,
    modes: {
      light: '',
      dark: 'dark',
    },
  })

  const themeColor = useStorage<string | null>('theme-color', null)

  const applyRandomColor = () => {
    if (themeColor.value !== 'random') return

    const randomIndex = Math.floor(Math.random() * PRESET_COLORS.length)
    applyThemeColor(PRESET_COLORS[randomIndex])

    // 随机时间切换：30-60 分钟，减少对专注的干扰
    const nextTime = Math.floor(Math.random() * (60 - 30 + 1) + 30) * 60 * 1000
    if (randomTimer) clearTimeout(randomTimer)
    randomTimer = setTimeout(applyRandomColor, nextTime)
  }

  watch(
    themeColor,
    (hex) => {
      if (hex === 'random') {
        applyRandomColor()
      } else {
        if (randomTimer) {
          clearTimeout(randomTimer)
          randomTimer = null
        }
        applyThemeColor(hex)
      }
    },
    { immediate: true },
  )

  return {
    theme: mode,
    setTheme: (newTheme: 'light' | 'dark' | 'auto') => {
      mode.value = newTheme
    },
    themeColor,
    setThemeColor: (hex: string) => {
      const normalized = normalizeHex(hex)
      if (!normalized) return
      if (normalized === 'random' && themeColor.value === 'random') {
        applyRandomColor()
      } else {
        themeColor.value = normalized
      }
    },
    resetThemeColor: () => {
      themeColor.value = null
    },
  }
}
