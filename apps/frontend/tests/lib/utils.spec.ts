import { describe, it, expect } from 'vitest'
import { cn, highlightMatch } from '@/lib/utils'

describe('cn utility', () => {
  it('should merge class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('should handle conditional classes', () => {
    const condition = false
    expect(cn('foo', condition && 'bar', 'baz')).toBe('foo baz')
  })

  it('should merge tailwind classes correctly', () => {
    expect(cn('bg-red-500', 'p-4')).toBe('bg-red-500 p-4')
    expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500')
    expect(cn('p-4', { 'm-2': true, 'm-4': false })).toBe('p-4 m-2')
  })

  it('should handle empty inputs', () => {
    expect(cn()).toBe('')
  })
})

describe('highlightMatch', () => {
  it('should return original text if query is empty', () => {
    expect(highlightMatch('Hello World', '')).toBe('Hello World')
    expect(highlightMatch('Hello World', '  ')).toBe('Hello World')
  })

  it('should highlight matching text case-insensitively', () => {
    const result = highlightMatch('Hello World', 'hello')
    expect(result).toContain(
      '<mark class="bg-primary/20 text-primary px-0.5 rounded-sm font-medium">Hello</mark>',
    )
  })

  it('should highlight multiple matches', () => {
    const result = highlightMatch('Apple Banana Apple', 'apple')
    const matches = result.match(/<mark/g)
    expect(matches?.length).toBe(2)
  })

  it('should escape special characters in query', () => {
    const result = highlightMatch('Price is $10', '$10')
    expect(result).toContain(
      '<mark class="bg-primary/20 text-primary px-0.5 rounded-sm font-medium">$10</mark>',
    )
  })
})
