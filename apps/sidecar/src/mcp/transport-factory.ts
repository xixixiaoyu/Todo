import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import { McpTransportType, type StdioConfig } from '@lumina/shared'
import type { LocalHttpConfig } from '../types'
import type { WorkspaceStore } from '../store/workspace-store'
import { assertPathAllowed } from '../security/workspace-guard'
import { logger } from '../utils/logger'

/**
 * MCP Transport 工厂 — 桌面端适配
 * 移植自 backend/src/mcp/core/mcp-transport.factory.ts
 *
 * 关键差异：
 * - 允许 localhost / private IP（桌面场景，用户即 admin）
 * - 允许任意 stdio 命令（无白名单限制）
 * - 保留 env 过滤（防御性，非安全关键）
 * - **cwd 必须落在 WorkspaceStore 维护的白名单内**
 */
export class McpTransportFactory {
  constructor(private readonly workspaceStore: WorkspaceStore) {}

  async createTransport(
    serverId: string,
    transportType: McpTransportType,
    config: StdioConfig | LocalHttpConfig,
  ): Promise<Transport> {
    if (transportType === McpTransportType.STDIO) {
      return this.createStdioTransport(serverId, config as StdioConfig)
    }

    if (transportType === McpTransportType.HTTP) {
      return this.createHttpTransport(serverId, config as LocalHttpConfig)
    }

    throw new Error(`Unsupported transport type: ${transportType}`)
  }

  private async createStdioTransport(serverId: string, config: StdioConfig): Promise<Transport> {
    const command = config.command.trim()
    const args = config.args || []

    if (command.includes(' ')) {
      throw new Error('MCP stdio command must not include spaces, please pass args separately')
    }

    // cwd 沙箱校验：仅允许起动在白名单内的子目录
    if (config.cwd) {
      const roots = await this.workspaceStore.getRoots()
      assertPathAllowed(config.cwd, roots, 'MCP stdio cwd')
    }

    // 包名纠错：@upstash/context7 -> @upstash/context7-mcp
    const normalizedArgs = args.map((arg) => {
      if (arg === '@upstash/context7') {
        logger.warn('Correcting package name: @upstash/context7 -> @upstash/context7-mcp')
        return '@upstash/context7-mcp'
      }
      return arg
    })

    // 桌面端：允许任意 stdio 命令（无白名单限制）
    // 仅过滤传递给子进程的环境变量
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

    logger.info(
      `Spawning MCP server (${serverId}): ${command} (args: ${normalizedArgs.length}) (CWD: ${config.cwd || 'default'})`,
    )

    return new StdioClientTransport({
      command,
      args: normalizedArgs,
      env,
      cwd: config.cwd,
      stderr: 'pipe',
    })
  }

  private async createHttpTransport(
    _serverId: string,
    config: LocalHttpConfig,
  ): Promise<Transport> {
    // 桌面端：不拦截 localhost / private IP
    // 仅验证 URL 格式和协议
    let parsed: URL
    try {
      parsed = new URL(config.url)
    } catch {
      throw new Error(`Invalid MCP HTTP URL: ${config.url}`)
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`Unsupported MCP HTTP protocol: ${parsed.protocol}`)
    }

    const headers: Record<string, string> = {}
    if (config.headers) {
      for (const [key, value] of Object.entries(config.headers)) {
        headers[key] = String(value)
      }
    }

    if (config.auth) {
      if ((config.auth.type === 'bearer' || config.auth.type === 'oauth') && config.auth.token) {
        headers['Authorization'] = `Bearer ${config.auth.token}`
      } else if (config.auth.type === 'api_key' && config.auth.apiKey) {
        headers[config.auth.apiKeyHeader || 'X-API-Key'] = config.auth.apiKey
      }
    }

    const { StreamableHTTPClientTransport } =
      await import('@modelcontextprotocol/sdk/client/streamableHttp.js')

    return new StreamableHTTPClientTransport(new URL(config.url), {
      requestInit: { headers },
    })
  }
}
