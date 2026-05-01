import { v4 as uuidv4 } from 'uuid'
import { FileStore } from './file-store'
import type { McpServerConfig, McpServersConfig, LocalHttpConfig } from '../types'
import type { McpTransportType, StdioConfig } from '@lumina/shared'

const DEFAULT_CONFIG: McpServersConfig = { version: 1, servers: [] }

export class McpConfigStore {
  private store: FileStore<McpServersConfig>

  constructor(dataDir: string) {
    this.store = new FileStore(dataDir, 'mcp-servers.json', DEFAULT_CONFIG)
  }

  async findAll(): Promise<McpServerConfig[]> {
    const data = await this.store.read()
    return data.servers
  }

  async findOne(id: string): Promise<McpServerConfig | null> {
    const servers = await this.findAll()
    return servers.find((s) => s.id === id) || null
  }

  async findEnabled(): Promise<McpServerConfig[]> {
    const servers = await this.findAll()
    return servers.filter((s) => s.enabled)
  }

  async create(input: {
    name: string
    description?: string
    transport: McpTransportType
    config: StdioConfig | LocalHttpConfig
    enabled?: boolean
  }): Promise<McpServerConfig> {
    const data = await this.store.read()
    const now = new Date().toISOString()

    const server: McpServerConfig = {
      id: uuidv4(),
      name: input.name,
      description: input.description || null,
      transport: input.transport,
      config: input.config as McpServerConfig['config'],
      enabled: input.enabled ?? true,
      createdAt: now,
      updatedAt: now,
    }

    data.servers.push(server)
    await this.store.write(data)
    return server
  }

  async update(
    id: string,
    input: Partial<Omit<McpServerConfig, 'id' | 'createdAt'>>,
  ): Promise<McpServerConfig | null> {
    const data = await this.store.read()
    const index = data.servers.findIndex((s) => s.id === id)
    if (index === -1) return null

    const existing = data.servers[index]
    if (existing === undefined) return null

    const updated: McpServerConfig = {
      ...existing,
      ...input,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    }

    data.servers[index] = updated
    await this.store.write(data)
    return updated
  }

  async delete(id: string): Promise<boolean> {
    const data = await this.store.read()
    const index = data.servers.findIndex((s) => s.id === id)
    if (index === -1) return false

    data.servers.splice(index, 1)
    await this.store.write(data)
    return true
  }
}
