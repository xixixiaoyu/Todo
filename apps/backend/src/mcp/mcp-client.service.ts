import { Injectable, Logger, Inject } from '@nestjs/common'
import {
  McpTransportType,
  type StdioConfig,
  type HttpConfig,
  type McpToolResponse,
  type ToolCallResult,
} from './mcp.dto'
import { McpTransportFactory } from './core/mcp-transport.factory'
import { McpConnectionManager } from './core/mcp-connection.manager'
import { McpToolRegistry } from './core/mcp-tool.registry'

/** MCP 工具调用超时（2 分钟），防止 MCP 服务卡死导致请求永久阻塞 */
const MCP_TOOL_CALL_TIMEOUT_MS = 120_000

/**
 * MCP Client Service
 * 门面类：统一管理与 MCP Server 的交互
 */
@Injectable()
export class McpClientService {
  private readonly logger = new Logger(McpClientService.name)

  constructor(
    @Inject(McpTransportFactory)
    private readonly transportFactory: McpTransportFactory,
    @Inject(McpConnectionManager)
    private readonly connectionManager: McpConnectionManager,
    @Inject(McpToolRegistry)
    private readonly toolRegistry: McpToolRegistry,
  ) {}

  /**
   * 连接到 MCP Server
   */
  async connect(
    serverId: string,
    transportType: McpTransportType,
    config: StdioConfig | HttpConfig,
  ): Promise<void> {
    try {
      const transport = await this.transportFactory.createTransport(serverId, transportType, config)
      await this.connectionManager.connect(serverId, transport)
      // 连接成功后，预热工具注册表
      await this.toolRegistry.refreshTools(serverId)
    } catch (error) {
      this.logger.error(`Failed to connect to MCP server ${serverId}:`, error)
      throw error
    }
  }

  /**
   * 断开与 MCP Server 的连接
   */
  async disconnect(serverId: string): Promise<void> {
    this.toolRegistry.clearCache(serverId)
    await this.connectionManager.disconnect(serverId)
  }

  /**
   * 获取 MCP Server 提供的工具列表
   */
  async listTools(serverId: string): Promise<McpToolResponse[]> {
    if (!this.connectionManager.hasConnection(serverId)) {
      throw new Error(`Not connected to MCP server: ${serverId}`)
    }
    return this.toolRegistry.getTools(serverId)
  }

  /**
   * 调用 MCP Server 的工具
   */
  async callTool(
    serverId: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<ToolCallResult> {
    const connection = this.connectionManager.getConnection(serverId)
    if (!connection) {
      throw new Error(`Not connected to MCP server: ${serverId}`)
    }

    try {
      // 检查工具是否存在
      const tools = await this.listTools(serverId)
      const toolExists = tools.some((t) => t.name === toolName)

      if (!toolExists) {
        throw new Error(`Tool "${toolName}" not found on server "${serverId}"`)
      }

      this.logger.log(`Executing tool "${toolName}" on server "${serverId}"...`)

      let timeoutId: ReturnType<typeof setTimeout> | undefined
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`MCP tool call timed out after 120s`))
        }, MCP_TOOL_CALL_TIMEOUT_MS)
      })

      const result = await Promise.race([
        connection.client.callTool({
          name: toolName,
          arguments: args,
        }),
        timeoutPromise,
      ])
      clearTimeout(timeoutId)

      this.logger.log(`Successfully executed tool "${toolName}" on server "${serverId}"`)

      return {
        content: result.content as ToolCallResult['content'],
        isError: !!result.isError,
      }
    } catch (error) {
      this.logger.error(
        `Error calling tool "${toolName}" on server "${serverId}": ${error instanceof Error ? error.message : String(error)}`,
      )
      throw error
    }
  }

  /**
   * 检查是否已连接到指定 Server
   */
  isConnected(serverId: string): boolean {
    return this.connectionManager.hasConnection(serverId)
  }

  /**
   * 获取所有活跃连接的 Server ID
   */
  getActiveConnections(): string[] {
    return this.connectionManager.getAllServerIds()
  }
}
