import { z as zLocal } from 'zod'
import { z as zShared } from '@lumina/shared'
import i18n from '@/i18n'

type ZodErrorMap = zLocal.ZodErrorMap

/**
 * 自定义 Zod 错误映射，支持国际化
 */
export const zodErrorMap: ZodErrorMap = (issue, ctx) => {
  const { t } = i18n.global

  // 1. 优先处理显式提供的 i18n 键名 (来自 shared schema)
  // 如果显式提供了 message 且它是 i18n 键名，则使用该键名进行翻译
  // 我们需要确保 params 中包含 min/max 等参数
  if (issue.message && issue.message.includes('.') && !issue.message.includes(' ')) {
    const p: Record<string, unknown> = { ...issue }
    // 统一参数名，兼容不同版本的 translation keys
    if ('minimum' in issue) {
      p.min = issue.minimum
      p.minimum = issue.minimum
    }
    if ('maximum' in issue) {
      p.max = issue.maximum
      p.maximum = issue.maximum
    }
    return { message: t(issue.message, p) }
  }

  // 2. 根据 issue.code 进行默认翻译
  switch (issue.code) {
    case zLocal.ZodIssueCode.invalid_type:
      if (issue.received === 'undefined' || issue.received === 'null') {
        return { message: t('validation.REQUIRED') }
      }
      return {
        message: t('validation.INVALID_TYPE', {
          expected: issue.expected,
          received: issue.received,
        }),
      }
    case zLocal.ZodIssueCode.too_small: {
      const minKey = issue.type === 'string' ? 'validation.MIN_LENGTH' : 'validation.MIN_VALUE'
      return { message: t(minKey, { min: issue.minimum, minimum: issue.minimum }) }
    }
    case zLocal.ZodIssueCode.too_big: {
      const maxKey = issue.type === 'string' ? 'validation.MAX_LENGTH' : 'validation.MAX_VALUE'
      return { message: t(maxKey, { max: issue.maximum, maximum: issue.maximum }) }
    }
    case zLocal.ZodIssueCode.invalid_string:
      if (issue.validation === 'email') {
        return { message: t('validation.INVALID_EMAIL') }
      }
      if (issue.validation === 'url') {
        return { message: t('validation.INVALID_URL') }
      }
      return { message: t('validation.INVALID_FORMAT') }
    case zLocal.ZodIssueCode.custom:
      return { message: issue.message || ctx.defaultError }
  }

  return { message: ctx.defaultError }
}

/**
 * 初始化全局 Zod 错误映射
 */
export function initZodI18n() {
  zLocal.setErrorMap(zodErrorMap)
  zShared.setErrorMap(zodErrorMap as ZodErrorMap)
}
