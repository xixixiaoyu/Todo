import { z } from 'zod'
import i18n from '@/i18n'

/**
 * 自定义 Zod 错误映射，支持国际化
 */
export const zodErrorMap: z.ZodErrorMap = (issue, ctx) => {
  const { t } = i18n.global

  // 如果 issue.message 看起来像一个 i18n 键名（包含点号），则直接翻译
  if (issue.message && issue.message.includes('.')) {
    return { message: t(issue.message, issue as unknown as Record<string, unknown>) }
  }

  // 否则根据 issue.code 进行默认翻译
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      if (issue.received === 'undefined') {
        return { message: t('validation.REQUIRED') }
      }
      break
    case z.ZodIssueCode.too_small:
      return { message: t('validation.MIN_LENGTH', { min: issue.minimum }) }
    case z.ZodIssueCode.too_big:
      return { message: t('validation.MAX_LENGTH', { max: issue.maximum }) }
    case z.ZodIssueCode.invalid_string:
      if (issue.validation === 'email') {
        return { message: t('validation.INVALID_EMAIL') }
      }
      if (issue.validation === 'url') {
        return { message: t('validation.INVALID_URL') }
      }
      break
  }

  return { message: ctx.defaultError }
}

/**
 * 初始化全局 Zod 错误映射
 */
export function initZodI18n() {
  z.setErrorMap(zodErrorMap)
}
