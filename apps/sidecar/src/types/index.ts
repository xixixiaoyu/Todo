import type { McpTransportType, StdioConfig, McpServerResponse } from '@lumina/shared'

/**
 * Sidecar 本地 MCP 服务器配置（不含 userId）
 */
export interface McpServerConfig {
  id: string
  name: string
  description: string | null
  transport: McpTransportType
  config: StdioConfig | LocalHttpConfig
  enabled: boolean
  createdAt: string
  updatedAt: string
}

/**
 * 桌面端 HTTP 配置 — 允许 localhost / private IP
 * 与后端 HttpConfig 不同：不拦截私有地址
 */
export interface LocalHttpConfig {
  url: string
  headers?: Record<string, string>
  auth?: {
    type: 'bearer' | 'api_key' | 'oauth'
    token?: string
    apiKey?: string
    apiKeyHeader?: string
  }
}

/**
 * 本地配置文件结构
 */
export interface McpServersConfig {
  version: 1
  servers: McpServerConfig[]
}

/**
 * Sidecar 健康检查响应
 */
export interface SidecarHealthResponse {
  status: 'ok'
  version: string
  uptime: number
  mcp: {
    connections: number
    servers: number
  }
}

/** 脱敏占位符 */
export const REDACTED = '***'

/** 响应中需脱敏的请求头（大小写不敏感匹配） */
const SENSITIVE_HEADER_PATTERNS = [
  /^authorization$/i,
  /^cookie$/i,
  /^x-api-key$/i,
  /^proxy-authorization$/i,
]

function redactHeaders(
  headers: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!headers) return headers
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) {
    out[key] = SENSITIVE_HEADER_PATTERNS.some((re) => re.test(key)) ? REDACTED : value
  }
  return out
}

/**
 * 对 StdioConfig / LocalHttpConfig 进行脱敏：
 * - stdio.env 全量占位符化（完全不暴露值，连 key 的值是否用户依赖无法判断）
 * - http.auth.token / apiKey 打码，type / apiKeyHeader 保留供 UI 回显
 * - http.headers 中的敏感头打码
 */
export function redactServerConfig(
  config: StdioConfig | LocalHttpConfig,
): StdioConfig | LocalHttpConfig {
  if ('command' in config) {
    const redactedEnv = config.env
      ? Object.fromEntries(Object.keys(config.env).map((k) => [k, REDACTED]))
      : undefined
    return {
      ...config,
      env: redactedEnv,
    }
  }

  const redactedAuth = config.auth
    ? {
        ...config.auth,
        ...(config.auth.token !== undefined ? { token: REDACTED } : {}),
        ...(config.auth.apiKey !== undefined ? { apiKey: REDACTED } : {}),
      }
    : undefined

  return {
    ...config,
    headers: redactHeaders(config.headers),
    auth: redactedAuth,
  }
}

/**
 * 将本地配置转为与后端兼容的 McpServerResponse
 *
 * 注意：LocalHttpConfig 与 HttpConfig 在运行时结构完全相同，
 * 差异仅在于 Zod schema 层的 URL 校验策略（是否允许 localhost/private IP）。
 * 此处的类型断言是安全的——数据在入库前已经过 LocalHttpConfigSchema 校验。
 *
 * @param options.redact 默认 true；走连接流程（需完整凭证）时显式传 false。
 */
export function toServerResponse(
  server: McpServerConfig,
  options: { redact?: boolean } = {},
): McpServerResponse {
  const redact = options.redact ?? true
  const config = redact ? redactServerConfig(server.config) : server.config
  return {
    id: server.id,
    name: server.name,
    description: server.description,
    transport: server.transport,
    config: config as unknown as McpServerResponse['config'],
    enabled: server.enabled,
    userId: 0,
    createdAt: server.createdAt,
    updatedAt: server.updatedAt,
  }
}
