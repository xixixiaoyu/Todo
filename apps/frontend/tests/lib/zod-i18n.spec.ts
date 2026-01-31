import { describe, it, expect, vi } from 'vitest'
import { zodErrorMap } from '@/lib/zod-i18n'
import { z } from 'zod'

// Mock i18n
vi.mock('@/i18n', () => ({
  default: {
    global: {
      t: (key: string, params?: Record<string, unknown>) => {
        const translations: Record<string, string> = {
          'validation.REQUIRED': '不能为空',
          'validation.MIN_LENGTH': '至少需要 {min} 个字符',
          'validation.INVALID_EMAIL': '请输入有效的邮箱地址',
        }
        let text = translations[key] || key
        if (params) {
          Object.entries(params).forEach(([k, v]) => {
            text = text.replace(`{${k}}`, String(v))
          })
        }
        return text
      },
    },
  },
}))

describe('zodErrorMap', () => {
  it('should translate REQUIRED error', () => {
    const issue: z.ZodIssue = {
      code: z.ZodIssueCode.invalid_type,
      expected: 'string',
      received: 'undefined',
      path: [],
      message: 'Required',
    }
    const result = zodErrorMap(issue, { defaultError: 'Required', data: undefined })
    expect(result.message).toBe('不能为空')
  })

  it('should translate MIN_LENGTH error with parameters', () => {
    const issue: z.ZodIssue = {
      code: z.ZodIssueCode.too_small,
      minimum: 6,
      type: 'string',
      inclusive: true,
      exact: false,
      path: [],
      message: 'validation.MIN_LENGTH',
    }
    const result = zodErrorMap(issue, { defaultError: 'too small', data: '' })
    expect(result.message).toBe('至少需要 6 个字符')
  })

  it('should translate explicit i18n keys and pass parameters', () => {
    const issue: z.ZodIssue = {
      code: z.ZodIssueCode.too_small,
      minimum: 6,
      type: 'string',
      inclusive: true,
      exact: false,
      path: [],
      message: 'validation.MIN_LENGTH', // This matches the code logic
    }
    const result = zodErrorMap(issue, { defaultError: 'too small', data: '' })
    expect(result.message).toBe('至少需要 6 个字符')
  })

  it('should translate INVALID_EMAIL error', () => {
    const issue: z.ZodIssue = {
      code: z.ZodIssueCode.invalid_string,
      validation: 'email',
      path: [],
      message: 'Invalid email',
    }
    const result = zodErrorMap(issue, { defaultError: 'Invalid email', data: 'invalid' })
    expect(result.message).toBe('请输入有效的邮箱地址')
  })
})
