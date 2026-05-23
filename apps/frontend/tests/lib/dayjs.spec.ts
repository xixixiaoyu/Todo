import { describe, it, expect, vi } from 'vitest'
import { formatRelativeTime } from '@/lib/dayjs'
import dayjs from 'dayjs'

describe('formatRelativeTime', () => {
  const now = '2024-01-01T12:00:00Z'
  vi.setSystemTime(new Date(now))

  it('should format relative time in Chinese', () => {
    const date = dayjs(now).subtract(5, 'minute').toDate()
    expect(formatRelativeTime(date, 'zh-CN')).toBe('5 分钟前')
  })

  it('should format relative time in English', () => {
    const date = dayjs(now).subtract(5, 'minute').toDate()
    expect(formatRelativeTime(date, 'en-US')).toBe('5 minutes ago')
  })
})
