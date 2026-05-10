import { Injectable, Logger } from '@nestjs/common'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import { lookup } from 'node:dns/promises'
import { basename } from 'node:path'
import { isIP } from 'node:net'
import { McpTransportType, type StdioConfig, type HttpConfig } from '../mcp.dto'

@Injectable()
export class McpTransportFactory {
  private readonly logger = new Logger(McpTransportFactory.name)

  private isPrivateOrLoopbackIpv4(ip: string): boolean {
    const parts = ip.split('.')
    if (parts.length !== 4 || !parts.every((p) => /^\d+$/.test(p))) return false

    const [a, b] = parts as [string, string, string, string]
    const na = Number(a),
      nb = Number(b)
    if (na === 10 || na === 127 || na === 0) return true
    if (na === 169 && nb === 254) return true
    if (na === 172 && nb >= 16 && nb <= 31) return true
    if (na === 192 && nb === 168) return true
    return false
  }

  private isPrivateOrLoopbackIpv6(ip: string): boolean {
    const normalized = ip.toLowerCase()
    if (normalized === '::1') return true
    if (normalized.startsWith('fe80:')) return true
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true
    return false
  }

  private isBlockedHostname(hostname: string): boolean {
    const normalized = hostname.toLowerCase()
    if (
      normalized === 'localhost' ||
      normalized.endsWith('.localhost') ||
      normalized.endsWith('.local')
    ) {
      return true
    }

    const ipType = isIP(normalized)
    if (ipType === 4) {
      return this.isPrivateOrLoopbackIpv4(normalized)
    }
    if (ipType === 6) {
      return this.isPrivateOrLoopbackIpv6(normalized)
    }
    return false
  }

  private isBlockedIpAddress(address: string): boolean {
    const ipType = isIP(address)
    if (ipType === 4) return this.isPrivateOrLoopbackIpv4(address)
    if (ipType === 6) return this.isPrivateOrLoopbackIpv6(address)
    return false
  }

  private parseAllowedCommands(raw: string | undefined): string[] {
    return (raw || '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
  }

  private ensureStdioTransportAllowed(command: string): void {
    const nodeEnv = process.env.NODE_ENV || 'development'
    const stdioEnabled = process.env.MCP_ENABLE_STDIO === 'true' || nodeEnv !== 'production'

    if (!stdioEnabled) {
      throw new Error('MCP stdio transport is disabled in current environment')
    }

    const allowedCommands = this.parseAllowedCommands(process.env.MCP_STDIO_ALLOWED_COMMANDS)
    if (nodeEnv === 'production' && allowedCommands.length === 0) {
      throw new Error('MCP_STDIO_ALLOWED_COMMANDS must be configured in production')
    }

    if (allowedCommands.length === 0) {
      return
    }

    const commandBase = basename(command)
    const isAllowed = allowedCommands.includes(command) || allowedCommands.includes(commandBase)
    if (!isAllowed) {
      throw new Error(`MCP stdio command is not allowlisted: ${command}`)
    }
  }

  private async assertHttpEndpointSafe(url: string): Promise<void> {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`Unsupported MCP HTTP protocol: ${parsed.protocol}`)
    }

    const hostname = parsed.hostname.toLowerCase()
    if (this.isBlockedHostname(hostname)) {
      throw new Error(`Blocked MCP HTTP host: ${hostname}`)
    }

    const resolved = await lookup(hostname, { all: true, verbatim: true })
    if (resolved.length === 0) {
      throw new Error(`Unable to resolve MCP HTTP host: ${hostname}`)
    }

    if (resolved.some((record) => this.isBlockedIpAddress(record.address))) {
      throw new Error(`Blocked MCP HTTP host resolution: ${hostname}`)
    }
  }

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
    const command = config.command.trim()
    const args = config.args || []

    if (command.includes(' ')) {
      throw new Error('MCP stdio command must not include spaces, please pass args separately')
    }

    this.ensureStdioTransportAllowed(command)

    // 包名纠错：处理 @upstash/context7 -> @upstash/context7-mcp
    const normalizedArgs = args.map((arg) => {
      if (arg === '@upstash/context7') {
        this.logger.warn(`Correcting package name: @upstash/context7 -> @upstash/context7-mcp`)
        return '@upstash/context7-mcp'
      }
      return arg
    })

    const env: Record<string, string> = {}

    const allowedKeys = [
      'PATH',
      'HOME',
      'USER',
      'SHELL',
      'TMPDIR',
      'TEMP',
      'TMP',
      'LANG',
      'LC_ALL',
      'NODE_ENV',
      'NODE_OPTIONS',
      'HTTP_PROXY',
      'HTTPS_PROXY',
      'NO_PROXY',
    ]

    for (const key of allowedKeys) {
      const value = process.env[key]
      if (value !== undefined) env[key] = value
    }

    if (config.env) {
      for (const [key, value] of Object.entries(config.env)) {
        env[key] = String(value)
      }
    }

    this.logger.log(
      `Spawning MCP server: ${command} (args: ${normalizedArgs.length}) (CWD: ${config.cwd || 'default'})`,
    )

    return new StdioClientTransport({
      command,
      args: normalizedArgs,
      env,
      cwd: config.cwd,
      stderr: 'pipe',
    })
  }

  private async createHttpTransport(_serverId: string, config: HttpConfig): Promise<Transport> {
    await this.assertHttpEndpointSafe(config.url)

    const headers: Record<string, string> = {}
    if (config.headers) {
      for (const [key, value] of Object.entries(config.headers)) {
        headers[key] = String(value)
      }
    }

    // 处理认证
    if (config.auth) {
      if ((config.auth.type === 'bearer' || config.auth.type === 'oauth') && config.auth.token) {
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
