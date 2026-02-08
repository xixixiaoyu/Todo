import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import {
  McpTransportType,
  type StdioConfig,
  type HttpConfig,
  type McpToolResponse,
  type ToolCallResult,
} from './mcp.dto'

interface ActiveConnection {
  client: Client
  transport: Transport
  serverId: string
}

/**
 * MCP Client Service
 * 管理与 MCP Server 的连接、工具发现和调用
 */
@Injectable()
export class McpClientService implements OnModuleDestroy {
  private readonly logger = new Logger(McpClientService.name)
  private readonly connections = new Map<string, ActiveConnection>()

  async onModuleDestroy() {
    // 清理所有连接
    for (const [serverId] of this.connections) {
      await this.disconnect(serverId)
    }
  }

  /**
   * 连接到 MCP Server
   */
  async connect(
    serverId: string,
    transportType: McpTransportType,
    config: StdioConfig | HttpConfig,
  ): Promise<void> {
    // 如果已经连接，先断开
    if (this.connections.has(serverId)) {
      await this.disconnect(serverId)
    }

    const client = new Client(
      {
        name: 'todo-app-mcp-client',
        version: '1.0.0',
      },
      {
        capabilities: {},
      },
    )

    let transport: Transport

    if (transportType === McpTransportType.STDIO) {
      const stdioConfig = config as StdioConfig
      const env: Record<string, string> = {}
      if (stdioConfig.env) {
        for (const [key, value] of Object.entries(stdioConfig.env)) {
          env[key] = String(value)
        }
      }
      transport = new StdioClientTransport({
        command: stdioConfig.command,
        args: stdioConfig.args,
        env,
        cwd: stdioConfig.cwd,
      })
    } else if (transportType === McpTransportType.HTTP) {
      // HTTP Transport - 使用 Streamable HTTP
      const httpConfig = config as HttpConfig
      const headers: Record<string, string> = {}
      if (httpConfig.headers) {
        for (const [key, value] of Object.entries(httpConfig.headers)) {
          headers[key] = String(value)
        }
      }

      // 处理认证
      if (httpConfig.auth) {
        if (httpConfig.auth.type === 'bearer' && httpConfig.auth.token) {
          headers['Authorization'] = `Bearer ${httpConfig.auth.token}`
        } else if (httpConfig.auth.type === 'api_key' && httpConfig.auth.apiKey) {
          headers[httpConfig.auth.apiKeyHeader || 'X-API-Key'] = httpConfig.auth.apiKey
        }
        // OAuth 需要在调用前完成授权流程，这里假设 token 已获取
      }

      // 动态导入 StreamableHTTP transport
      const { StreamableHTTPClientTransport } =
        await import('@modelcontextprotocol/sdk/client/streamableHttp.js')

      transport = new StreamableHTTPClientTransport(new URL(httpConfig.url), {
        requestInit: {
          headers,
        },
      })
    } else {
      throw new Error(`Unsupported transport type: ${transportType}`)
    }

    try {
      await client.connect(transport)
      this.connections.set(serverId, { client, transport, serverId })
      this.logger.log(`Connected to MCP server: ${serverId}`)
    } catch (error) {
      this.logger.error(`Failed to connect to MCP server ${serverId}:`, error)
      throw error
    }
  }

  /**
   * 断开与 MCP Server 的连接
   */
  async disconnect(serverId: string): Promise<void> {
    const connection = this.connections.get(serverId)
    if (!connection) {
      return
    }

    try {
      await connection.client.close()
      this.connections.delete(serverId)
      this.logger.log(`Disconnected from MCP server: ${serverId}`)
    } catch (error) {
      this.logger.error(`Error disconnecting from MCP server ${serverId}:`, error)
      this.connections.delete(serverId)
    }
  }

  /**
   * 获取 MCP Server 提供的工具列表
   */
  async listTools(serverId: string): Promise<McpToolResponse[]> {
    const connection = this.connections.get(serverId)
    if (!connection) {
      throw new Error(`Not connected to MCP server: ${serverId}`)
    }

    const result = await connection.client.listTools()

    return result.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema as Record<string, unknown>,
    }))
  }

  /**
   * 调用 MCP Server 的工具
   */
  async callTool(
    serverId: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<ToolCallResult> {
    const connection = this.connections.get(serverId)
    if (!connection) {
      throw new Error(`Not connected to MCP server: ${serverId}`)
    }

    this.logger.debug(`Calling tool ${toolName} on server ${serverId} with args:`, args)

    const result = await connection.client.callTool({
      name: toolName,
      arguments: args,
    })

    return {
      content: result.content as ToolCallResult['content'],
      isError: !!result.isError,
    }
  }

  /**
   * 检查是否已连接到指定 Server
   */
  isConnected(serverId: string): boolean {
    return this.connections.has(serverId)
  }

  /**
   * 获取所有活跃连接的 Server ID
   */
  getActiveConnections(): string[] {
    return Array.from(this.connections.keys())
  }
}
