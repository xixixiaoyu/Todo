import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  clamp,
  getCssVar,
  parseRgb,
  parseHslTriplet,
  hslToRgb,
  rgbString,
  rgbaString,
  mixRgb,
} from '@/lib/colors'

describe('colors.ts', () => {
  describe('clamp', () => {
    it('should return value if within range', () => {
      expect(clamp(50, 0, 100)).toBe(50)
    })

    it('should return min if value is less than min', () => {
      expect(clamp(-10, 0, 100)).toBe(0)
    })

    it('should return max if value is greater than max', () => {
      expect(clamp(150, 0, 100)).toBe(100)
    })
  })

  describe('getCssVar', () => {
    // Save original window/document
    const originalWindow = global.window
    const originalGetComputedStyle = global.getComputedStyle

    afterEach(() => {
      global.window = originalWindow
      global.getComputedStyle = originalGetComputedStyle
    })

    it('should return empty string if window is undefined', () => {
      // @ts-expect-error - Mocking window deletion
      delete global.window
      expect(getCssVar('--test-var')).toBe('')
    })

    it('should return trimmed CSS variable value', () => {
      const mockGetPropertyValue = vi.fn().mockReturnValue('  #ffffff  ')
      global.getComputedStyle = vi.fn().mockReturnValue({
        getPropertyValue: mockGetPropertyValue,
      }) as unknown as typeof global.getComputedStyle

      expect(getCssVar('--test-var')).toBe('#ffffff')
      expect(mockGetPropertyValue).toHaveBeenCalledWith('--test-var')
    })
  })

  describe('parseRgb', () => {
    it('should parse valid rgb string "r, g, b"', () => {
      expect(parseRgb('255, 0, 128')).toEqual({ r: 255, g: 0, b: 128 })
    })

    it('should clamp values', () => {
      expect(parseRgb('300, -50, 100')).toEqual({ r: 255, g: 0, b: 100 })
    })

    it('should return null for invalid format', () => {
      expect(parseRgb('255, 0')).toBeNull() // Missing one
      expect(parseRgb('255, 0, abc')).toBeNull() // NaN
      expect(parseRgb('')).toBeNull()
    })
  })

  describe('parseHslTriplet', () => {
    it('should parse space-separated values', () => {
      expect(parseHslTriplet('200 50% 50%')).toEqual({ h: 200, s: 50, l: 50 })
    })

    it('should parse space-separated values without %', () => {
      expect(parseHslTriplet('200 50 50')).toEqual({ h: 200, s: 50, l: 50 })
    })

    it('should handle comma-separated values (robustness)', () => {
      // This tests the optimization we plan to add
      expect(parseHslTriplet('200, 50%, 50%')).toEqual({ h: 200, s: 50, l: 50 })
    })

    it('should return null for invalid values', () => {
      expect(parseHslTriplet('abc 50% 50%')).toBeNull()
    })
  })

  describe('hslToRgb', () => {
    it('should convert black (0, 0%, 0%)', () => {
      expect(hslToRgb(0, 0, 0)).toEqual({ r: 0, g: 0, b: 0 })
    })

    it('should convert white (0, 0%, 100%)', () => {
      expect(hslToRgb(0, 0, 100)).toEqual({ r: 255, g: 255, b: 255 })
    })

    it('should convert red (0, 100%, 50%)', () => {
      expect(hslToRgb(0, 100, 50)).toEqual({ r: 255, g: 0, b: 0 })
    })

    it('should convert green (120, 100%, 50%)', () => {
      expect(hslToRgb(120, 100, 50)).toEqual({ r: 0, g: 255, b: 0 })
    })

    it('should convert blue (240, 100%, 50%)', () => {
      expect(hslToRgb(240, 100, 50)).toEqual({ r: 0, g: 0, b: 255 })
    })
  })

  describe('rgbString', () => {
    it('should format rgb string', () => {
      expect(rgbString({ r: 10, g: 20, b: 30 })).toBe('rgb(10, 20, 30)')
    })
  })

  describe('rgbaString', () => {
    it('should format rgba string with alpha', () => {
      expect(rgbaString({ r: 10, g: 20, b: 30 }, 0.5)).toBe('rgba(10, 20, 30, 0.5)')
    })

    it('should clamp alpha', () => {
      expect(rgbaString({ r: 10, g: 20, b: 30 }, 1.5)).toBe('rgba(10, 20, 30, 1)')
      expect(rgbaString({ r: 10, g: 20, b: 30 }, -0.5)).toBe('rgba(10, 20, 30, 0)')
    })
  })

  describe('mixRgb', () => {
    const c1 = { r: 0, g: 0, b: 0 }
    const c2 = { r: 100, g: 100, b: 100 }

    it('should return first color when amount is 0', () => {
      expect(mixRgb(c1, c2, 0)).toEqual(c1)
    })

    it('should return second color when amount is 1', () => {
      expect(mixRgb(c1, c2, 1)).toEqual(c2)
    })

    it('should mix colors correctly at 50%', () => {
      expect(mixRgb(c1, c2, 0.5)).toEqual({ r: 50, g: 50, b: 50 })
    })

    it('should clamp amount', () => {
      expect(mixRgb(c1, c2, -1)).toEqual(c1)
      expect(mixRgb(c1, c2, 2)).toEqual(c2)
    })
  })
})
