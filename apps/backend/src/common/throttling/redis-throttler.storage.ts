import { Injectable, Logger } from '@nestjs/common'
import { ThrottlerStorageService, type ThrottlerStorage } from '@nestjs/throttler'
import { CachePrefix, RedisService } from '../../redis'

type RedisEvalClient = {
  eval: (script: string, numKeys: number, ...args: Array<string | number>) => Promise<unknown>
}

type RedisScriptResult = [number | string, number | string, number | string, number | string]

type ThrottlerStorageRecord = {
  totalHits: number
  timeToExpire: number
  isBlocked: boolean
  timeToBlockExpire: number
}

const REDIS_THROTTLE_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local blockDuration = tonumber(ARGV[4])

local values = redis.call('HMGET', key, 'totalHits', 'expiresAt', 'blockExpiresAt')
local totalHits = tonumber(values[1]) or 0
local expiresAt = tonumber(values[2]) or 0
local blockExpiresAt = tonumber(values[3]) or 0

if expiresAt <= now or (blockExpiresAt > 0 and blockExpiresAt <= now) then
  totalHits = 0
  expiresAt = now + ttl
  blockExpiresAt = 0
end

local isBlocked = blockExpiresAt > now

if not isBlocked then
  totalHits = totalHits + 1

  if totalHits > limit then
    blockExpiresAt = now + blockDuration
    isBlocked = true
  end
end

local timeToExpireMs = expiresAt - now
if timeToExpireMs < 0 then
  timeToExpireMs = 0
end

local timeToBlockExpireMs = blockExpiresAt - now
if timeToBlockExpireMs < 0 then
  timeToBlockExpireMs = 0
end

local recordTtlMs = timeToExpireMs
if timeToBlockExpireMs > recordTtlMs then
  recordTtlMs = timeToBlockExpireMs
end
if recordTtlMs <= 0 then
  recordTtlMs = 1
end

redis.call('HSET', key, 'totalHits', totalHits, 'expiresAt', expiresAt, 'blockExpiresAt', blockExpiresAt)
redis.call('PEXPIRE', key, recordTtlMs)

return {
  totalHits,
  math.ceil(timeToExpireMs / 1000),
  isBlocked and 1 or 0,
  math.ceil(timeToBlockExpireMs / 1000)
}
`

function isRedisEvalClient(value: unknown): value is RedisEvalClient {
  return (
    typeof value === 'object' &&
    value !== null &&
    'eval' in value &&
    typeof value.eval === 'function'
  )
}

function isRedisScriptResult(value: unknown): value is RedisScriptResult {
  return Array.isArray(value) && value.length >= 4
}

function normalizeResultValue(value: string | number): number {
  return typeof value === 'number' ? value : Number(value)
}

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger(RedisThrottlerStorage.name)
  private readonly fallbackStorage = new ThrottlerStorageService()
  private hasLoggedFallbackUnavailable = false

  constructor(private readonly redisService: RedisService) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const client = this.redisService.getRawClient()
    if (!isRedisEvalClient(client)) {
      this.logFallbackUnavailable()
      return this.fallbackStorage.increment(key, ttl, limit, blockDuration, throttlerName)
    }

    try {
      const effectiveBlockDuration = blockDuration > 0 ? blockDuration : ttl
      const response = await client.eval(
        REDIS_THROTTLE_SCRIPT,
        1,
        this.buildStorageKey(key, throttlerName),
        Date.now(),
        ttl,
        limit,
        effectiveBlockDuration,
      )

      if (!isRedisScriptResult(response)) {
        throw new Error('Unexpected Redis throttle response')
      }

      return {
        totalHits: normalizeResultValue(response[0]),
        timeToExpire: normalizeResultValue(response[1]),
        isBlocked: normalizeResultValue(response[2]) === 1,
        timeToBlockExpire: normalizeResultValue(response[3]),
      }
    } catch (error) {
      this.logger.error(
        `Redis throttler storage failed for ${throttlerName}`,
        error instanceof Error ? error.stack : undefined,
      )
      return this.fallbackStorage.increment(key, ttl, limit, blockDuration, throttlerName)
    }
  }

  private buildStorageKey(key: string, throttlerName: string): string {
    return `${CachePrefix.RATE_LIMIT}:${throttlerName}:${key}`
  }

  private logFallbackUnavailable() {
    if (this.hasLoggedFallbackUnavailable) {
      return
    }

    this.hasLoggedFallbackUnavailable = true
    this.logger.warn(
      'Raw Redis client unavailable for throttling, falling back to in-memory storage',
    )
  }
}
