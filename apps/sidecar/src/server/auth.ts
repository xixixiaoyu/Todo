import { timingSafeEqual } from 'node:crypto'
import type { MiddlewareHandler } from 'hono'
import { logger } from '../utils/logger'

/**
 * 鉴权中间件配置
 */
export interface AuthMiddlewareOptions {
  /** 启动时由宿主注入的 Bearer Token */
  token: string
  /** 实际监听端口，用于 Host 头白名单校验 */
  port: number
  /** 不参与鉴权的路径前缀（如 /health，供宿主 readiness 探活） */
  skipPaths?: string[]
}

/**
 * 生成统一 ApiErrorResponse
 */
function errorBody(message: string, statusCode: number) {
  return {
    success: false as const,
    data: null,
    message,
    statusCode,
    timestamp: new Date().toISOString(),
  }
}

/**
 * 常量时间比较，避免 Bearer Token 被时序攻击探测
 */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

/**
 * 解析 Host 头中的 hostname，忽略端口部分
 * 支持 IPv4/普通 hostname / 带端口 / 无端口
 */
function parseHostname(host: string | undefined): { hostname: string; port: string } | null {
  if (!host) return null
  // 去掉 IPv6 外框（本场景不预期 IPv6，但保持健壮）
  const trimmed = host.trim()
  if (!trimmed) return null

  // IPv6：[::1]:port
  if (trimmed.startsWith('[')) {
    const end = trimmed.indexOf(']')
    if (end === -1) return null
    const hostname = trimmed.slice(1, end)
    const rest = trimmed.slice(end + 1)
    const port = rest.startsWith(':') ? rest.slice(1) : ''
    return { hostname, port }
  }

  const idx = trimmed.lastIndexOf(':')
  if (idx === -1) return { hostname: trimmed, port: '' }
  return { hostname: trimmed.slice(0, idx), port: trimmed.slice(idx + 1) }
}

/**
 * 创建鉴权中间件：
 * 1. skipPaths 匹配 → 放行（用于健康检查）
 * 2. Host 头必须命中白名单（防 DNS rebinding）
 * 3. Authorization: Bearer <token> 必须匹配（常量时间比较）
 *
 * 所有失败路径走统一 ApiErrorResponse 格式。
 */
export function createAuthMiddleware(options: AuthMiddlewareOptions): MiddlewareHandler {
  const { token, port } = options
  if (!token) {
    throw new Error('createAuthMiddleware: token must not be empty')
  }

  const skipPaths = options.skipPaths ?? []
  // Host 头白名单：只允许 loopback + 期望端口
  const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`])

  return async (c, next) => {
    const path = c.req.path

    if (skipPaths.some((prefix) => path === prefix || path.startsWith(prefix + '/'))) {
      return next()
    }

    // Host 头校验
    const hostHeader = c.req.header('host')
    const parsed = parseHostname(hostHeader)
    if (
      !parsed ||
      !allowedHosts.has(`${parsed.hostname}:${parsed.port}`) ||
      // 严格要求端口匹配（防止裸 hostname 绕过）
      parsed.port !== String(port)
    ) {
      logger.warn('Rejecting request with invalid Host header', { host: hostHeader, path })
      return c.json(errorBody('Forbidden: invalid host', 403), 403)
    }

    // Authorization 校验
    const authHeader = c.req.header('authorization') ?? c.req.header('Authorization')
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return c.json(errorBody('Unauthorized: missing bearer token', 401), 401)
    }

    const presented = authHeader.slice(7).trim()
    if (!presented || !safeEqual(presented, token)) {
      return c.json(errorBody('Unauthorized: invalid token', 401), 401)
    }

    return next()
  }
}
