import { describe, it, expect, vi } from 'vitest'
import { formatRelativeTime } from '@/lib/dayjs'
import dayjs from 'dayjs'

describe('formatRelativeTime', () => {
  const now = '2024-01-01T12:00:00Z'
  vi.setSystemTime(new Date(now))

  it('should format seconds ago in Chinese', () => {
    const date = dayjs(now).subtract(30, 'second').toDate()
    expect(formatRelativeTime(date, 'zh-CN')).toBe('几秒前')
  })

  it('should format minutes ago in Chinese', () => {
    const date = dayjs(now).subtract(5, 'minute').toDate()
    expect(formatRelativeTime(date, 'zh-CN')).toBe('5 分钟前')
  })

  it('should format hours ago in Chinese', () => {
    const date = dayjs(now).subtract(2, 'hour').toDate()
    expect(formatRelativeTime(date, 'zh-CN')).toBe('2 小时前')
  })

  it('should format days ago in Chinese', () => {
    const date = dayjs(now).subtract(3, 'day').toDate()
    expect(formatRelativeTime(date, 'zh-CN')).toBe('3 天前')
  })

  it('should format months ago in Chinese', () => {
    const date = dayjs(now).subtract(2, 'month').toDate()
    expect(formatRelativeTime(date, 'zh-CN')).toBe('2 个月前')
  })

  it('should format years ago in Chinese', () => {
    const date = dayjs(now).subtract(1, 'year').toDate()
    expect(formatRelativeTime(date, 'zh-CN')).toBe('1 年前')
  })

  it('should format in English', () => {
    const date = dayjs(now).subtract(5, 'minute').toDate()
    expect(formatRelativeTime(date, 'en-US')).toBe('5 minutes ago')
  })
})
