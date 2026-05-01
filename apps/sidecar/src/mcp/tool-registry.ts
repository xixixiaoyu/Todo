import type { McpToolResponse } from '@lumina/shared'
import { McpConnectionManager } from './connection-manager'
import { logger } from '../utils/logger'

/**
 * MCP 工具发现与缓存
 * 移植自 backend/src/mcp/core/mcp-tool.registry.ts，去 @Injectable
 */
export class McpToolRegistry {
  private readonly toolCache = new Map<string, McpToolResponse[]>()

  constructor(private readonly connectionManager: McpConnectionManager) {}

  async getTools(serverId: string): Promise<McpToolResponse[]> {
    if (this.toolCache.has(serverId)) {
      return this.toolCache.get(serverId)!
    }
    return this.refreshTools(serverId)
  }

  async refreshTools(serverId: string): Promise<McpToolResponse[]> {
    const connection = this.connectionManager.getConnection(serverId)
    if (!connection) {
      this.toolCache.delete(serverId)
      return []
    }

    try {
      const result = await connection.client.listTools()
      const tools: McpToolResponse[] = result.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema as Record<string, unknown>,
      }))

      this.toolCache.set(serverId, tools)
      logger.info(`Registered ${tools.length} tools for server: ${serverId}`)
      return tools
    } catch (error) {
      logger.error(`Failed to refresh tools for server ${serverId}: ${error}`)
      return this.toolCache.get(serverId) || []
    }
  }

  clearCache(serverId: string): void {
    this.toolCache.delete(serverId)
  }

  clearAllCache(): void {
    this.toolCache.clear()
  }
}
