import type { McpTransportType, StdioConfig, HttpConfig, McpServerResponse } from '@lumina/shared'

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
 */
export function toServerResponse(server: McpServerConfig): McpServerResponse {
  return {
    id: server.id,
    name: server.name,
    description: server.description,
    transport: server.transport,
    config: server.config as StdioConfig | HttpConfig,
    enabled: server.enabled,
    userId: 0,
    createdAt: server.createdAt,
    updatedAt: server.updatedAt,
  }
}
