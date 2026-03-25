import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Logger } from '@nestjs/common'
import { RedisThrottlerStorage } from '@/common'
import type { RedisService } from '@/redis/redis.service'

type RedisThrottleState = {
  blockedUntil: number
  hits: number[]
}

type EvalArguments = [string, number, string, number, number, number, number]

function createStatefulEvalClient() {
  const state = new Map<string, RedisThrottleState>()

  return {
    eval: async (...args: EvalArguments) => {
      const [, , key, now, ttl, limit, blockDuration] = args
      const current = state.get(key) ?? { hits: [], blockedUntil: 0 }
      current.hits = current.hits.filter((timestamp) => timestamp + ttl > now)

      if (current.blockedUntil > now) {
        const timeToExpireMs =
          current.hits.length > 0 ? Math.max(0, current.hits[0] + ttl - now) : 0
        return [
          current.hits.length,
          Math.ceil(timeToExpireMs / 1000),
          1,
          Math.ceil((current.blockedUntil - now) / 1000),
        ]
      }

      current.hits.push(now)

      const timeToExpireMs = Math.max(0, current.hits[0] + ttl - now)
      const totalHits = current.hits.length

      if (totalHits > limit) {
        current.blockedUntil = now + blockDuration
        current.hits = []
        state.set(key, current)
        return [totalHits, Math.ceil(timeToExpireMs / 1000), 1, Math.ceil(blockDuration / 1000)]
      }

      current.blockedUntil = 0
      state.set(key, current)
      return [totalHits, Math.ceil(timeToExpireMs / 1000), 0, 0]
    },
  }
}

describe('RedisThrottlerStorage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
  })

  it('uses Redis eval responses when a raw client is available', async () => {
    const evalMock = vi.fn().mockResolvedValue([3, 8, 1, 8])
    const redisService = {
      getRawClient: () => ({
        eval: evalMock,
      }),
    } as unknown as RedisService
    const storage = new RedisThrottlerStorage(redisService)

    const result = await storage.increment('test-key', 1000, 2, 1000, 'short')

    expect(evalMock).toHaveBeenCalledWith(
      expect.any(String),
      1,
      'rate_limit:short:test-key',
      expect.any(Number),
      1000,
      2,
      1000,
    )
    expect(result).toEqual({
      totalHits: 3,
      timeToExpire: 8,
      isBlocked: true,
      timeToBlockExpire: 8,
    })
  })

  it('falls back to in-memory throttling when Redis is unavailable', async () => {
    const redisService = {
      getRawClient: () => undefined,
    } as unknown as RedisService
    const storage = new RedisThrottlerStorage(redisService)

    const first = await storage.increment('fallback-key', 1000, 2, 1000, 'short')
    const second = await storage.increment('fallback-key', 1000, 2, 1000, 'short')
    const third = await storage.increment('fallback-key', 1000, 2, 1000, 'short')

    expect(first.isBlocked).toBe(false)
    expect(second.isBlocked).toBe(false)
    expect(third.isBlocked).toBe(true)
    expect(third.totalHits).toBe(3)
  })

  it('preserves sliding-window throttling semantics when requests cross fixed-window boundaries', async () => {
    let currentTime = 0
    const dateNow = vi.spyOn(Date, 'now').mockImplementation(() => currentTime)
    const rawClient = createStatefulEvalClient()
    const redisService = {
      getRawClient: () => rawClient,
    } as unknown as RedisService
    const storage = new RedisThrottlerStorage(redisService)

    currentTime = 0
    const first = await storage.increment('sliding-key', 1000, 2, 1000, 'short')

    currentTime = 900
    const second = await storage.increment('sliding-key', 1000, 2, 1000, 'short')

    currentTime = 1100
    const third = await storage.increment('sliding-key', 1000, 2, 1000, 'short')

    currentTime = 1500
    const fourth = await storage.increment('sliding-key', 1000, 2, 1000, 'short')

    expect(first.isBlocked).toBe(false)
    expect(second.isBlocked).toBe(false)
    expect(third.isBlocked).toBe(false)
    expect(fourth).toMatchObject({
      totalHits: 3,
      isBlocked: true,
      timeToBlockExpire: 1,
    })

    dateNow.mockRestore()
  })
})
