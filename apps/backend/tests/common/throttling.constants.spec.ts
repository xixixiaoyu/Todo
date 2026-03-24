import { describe, expect, it } from 'vitest'
import type { ExecutionContext } from '@nestjs/common'
import { createGlobalThrottlerOptions, shouldSkipGlobalThrottle } from '@/common'

function createHttpExecutionContext(method: string, url: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        method,
        url,
      }),
    }),
  } as ExecutionContext
}

describe('throttling.constants', () => {
  it('skips OPTIONS requests and health endpoints', () => {
    expect(shouldSkipGlobalThrottle(createHttpExecutionContext('OPTIONS', '/api/auth/login'))).toBe(
      true,
    )
    expect(
      shouldSkipGlobalThrottle(createHttpExecutionContext('GET', '/api/health/liveness')),
    ).toBe(true)
    expect(shouldSkipGlobalThrottle(createHttpExecutionContext('GET', '/api/todos'))).toBe(false)
  })

  it('uses documented defaults and accepts env overrides', () => {
    const defaults = createGlobalThrottlerOptions({
      get: <T>(_: string, fallback?: T) => fallback,
    })
    const defaultThrottlers = defaults.throttlers

    expect(defaultThrottlers).toEqual([
      { name: 'short', ttl: 1000, limit: 10 },
      { name: 'medium', ttl: 10000, limit: 50 },
      { name: 'long', ttl: 60000, limit: 100 },
    ])

    const custom = createGlobalThrottlerOptions({
      get: <T>(key: string, fallback?: T) => {
        const values: Record<string, string> = {
          THROTTLE_SHORT_LIMIT: '7',
          THROTTLE_LONG_TTL: '120000',
        }
        return (values[key] as T | undefined) ?? fallback
      },
    })
    const customThrottlers = custom.throttlers

    expect(customThrottlers).toEqual([
      { name: 'short', ttl: 1000, limit: 7 },
      { name: 'medium', ttl: 10000, limit: 50 },
      { name: 'long', ttl: 120000, limit: 100 },
    ])
  })
})
