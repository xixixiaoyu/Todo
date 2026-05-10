import { clsx } from 'clsx'
import type { ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 格式化搜索匹配的高亮文本
 */
export function highlightMatch(text: string, query: string) {
  if (!query.trim()) return text

  // 1. 转义原始文本中的 HTML 特殊字符，防止 XSS
  const escapedText = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')

  // 2. 转义查询字符串中的正则特殊字符
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escapedQuery})`, 'gi')

  // 3. 在已转义的文本中进行高亮替换
  return escapedText.replace(
    regex,
    '<mark class="bg-primary/20 text-primary px-0.5 rounded-sm font-medium">$1</mark>',
  )
}
