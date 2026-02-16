export type Rgb = {
  r: number
  g: number
  b: number
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function getCssVar(name: string): string {
  if (typeof window === 'undefined') return ''
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

export function parseRgb(value: string): Rgb | null {
  const parts = value
    .split(',')
    .map((v) => Number.parseInt(v.trim(), 10))
    .filter((v) => !Number.isNaN(v))

  if (parts.length !== 3) return null
  return { r: clamp(parts[0], 0, 255), g: clamp(parts[1], 0, 255), b: clamp(parts[2], 0, 255) }
}

export function parseHslTriplet(value: string): { h: number; s: number; l: number } | null {
  // Support space or comma separated values, e.g., "200 50% 50%" or "200, 50%, 50%"
  const parts = value.split(/[\s,]+/).filter(Boolean)
  if (parts.length < 3) return null

  const [hRaw, sRaw, lRaw] = parts
  const h = Number.parseFloat(hRaw)
  const s = Number.parseFloat((sRaw ?? '').replace('%', ''))
  const l = Number.parseFloat((lRaw ?? '').replace('%', ''))

  if ([h, s, l].some((n) => Number.isNaN(n))) return null
  return { h, s, l }
}

export function hslToRgb(h: number, s: number, l: number): Rgb {
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

export function rgbString({ r, g, b }: Rgb): string {
  return `rgb(${r}, ${g}, ${b})`
}

export function rgbaString({ r, g, b }: Rgb, alpha: number): string {
  return `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1)})`
}

export function mixRgb(a: Rgb, b: Rgb, amount: number): Rgb {
  const t = clamp(amount, 0, 1)
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  }
}
