import { Hono } from 'hono'
import type { McpToolResponse } from '@lumina/shared'
import { CreateLocalMcpServerSchema, UpdateLocalMcpServerSchema } from '@lumina/shared'
import { McpConfigStore } from '../store/mcp-config-store'
import { McpClient } from '../mcp/mcp-client'
import { toServerResponse } from '../types'
import { NotFoundError, ValidationError } from '../server/errors'
import { logger } from '../utils/logger'

/**
 * 创建 MCP 路由，注入 store 和 client
 */
export function createMcpRoutes(configStore: McpConfigStore, mcpClient: McpClient): Hono {
  const mcp = new Hono()

  // GET /mcp/servers — 列出所有配置
  mcp.get('/servers', async (c) => {
    const servers = await configStore.findAll()
    const responses = servers.map(toServerResponse)
    return c.json({
      success: true,
      data: responses,
      timestamp: new Date().toISOString(),
    })
  })

  // GET /mcp/servers/:id — 获取单个
  mcp.get('/servers/:id', async (c) => {
    const { id } = c.req.param()
    const server = await configStore.findOne(id)
    if (!server) throw new NotFoundError('MCP server', id)
    return c.json({
      success: true,
      data: toServerResponse(server),
      timestamp: new Date().toISOString(),
    })
  })

  // POST /mcp/servers — 创建
  mcp.post('/servers', async (c) => {
    const body = await c.req.json()
    const parsed = CreateLocalMcpServerSchema.safeParse(body)
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]
      throw new ValidationError(firstIssue?.message || 'Invalid request body')
    }
    const server = await configStore.create({
      name: parsed.data.name,
      description: parsed.data.description,
      transport: parsed.data.transport,
      config: parsed.data.config,
      enabled: parsed.data.enabled,
    })
    return c.json(
      {
        success: true,
        data: toServerResponse(server),
        timestamp: new Date().toISOString(),
      },
      201,
    )
  })

  // PUT /mcp/servers/:id — 更新
  mcp.put('/servers/:id', async (c) => {
    const { id } = c.req.param()
    const body = await c.req.json()
    const parsed = UpdateLocalMcpServerSchema.safeParse(body)
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]
      throw new ValidationError(firstIssue?.message || 'Invalid request body')
    }

    // 如果更新了 transport/config，先断开现有连接
    if (parsed.data.transport || parsed.data.config) {
      if (mcpClient.isConnected(id)) {
        await mcpClient.disconnect(id)
      }
    }

    const server = await configStore.update(id, parsed.data)
    if (!server) throw new NotFoundError('MCP server', id)

    return c.json({
      success: true,
      data: toServerResponse(server),
      timestamp: new Date().toISOString(),
    })
  })

  // DELETE /mcp/servers/:id — 删除
  mcp.delete('/servers/:id', async (c) => {
    const { id } = c.req.param()
    if (mcpClient.isConnected(id)) {
      await mcpClient.disconnect(id)
    }
    const deleted = await configStore.delete(id)
    if (!deleted) throw new NotFoundError('MCP server', id)
    return c.json({
      success: true,
      data: null,
      timestamp: new Date().toISOString(),
    })
  })

  // POST /mcp/servers/:id/connect — 连接
  mcp.post('/servers/:id/connect', async (c) => {
    const { id } = c.req.param()
    const server = await configStore.findOne(id)
    if (!server) throw new NotFoundError('MCP server', id)

    if (mcpClient.isConnected(id)) {
      return c.json({
        success: true,
        data: { message: 'Already connected' },
        timestamp: new Date().toISOString(),
      })
    }

    await mcpClient.connect(id, server.transport, server.config)
    return c.json({
      success: true,
      data: { message: 'Connected' },
      timestamp: new Date().toISOString(),
    })
  })

  // POST /mcp/servers/:id/disconnect — 断开
  mcp.post('/servers/:id/disconnect', async (c) => {
    const { id } = c.req.param()
    if (mcpClient.isConnected(id)) {
      await mcpClient.disconnect(id)
    }
    return c.json({
      success: true,
      data: { message: 'Disconnected' },
      timestamp: new Date().toISOString(),
    })
  })

  // GET /mcp/servers/:id/tools — 列出工具
  mcp.get('/servers/:id/tools', async (c) => {
    const { id } = c.req.param()
    const server = await configStore.findOne(id)
    if (!server) throw new NotFoundError('MCP server', id)

    // 懒连接
    if (!mcpClient.isConnected(id)) {
      await mcpClient.connect(id, server.transport, server.config)
    }

    const tools = await mcpClient.listTools(id)
    const toolsWithServerId = tools.map((t) => ({ ...t, serverId: id }))
    return c.json({
      success: true,
      data: toolsWithServerId,
      timestamp: new Date().toISOString(),
    })
  })

  // POST /mcp/servers/:id/tools/call — 调用工具
  mcp.post('/servers/:id/tools/call', async (c) => {
    const { id } = c.req.param()
    const body = await c.req.json()
    if (!body.name) throw new ValidationError('Tool name is required')

    const server = await configStore.findOne(id)
    if (!server) throw new NotFoundError('MCP server', id)

    // 懒连接
    if (!mcpClient.isConnected(id)) {
      await mcpClient.connect(id, server.transport, server.config)
    }

    const result = await mcpClient.callTool(id, body.name, body.arguments || {})
    return c.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    })
  })

  // GET /mcp/tools — 所有启用服务器的工具
  mcp.get('/tools', async (c) => {
    const servers = await configStore.findEnabled()
    const allTools: McpToolResponse[] = []

    for (const server of servers) {
      try {
        // 懒连接
        if (!mcpClient.isConnected(server.id)) {
          await mcpClient.connect(server.id, server.transport, server.config)
        }
        const tools = await mcpClient.listTools(server.id)
        allTools.push(...tools.map((t) => ({ ...t, serverId: server.id })))
      } catch (error) {
        // 单个服务器失败不影响其他
        logger.error(`Failed to list tools for server ${server.id}: ${error}`)
      }
    }

    return c.json({
      success: true,
      data: allTools,
      timestamp: new Date().toISOString(),
    })
  })

  // POST /mcp/servers/connect-all — 批量连接所有启用的服务器
  mcp.post('/servers/connect-all', async (c) => {
    const servers = await configStore.findEnabled()
    const results: { id: string; status: string; error?: string }[] = []

    for (const server of servers) {
      try {
        if (!mcpClient.isConnected(server.id)) {
          await mcpClient.connect(server.id, server.transport, server.config)
        }
        results.push({ id: server.id, status: 'connected' })
      } catch (error) {
        results.push({
          id: server.id,
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    return c.json({
      success: true,
      data: results,
      timestamp: new Date().toISOString(),
    })
  })

  return mcp
}
