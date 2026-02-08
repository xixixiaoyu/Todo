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
  private readonly toolRegistry = new Map<string, McpToolResponse[]>()

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
      this.logger.log(`Server ${serverId} is already connected, reconnecting...`)
      await this.disconnect(serverId)
    }

    const client = new Client(
      {
        name: 'todo-app-mcp-client',
        version: '1.0.0',
      },
      {
        capabilities: {},
        // @ts-expect-error - requestTimeout exists in some versions of SDK options
        requestTimeout: 300000,
      },
    )

    let transport: Transport

    if (transportType === McpTransportType.STDIO) {
      const stdioConfig = config as StdioConfig
      let command = stdioConfig.command
      let args = stdioConfig.args || []

      // 后端兜底：如果没传参数但命令包含空格，尝试智能分割
      if (args.length === 0 && command.trim().includes(' ')) {
        const parts = command.trim().split(/\s+/)
        command = parts[0]
        args = parts.slice(1)
        this.logger.warn(
          `Auto-splitting command with spaces for ${serverId}: ${command} [${args.join(', ')}]`,
        )
      }

      // 包名纠错：处理 @upstash/context7 -> @upstash/context7-mcp
      args = args.map((arg) => {
        if (arg === '@upstash/context7') {
          this.logger.warn(`Correcting package name: @upstash/context7 -> @upstash/context7-mcp`)
          return '@upstash/context7-mcp'
        }
        return arg
      })

      const env: Record<string, string> = {}
      // 复制当前环境变量，并确保值不为 undefined
      Object.entries(process.env).forEach(([key, value]) => {
        if (value !== undefined) env[key] = value
      })

      if (stdioConfig.env) {
        for (const [key, value] of Object.entries(stdioConfig.env)) {
          env[key] = String(value)
        }
      }

      this.logger.log(
        `Spawning MCP server: ${command} ${args.join(' ')} (CWD: ${stdioConfig.cwd || 'default'})`,
      )

      transport = new StdioClientTransport({
        command,
        args,
        env,
        cwd: stdioConfig.cwd,
        stderr: 'pipe',
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
      // 实际上 client.connect 内部会调用 initialize
      const connectPromise = client.connect(transport)

      // 如果是 Stdio 传输，监听 stderr 以捕获错误信息
      if (transport instanceof StdioClientTransport) {
        transport.stderr?.on('data', (chunk) => {
          const msg = chunk.toString()
          this.logger.error(`MCP Server (${serverId}) stderr: ${msg}`)
        })
        // 增加退出监听
        transport.onclose = () => {
          this.logger.warn(`MCP Server (${serverId}) connection closed by remote/process`)
          this.connections.delete(serverId)
          this.toolRegistry.delete(serverId)
        }
        transport.onerror = (error) => {
          this.logger.error(`MCP Server (${serverId}) transport error: ${error.message}`)
        }
      }

      await connectPromise

      this.connections.set(serverId, { client, transport, serverId })
      this.logger.log(`Connected to MCP server: ${serverId}`)

      // 立即拉取并缓存工具列表，确保 Registry 就绪
      await this.refreshToolRegistry(serverId)
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error(
          `Failed to connect to MCP server ${serverId}: ${error.message}`,
          error.stack,
        )
        if (error.message?.includes('timed out')) {
          this.logger.error(
            `Connection timeout often happens if the MCP server (especially via npx) takes too long to start or initialize.`,
          )
        }
      } else {
        this.logger.error(`Failed to connect to MCP server ${serverId}: ${String(error)}`)
      }
      throw error
    }
  }

  /**
   * 刷新工具注册表
   */
  private async refreshToolRegistry(serverId: string): Promise<void> {
    const connection = this.connections.get(serverId)
    if (!connection) return

    try {
      const result = await connection.client.listTools()
      const tools = result.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema as Record<string, unknown>,
      }))
      this.toolRegistry.set(serverId, tools)
      this.logger.log(`Registered ${tools.length} tools for server: ${serverId}`)
    } catch (error) {
      this.logger.error(`Failed to refresh tools for server ${serverId}:`, error)
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
      // 显式清理注册表
      this.toolRegistry.delete(serverId)

      // 关闭连接
      await connection.client.close()

      // 如果是 stdio，确保 transport 也被销毁（SDK 通常会处理，但这里增加显式清理逻辑）
      if (connection.transport instanceof StdioClientTransport) {
        // transport.onclose 会被触发并执行 connections.delete
      }

      this.connections.delete(serverId)
      this.logger.log(`Disconnected from MCP server: ${serverId}`)
    } catch (error) {
      this.logger.error(`Error disconnecting from MCP server ${serverId}:`, error)
      this.connections.delete(serverId)
      this.toolRegistry.delete(serverId)
    }
  }

  /**
   * 获取 MCP Server 提供的工具列表
   */
  async listTools(serverId: string): Promise<McpToolResponse[]> {
    // 优先从注册表缓存获取，如果没有则尝试从连接获取并更新注册表
    if (this.toolRegistry.has(serverId)) {
      return this.toolRegistry.get(serverId)!
    }

    const connection = this.connections.get(serverId)
    if (!connection) {
      throw new Error(`Not connected to MCP server: ${serverId}`)
    }

    await this.refreshToolRegistry(serverId)
    return this.toolRegistry.get(serverId) || []
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
      const activeIds = Array.from(this.connections.keys())
      this.logger.error(
        `Tool call failed: Server ${serverId} not found in active connections. Active servers: [${activeIds.join(', ')}]`,
      )
      throw new Error(`Not connected to MCP server: ${serverId}`)
    }

    this.logger.debug(
      `Calling tool "${toolName}" on server "${serverId}" (Total tools available: unknown)`,
    )

    try {
      // 在调用前，可以先检查工具是否存在（可选，但有助于调试）
      const tools = await this.listTools(serverId)
      const toolExists = tools.some((t) => t.name === toolName)

      if (!toolExists) {
        this.logger.error(
          `Tool "${toolName}" not found on server "${serverId}". Available tools: [${tools.map((t) => t.name).join(', ')}]`,
        )
        throw new Error(`Tool "${toolName}" not found on server "${serverId}"`)
      }

      this.logger.log(`Executing tool "${toolName}" on server "${serverId}"...`)

      const result = await connection.client.callTool({
        name: toolName,
        arguments: args,
      })

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
    return this.connections.has(serverId)
  }

  /**
   * 获取所有活跃连接的 Server ID
   */
  getActiveConnections(): string[] {
    return Array.from(this.connections.keys())
  }
}
