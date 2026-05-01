import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import { logger } from '../utils/logger'

export interface ActiveConnection {
  client: Client
  transport: Transport
  serverId: string
}

/**
 * MCP 连接生命周期管理
 * 移植自 backend/src/mcp/core/mcp-connection.manager.ts，去 @Injectable
 */
export class McpConnectionManager {
  private readonly connections = new Map<string, ActiveConnection>()

  async connect(serverId: string, transport: Transport): Promise<ActiveConnection> {
    if (this.connections.has(serverId)) {
      logger.info(`Server ${serverId} already connected, reconnecting...`)
      await this.disconnect(serverId)
    }

    // requestTimeout 在 SDK 类型定义中缺失，但运行时支持
    const clientOptions: ConstructorParameters<typeof Client>[1] & { requestTimeout?: number } = {
      capabilities: {},
      requestTimeout: 300_000,
    }
    const client = new Client(
      { name: 'lumina-sidecar-mcp-client', version: '1.0.0' },
      clientOptions as ConstructorParameters<typeof Client>[1],
    )

    try {
      const connectPromise = client.connect(transport)

      if (transport instanceof StdioClientTransport) {
        transport.stderr?.on('data', (chunk: Buffer) => {
          const msg = chunk.toString()
          logger.error(`MCP Server (${serverId}) stderr: ${msg}`)
        })

        transport.onclose = () => {
          logger.warn(`MCP Server (${serverId}) connection closed by remote/process`)
          this.connections.delete(serverId)
        }

        transport.onerror = (error: Error) => {
          logger.error(`MCP Server (${serverId}) transport error: ${error.message}`)
        }
      }

      await connectPromise

      const connection: ActiveConnection = { client, transport, serverId }
      this.connections.set(serverId, connection)
      logger.info(`Connected to MCP server: ${serverId}`)

      return connection
    } catch (error) {
      logger.error(
        `Failed to connect to MCP server ${serverId}: ${error instanceof Error ? error.message : String(error)}`,
      )
      throw error
    }
  }

  async disconnect(serverId: string): Promise<void> {
    const connection = this.connections.get(serverId)
    if (!connection) return

    try {
      await connection.client.close()
      this.connections.delete(serverId)
      logger.info(`Disconnected from MCP server: ${serverId}`)
    } catch (error) {
      logger.error(`Error disconnecting from MCP server ${serverId}: ${error}`)
      this.connections.delete(serverId)
    }
  }

  async disconnectAll(): Promise<void> {
    for (const [serverId] of this.connections) {
      await this.disconnect(serverId)
    }
  }

  getConnection(serverId: string): ActiveConnection | undefined {
    return this.connections.get(serverId)
  }

  hasConnection(serverId: string): boolean {
    return this.connections.has(serverId)
  }

  getAllServerIds(): string[] {
    return Array.from(this.connections.keys())
  }

  getConnectionCount(): number {
    return this.connections.size
  }
}
