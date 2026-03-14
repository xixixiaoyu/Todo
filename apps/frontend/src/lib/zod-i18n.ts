import { z as zLocal } from 'zod'
import { z as zShared } from '@lumina/shared'
import i18n from '@/i18n'

type ZodErrorMap = zLocal.ZodErrorMap
type I18nTranslator = (key: string, params?: Record<string, unknown>) => string

type IssueWithBounds = zLocal.ZodIssueOptionalMessage & {
  minimum?: number
  maximum?: number
  min?: number
  max?: number
}

/**
 * 自定义 Zod 错误映射，支持国际化
 */
export const zodErrorMap: ZodErrorMap = (issue, ctx) => {
  const t = i18n.global.t as I18nTranslator

  // 获取属性翻译
  const getProperty = (path: (string | number)[]) => {
    const key = path.join('.')
    if (!key) return ''
    const translated = t(`common.fields.${key}`)
    return translated !== `common.fields.${key}` ? translated : key
  }

  // 1. 优先处理显式提供的 i18n 键名 (来自 shared schema)
  if (issue.message && issue.message.includes('.') && !issue.message.includes(' ')) {
    const anyIssue = issue as IssueWithBounds
    const minimum = anyIssue.minimum ?? anyIssue.min
    const maximum = anyIssue.maximum ?? anyIssue.max

    const p: Record<string, unknown> = {
      ...anyIssue,
      min: minimum,
      minimum,
      max: maximum,
      maximum,
      property: getProperty(issue.path),
    }

    return { message: t(issue.message, p) }
  }

  // 2. 根据 issue.code 进行默认翻译
  switch (issue.code) {
    case zLocal.ZodIssueCode.invalid_type:
      if (issue.received === 'undefined' || issue.received === 'null') {
        return { message: t('validation.REQUIRED', { property: getProperty(issue.path) }) }
      }
      return {
        message: t('validation.INVALID_TYPE', {
          property: getProperty(issue.path),
          expected: issue.expected,
          received: issue.received,
        }),
      }
    case zLocal.ZodIssueCode.too_small: {
      const min = (issue as IssueWithBounds).minimum
      const minKey = issue.type === 'string' ? 'validation.MIN_LENGTH' : 'validation.MIN_VALUE'
      return { message: t(minKey, { property: getProperty(issue.path), min, minimum: min }) }
    }
    case zLocal.ZodIssueCode.too_big: {
      const max = (issue as IssueWithBounds).maximum
      const maxKey = issue.type === 'string' ? 'validation.MAX_LENGTH' : 'validation.MAX_VALUE'
      return { message: t(maxKey, { property: getProperty(issue.path), max, maximum: max }) }
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
      // 如果自定义消息是一个键，尝试翻译
      if (issue.message && issue.message.includes('.') && !issue.message.includes(' ')) {
        return { message: t(issue.message) }
      }
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
