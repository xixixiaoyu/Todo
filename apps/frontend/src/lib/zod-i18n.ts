import { z } from 'zod'
import i18n from '@/i18n'

/**
 * 自定义 Zod 错误映射，支持国际化
 */
export const zodErrorMap: z.ZodErrorMap = (issue, ctx) => {
  // 确保在运行时获取最新的 t 函数
  const t = (key: string, params?: Record<string, unknown>) => {
    return i18n.global.t(key, params || {})
  }

  // 如果 issue.message 看起来像一个 i18n 键名（包含点号），则直接翻译
  if (issue.message && issue.message.includes('.')) {
    // 映射 Zod 的参数名到 i18n 模板中的参数名
    const params: Record<string, unknown> = { ...issue }
    if ('minimum' in issue) params.min = issue.minimum
    if ('maximum' in issue) params.max = issue.maximum
    if ('expected' in issue) params.expected = issue.expected
    if ('received' in issue) params.received = issue.received

    const translated = t(issue.message, params)
    // 如果翻译结果仍等于键名，说明翻译失败，尝试回退
    if (translated !== issue.message) {
      return { message: translated }
    }
  }

  // 否则根据 issue.code 进行默认翻译
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      if (issue.received === 'undefined' || issue.received === 'null') {
        return { message: t('validation.REQUIRED') }
      }
      return {
        message: t('validation.INVALID_TYPE', {
          expected: issue.expected,
          received: issue.received,
        }),
      }
    case z.ZodIssueCode.too_small: {
      const minKey = issue.type === 'string' ? 'validation.MIN_LENGTH' : 'validation.MIN_VALUE'
      return { message: t(minKey, { min: issue.minimum }) }
    }
    case z.ZodIssueCode.too_big: {
      const maxKey = issue.type === 'string' ? 'validation.MAX_LENGTH' : 'validation.MAX_VALUE'
      return { message: t(maxKey, { max: issue.maximum }) }
    }
    case z.ZodIssueCode.invalid_string:
      if (issue.validation === 'email') {
        return { message: t('validation.INVALID_EMAIL') }
      }
      if (issue.validation === 'url') {
        return { message: t('validation.INVALID_URL') }
      }
      if (issue.validation === 'regex') {
        return { message: issue.message || t('validation.INVALID_FORMAT') }
      }
      break
    case z.ZodIssueCode.custom:
      return { message: issue.message || ctx.defaultError }
  }

  return { message: ctx.defaultError }
}

/**
 * 初始化全局 Zod 错误映射
 */
export function initZodI18n() {
  z.setErrorMap(zodErrorMap)
}
