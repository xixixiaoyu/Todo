import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Logger } from '@nestjs/common'
import { RedisThrottlerStorage } from '@/common'
import type { RedisService } from '@/redis/redis.service'

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
})
