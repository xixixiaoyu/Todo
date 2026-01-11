import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import updateLocale from 'dayjs/plugin/updateLocale'
import 'dayjs/locale/zh-cn'
import 'dayjs/locale/en'

// 启用插件
dayjs.extend(relativeTime)
dayjs.extend(updateLocale)

/**
 * 格式化日期
 * @param date 日期
 * @param format 格式
 * @returns 格式化后的字符串
 */
export function formatDate(date: string | number | Date, format = 'YYYY-MM-DD HH:mm:ss'): string {
  return dayjs(date).format(format)
}

/**
 * 格式化相对时间
 * @param date 日期
 * @param locale 语言
 * @returns 格式化后的字符串
 */
export function formatRelativeTime(date: string | number | Date, locale = 'zh-CN'): string {
  const d = dayjs(date)
  const lang = locale === 'zh-CN' ? 'zh-cn' : 'en'

  return d.locale(lang).fromNow()
}

export default dayjs
