import { Injectable, Logger } from '@nestjs/common'
import { ThrottlerStorageService } from '@nestjs/throttler'
import type { ThrottlerStorage } from '@nestjs/throttler'
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
local hitsKey = key .. ':hits'
local blockKey = key .. ':block'
local sequenceKey = key .. ':seq'
local now = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local blockDuration = tonumber(ARGV[4])

local function toSeconds(milliseconds)
  if milliseconds <= 0 then
    return 0
  end

  return math.ceil(milliseconds / 1000)
end

local function getTimeToExpireMs()
  local earliestHit = redis.call('ZRANGE', hitsKey, 0, 0, 'WITHSCORES')
  if not earliestHit[2] then
    return 0
  end

  local expiresAt = tonumber(earliestHit[2]) + ttl
  local timeToExpireMs = expiresAt - now
  if timeToExpireMs < 0 then
    return 0
  end

  return timeToExpireMs
end

redis.call('ZREMRANGEBYSCORE', hitsKey, '-inf', now - ttl)

local timeToBlockExpireMs = redis.call('PTTL', blockKey)
if timeToBlockExpireMs > 0 then
  local totalHits = redis.call('ZCARD', hitsKey)
  return {
    totalHits,
    toSeconds(getTimeToExpireMs()),
    1,
    toSeconds(timeToBlockExpireMs)
  }
end

local sequence = redis.call('INCR', sequenceKey)
local member = tostring(now) .. '-' .. tostring(sequence)
redis.call('ZADD', hitsKey, now, member)
redis.call('PEXPIRE', hitsKey, ttl)
redis.call('PEXPIRE', sequenceKey, ttl)

local totalHits = redis.call('ZCARD', hitsKey)
local timeToExpireMs = getTimeToExpireMs()

if totalHits > limit then
  redis.call('PSETEX', blockKey, blockDuration, '1')
  redis.call('DEL', hitsKey)
  redis.call('DEL', sequenceKey)

  return {
    totalHits,
    toSeconds(timeToExpireMs),
    1,
    toSeconds(blockDuration)
  }
end

return { totalHits, toSeconds(timeToExpireMs), 0, 0 }
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
