import type { ExecutionContext } from '@nestjs/common'
import type { ConfigService } from '@nestjs/config'
import { minutes, seconds } from '@nestjs/throttler'
import type { ThrottlerModuleOptions, ThrottlerOptions } from '@nestjs/throttler'
import type { RedisThrottlerStorage } from './redis-throttler.storage'

const DEFAULT_THROTTLE_TTLS = {
  short: seconds(1),
  medium: seconds(10),
  long: minutes(1),
} as const

const DEFAULT_THROTTLE_LIMITS = {
  short: 10,
  medium: 50,
  long: 100,
} as const

const THROTTLE_ENV_KEYS = {
  short: {
    ttl: 'THROTTLE_SHORT_TTL',
    limit: 'THROTTLE_SHORT_LIMIT',
  },
  medium: {
    ttl: 'THROTTLE_MEDIUM_TTL',
    limit: 'THROTTLE_MEDIUM_LIMIT',
  },
  long: {
    ttl: 'THROTTLE_LONG_TTL',
    limit: 'THROTTLE_LONG_LIMIT',
  },
} as const

export const THROTTLE_WINDOW_NAMES = ['short', 'medium', 'long'] as const

export type ThrottleWindowName = (typeof THROTTLE_WINDOW_NAMES)[number]

type ThrottleWindowDefinition = {
  limit: number
  ttl: number
  blockDuration?: number
}

export type NamedThrottlePolicy = Record<ThrottleWindowName, ThrottleWindowDefinition>

export type NamedThrottleSkip = Record<ThrottleWindowName, boolean>

export type AppThrottlerModuleOptions = Extract<
  ThrottlerModuleOptions,
  { throttlers: Array<ThrottlerOptions> }
>

function readPositiveInteger(
  config: Pick<ConfigService, 'get'>,
  key: string,
  fallback: number,
): number {
  const value = config.get<string | number | undefined>(key)
  const normalized = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(normalized) && normalized > 0 ? normalized : fallback
}

export function createThrottlePolicy(
  limits: Record<ThrottleWindowName, number>,
  overrides?: Partial<Record<ThrottleWindowName, Omit<ThrottleWindowDefinition, 'limit'>>>,
): NamedThrottlePolicy {
  return THROTTLE_WINDOW_NAMES.reduce<NamedThrottlePolicy>((policy, name) => {
    const override = overrides?.[name]
    policy[name] = {
      limit: limits[name],
      ttl: override?.ttl ?? DEFAULT_THROTTLE_TTLS[name],
      ...(typeof override?.blockDuration === 'number'
        ? { blockDuration: override.blockDuration }
        : {}),
    }
    return policy
  }, {} as NamedThrottlePolicy)
}

export const THROTTLE_SKIP_ALL: NamedThrottleSkip = {
  short: true,
  medium: true,
  long: true,
}

export const AUTH_LOGIN_THROTTLE = createThrottlePolicy({
  short: 3,
  medium: 5,
  long: 5,
})

export const AUTH_REGISTER_THROTTLE = createThrottlePolicy({
  short: 2,
  medium: 3,
  long: 3,
})

export const AUTH_REFRESH_THROTTLE = createThrottlePolicy({
  short: 5,
  medium: 20,
  long: 60,
})

export const PASSWORD_FORGOT_THROTTLE = createThrottlePolicy({
  short: 2,
  medium: 3,
  long: 3,
})

export const PASSWORD_RESET_THROTTLE = createThrottlePolicy({
  short: 2,
  medium: 5,
  long: 5,
})

export const EXTERNAL_SOURCE_THROTTLE = createThrottlePolicy({
  short: 1,
  medium: 3,
  long: 10,
})

export const SKILL_RUNTIME_THROTTLE = createThrottlePolicy({
  short: 2,
  medium: 8,
  long: 20,
})

export const FILE_UPLOAD_THROTTLE = createThrottlePolicy({
  short: 2,
  medium: 8,
  long: 20,
})

export const FILE_PARSE_THROTTLE = createThrottlePolicy({
  short: 1,
  medium: 4,
  long: 10,
})

export const MCP_CONNECTION_THROTTLE = createThrottlePolicy({
  short: 1,
  medium: 4,
  long: 10,
})

export const MCP_TOOL_DISCOVERY_THROTTLE = createThrottlePolicy({
  short: 2,
  medium: 6,
  long: 20,
})

export const MCP_TOOL_CALL_THROTTLE = createThrottlePolicy({
  short: 2,
  medium: 10,
  long: 30,
})

export const SEARCH_WEB_THROTTLE = createThrottlePolicy({
  short: 2,
  medium: 6,
  long: 15,
})

export function shouldSkipGlobalThrottle(context: ExecutionContext): boolean {
  const request = context.switchToHttp().getRequest<{ method?: string; url?: string }>()
  const method = request.method?.toUpperCase()
  if (method === 'OPTIONS') {
    return true
  }

  const pathname = (request.url ?? '').split('?')[0]!
  return pathname === '/api/health' || pathname.startsWith('/api/health/')
}

function createGlobalThrottleDefinitions(
  config: Pick<ConfigService, 'get'>,
): Array<ThrottlerOptions> {
  return THROTTLE_WINDOW_NAMES.map((name) => ({
    name,
    ttl: readPositiveInteger(config, THROTTLE_ENV_KEYS[name].ttl, DEFAULT_THROTTLE_TTLS[name]),
    limit: readPositiveInteger(
      config,
      THROTTLE_ENV_KEYS[name].limit,
      DEFAULT_THROTTLE_LIMITS[name],
    ),
  }))
}

export function createGlobalThrottlerOptions(
  config: Pick<ConfigService, 'get'>,
  storage?: RedisThrottlerStorage,
): AppThrottlerModuleOptions {
  return {
    throttlers: createGlobalThrottleDefinitions(config),
    skipIf: shouldSkipGlobalThrottle,
    errorMessage: 'common.error.TOO_MANY_REQUESTS',
    ...(storage ? { storage } : {}),
  }
}
