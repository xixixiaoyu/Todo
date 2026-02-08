import { Injectable, Logger } from '@nestjs/common'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import { McpTransportType, type StdioConfig, type HttpConfig } from '../mcp.dto'

@Injectable()
export class McpTransportFactory {
  private readonly logger = new Logger(McpTransportFactory.name)

  async createTransport(
    serverId: string,
    transportType: McpTransportType,
    config: StdioConfig | HttpConfig,
  ): Promise<Transport> {
    if (transportType === McpTransportType.STDIO) {
      return this.createStdioTransport(serverId, config as StdioConfig)
    }

    if (transportType === McpTransportType.HTTP) {
      return this.createHttpTransport(serverId, config as HttpConfig)
    }

    throw new Error(`Unsupported transport type: ${transportType}`)
  }

  private createStdioTransport(serverId: string, config: StdioConfig): Transport {
    let { command } = config
    let args = config.args || []

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

    if (config.env) {
      for (const [key, value] of Object.entries(config.env)) {
        env[key] = String(value)
      }
    }

    this.logger.log(
      `Spawning MCP server: ${command} ${args.join(' ')} (CWD: ${config.cwd || 'default'})`,
    )

    return new StdioClientTransport({
      command,
      args,
      env,
      cwd: config.cwd,
      stderr: 'pipe',
    })
  }

  private async createHttpTransport(_serverId: string, config: HttpConfig): Promise<Transport> {
    const headers: Record<string, string> = {}
    if (config.headers) {
      for (const [key, value] of Object.entries(config.headers)) {
        headers[key] = String(value)
      }
    }

    // 处理认证
    if (config.auth) {
      if (config.auth.type === 'bearer' && config.auth.token) {
        headers['Authorization'] = `Bearer ${config.auth.token}`
      } else if (config.auth.type === 'api_key' && config.auth.apiKey) {
        headers[config.auth.apiKeyHeader || 'X-API-Key'] = config.auth.apiKey
      }
    }

    // 动态导入 StreamableHTTP transport
    const { StreamableHTTPClientTransport } =
      await import('@modelcontextprotocol/sdk/client/streamableHttp.js')

    return new StreamableHTTPClientTransport(new URL(config.url), {
      requestInit: {
        headers,
      },
    })
  }
}
