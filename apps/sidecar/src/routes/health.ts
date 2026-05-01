import { Hono } from 'hono'
import type { SidecarHealthResponse } from '../types'

const health = new Hono()

health.get('/', (c) => {
  const response: SidecarHealthResponse = {
    status: 'ok',
    version: '1.0.0-beta.1',
    uptime: process.uptime(),
    mcp: {
      connections: 0, // 从 McpClient 注入
      servers: 0, // 从 McpConfigStore 注入
    },
  }
  return c.json({
    success: true,
    data: response,
    timestamp: new Date().toISOString(),
  })
})

export { health }
