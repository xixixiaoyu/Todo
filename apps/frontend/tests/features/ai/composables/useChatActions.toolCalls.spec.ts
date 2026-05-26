/** @vitest-environment happy-dom */
import { describe, it, expect } from 'vitest'
import { parseToolArgs } from '@/features/ai/composables/useChatActions.toolCalls'

describe('parseToolArgs', () => {
  it('returns parsed object for valid JSON object', () => {
    expect(parseToolArgs('{"query":"hello"}')).toEqual({ query: 'hello' })
  })

  it('returns empty object for empty string', () => {
    expect(parseToolArgs('')).toEqual({})
  })

  it('returns empty object for whitespace-only string', () => {
    expect(parseToolArgs('   ')).toEqual({})
  })

  it('returns empty object for string "null"', () => {
    expect(parseToolArgs('null')).toEqual({})
  })

  it('returns empty object for JSON array', () => {
    expect(parseToolArgs('[]')).toEqual({})
  })

  it('returns null for invalid JSON', () => {
    expect(parseToolArgs('not json')).toBeNull()
  })

  it('handles input with leading and trailing whitespace', () => {
    expect(parseToolArgs('  {"key":"val"}  ')).toEqual({ key: 'val' })
  })

  it('correctly parses nested objects', () => {
    expect(parseToolArgs('{"a":{"b":"c"}}')).toEqual({ a: { b: 'c' } })
  })

  it('returns empty object when passed null or undefined', () => {
    expect(parseToolArgs(null as unknown as string)).toEqual({})
    expect(parseToolArgs(undefined as unknown as string)).toEqual({})
  })
})
