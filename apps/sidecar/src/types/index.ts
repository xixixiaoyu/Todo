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

/**
 * 将本地配置转为与后端兼容的 McpServerResponse
 *
 * 注意：LocalHttpConfig 与 HttpConfig 在运行时结构完全相同，
 * 差异仅在于 Zod schema 层的 URL 校验策略（是否允许 localhost/private IP）。
 * 此处的类型断言是安全的——数据在入库前已经过 LocalHttpConfigSchema 校验。
 */
export function toServerResponse(server: McpServerConfig): McpServerResponse {
  return {
    id: server.id,
    name: server.name,
    description: server.description,
    transport: server.transport,
    // LocalHttpConfig 与 HttpConfig 结构等价，仅 Zod refine 不同
    config: server.config as unknown as McpServerResponse['config'],
    enabled: server.enabled,
    userId: 0,
    createdAt: server.createdAt,
    updatedAt: server.updatedAt,
  }
}
