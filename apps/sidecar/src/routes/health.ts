import { Hono } from 'hono'
import type { SidecarHealthResponse } from '../types'
import type { McpConfigStore } from '../store/mcp-config-store'
import type { McpClient } from '../mcp/mcp-client'

/**
 * 创建健康检查路由，注入运行时依赖以返回真实数据
 */
export function createHealthRoutes(configStore: McpConfigStore, mcpClient: McpClient): Hono {
  const health = new Hono()

  health.get('/', async (c) => {
    const servers = await configStore.findAll()
    const response: SidecarHealthResponse = {
      status: 'ok',
      version: '1.0.0-beta.1',
      uptime: process.uptime(),
      mcp: {
        connections: mcpClient.getActiveConnectionCount(),
        servers: servers.length,
      },
    }
    return c.json({
      success: true,
      data: response,
      timestamp: new Date().toISOString(),
    })
  })

  return health
}
