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

  const normalized = trimmed.startsWith('#') ? trimmed : `#${trimmed}`
  if (!/^#[0-9a-fA-F]{6}$/.test(normalized)) return null
  return normalized.toLowerCase()
}

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
  const s = clamp(baseHsl.s, 25, 85)
  const lightL = clamp(baseHsl.l, 28, 55)
  const darkL = clamp(lightL + 20, 55, 78)

  const lightHoverL = clamp(lightL - 5, 20, 60)
  const darkHoverL = clamp(darkL + 5, 55, 85)

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

  watch(
    themeColor,
    (hex) => {
      applyThemeColor(hex)
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
      themeColor.value = normalized
    },
    resetThemeColor: () => {
      themeColor.value = null
    },
  }
}
