import type { McpTransportType, StdioConfig, McpToolResponse, ToolCallResult } from '@lumina/shared'
import type { LocalHttpConfig } from '../types'
import type { WorkspaceStore } from '../store/workspace-store'
import { McpConnectionManager } from './connection-manager'
import { McpToolRegistry } from './tool-registry'
import { McpTransportFactory } from './transport-factory'

/**
 * MCP Client 门面 — 组合 connection-manager + tool-registry + transport-factory
 * 提供与后端 McpClientService 一致的公开 API
 */
export class McpClient {
  private readonly connectionManager: McpConnectionManager
  private readonly toolRegistry: McpToolRegistry
  private readonly transportFactory: McpTransportFactory

  constructor(workspaceStore: WorkspaceStore) {
    this.connectionManager = new McpConnectionManager()
    this.toolRegistry = new McpToolRegistry(this.connectionManager)
    this.transportFactory = new McpTransportFactory(workspaceStore)
  }

  async connect(
    serverId: string,
    transportType: McpTransportType,
    config: StdioConfig | LocalHttpConfig,
  ): Promise<void> {
    const transport = await this.transportFactory.createTransport(serverId, transportType, config)
    await this.connectionManager.connect(serverId, transport)
  }

  async disconnect(serverId: string): Promise<void> {
    await this.connectionManager.disconnect(serverId)
    this.toolRegistry.clearCache(serverId)
  }

  async disconnectAll(): Promise<void> {
    await this.connectionManager.disconnectAll()
    this.toolRegistry.clearAllCache()
  }

  isConnected(serverId: string): boolean {
    return this.connectionManager.hasConnection(serverId)
  }

  getActiveConnectionCount(): number {
    return this.connectionManager.getConnectionCount()
  }

  async listTools(serverId: string): Promise<McpToolResponse[]> {
    if (!this.connectionManager.hasConnection(serverId)) {
      return []
    }
    return this.toolRegistry.getTools(serverId)
  }

  async refreshTools(serverId: string): Promise<McpToolResponse[]> {
    return this.toolRegistry.refreshTools(serverId)
  }

  async callTool(
    serverId: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<ToolCallResult> {
    const connection = this.connectionManager.getConnection(serverId)
    if (!connection) {
      throw new Error(`MCP server ${serverId} is not connected`)
    }

    // 验证工具是否存在于缓存
    const tools = await this.toolRegistry.getTools(serverId)
    const toolExists = tools.some((t) => t.name === toolName)
    if (!toolExists) {
      // 尝试刷新一次
      const refreshed = await this.toolRegistry.refreshTools(serverId)
      if (!refreshed.some((t) => t.name === toolName)) {
        throw new Error(`Tool "${toolName}" not found on server ${serverId}`)
      }
    }

    const result = await connection.client.callTool({
      name: toolName,
      arguments: args,
    })

    return result as unknown as ToolCallResult
  }
}
