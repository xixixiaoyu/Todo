import { createI18n } from 'vue-i18n'
import zhCN from './locales/zh-CN'
import enUS from './locales/en-US'

// 递归将对象的值类型转换为 string
type DeepStringify<T> = {
  [K in keyof T]: T[K] extends object ? DeepStringify<T[K]> : string
}

export type MessageSchema = DeepStringify<typeof zhCN>

// 获取浏览器语言或本地存储的语言偏好
function getDefaultLocale(): string {
  const stored = localStorage.getItem('locale')
  if (stored) return stored

  const browserLang = navigator.language
  if (browserLang.startsWith('zh')) return 'zh-CN'
  return 'en-US'
}

const i18n = createI18n<[MessageSchema], 'zh-CN' | 'en-US' | 'zh'>({
  legacy: false,
  locale: getDefaultLocale(),
  fallbackLocale: 'en-US',
  messages: {
    'zh-CN': zhCN as unknown as MessageSchema,
    zh: zhCN as unknown as MessageSchema,
    'en-US': enUS as unknown as MessageSchema,
  },
})

export default i18n
