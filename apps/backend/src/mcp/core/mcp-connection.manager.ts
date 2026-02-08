import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'

export interface ActiveConnection {
  client: Client
  transport: Transport
  serverId: string
}

@Injectable()
export class McpConnectionManager implements OnModuleDestroy {
  private readonly logger = new Logger(McpConnectionManager.name)
  private readonly connections = new Map<string, ActiveConnection>()

  async onModuleDestroy() {
    for (const [serverId] of this.connections) {
      await this.disconnect(serverId)
    }
  }

  async connect(serverId: string, transport: Transport): Promise<ActiveConnection> {
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

    try {
      const connectPromise = client.connect(transport)

      if (transport instanceof StdioClientTransport) {
        transport.stderr?.on('data', (chunk) => {
          const msg = chunk.toString()
          this.logger.error(`MCP Server (${serverId}) stderr: ${msg}`)
        })

        transport.onclose = () => {
          this.logger.warn(`MCP Server (${serverId}) connection closed by remote/process`)
          this.connections.delete(serverId)
        }

        transport.onerror = (error) => {
          this.logger.error(`MCP Server (${serverId}) transport error: ${error.message}`)
        }
      }

      await connectPromise

      const connection: ActiveConnection = { client, transport, serverId }
      this.connections.set(serverId, connection)
      this.logger.log(`Connected to MCP server: ${serverId}`)

      return connection
    } catch (error) {
      this.logger.error(
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
      this.logger.log(`Disconnected from MCP server: ${serverId}`)
    } catch (error) {
      this.logger.error(`Error disconnecting from MCP server ${serverId}:`, error)
      this.connections.delete(serverId)
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
}
