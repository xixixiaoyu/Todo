import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { McpConfigStore } from '../../src/store/mcp-config-store'
import { McpTransportType } from '@lumina/shared'

describe('McpConfigStore', () => {
  let testDir: string

  beforeEach(async () => {
    testDir = join(tmpdir(), `lumina-mcp-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    await mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  describe('findAll', () => {
    it('新 store 返回空数组', async () => {
      const store = new McpConfigStore(testDir)
      const servers = await store.findAll()
      expect(servers).toEqual([])
    })
  })

  describe('create', () => {
    it('创建新服务器并返回完整配置', async () => {
      const store = new McpConfigStore(testDir)
      const server = await store.create({
        name: 'Test Server',
        transport: McpTransportType.STDIO,
        config: { command: 'node', args: ['test.js'] },
      })

      expect(server.id).toBeDefined()
      expect(server.name).toBe('Test Server')
      expect(server.transport).toBe(McpTransportType.STDIO)
      expect(server.enabled).toBe(true)
      expect(server.createdAt).toBeDefined()
      expect(server.updatedAt).toBeDefined()
    })

    it('创建的服务器可通过 findAll 找到', async () => {
      const store = new McpConfigStore(testDir)
      await store.create({
        name: 'S1',
        transport: McpTransportType.STDIO,
        config: { command: 'node' },
      })
      await store.create({
        name: 'S2',
        transport: McpTransportType.HTTP,
        config: { url: 'http://localhost:8080' },
      })

      const servers = await store.findAll()
      expect(servers.length).toBe(2)
      expect(servers.map((s) => s.name)).toEqual(['S1', 'S2'])
    })
  })

  describe('findOne', () => {
    it('按 ID 查找服务器', async () => {
      const store = new McpConfigStore(testDir)
      const created = await store.create({
        name: 'Target',
        transport: McpTransportType.STDIO,
        config: { command: 'node' },
      })

      const found = await store.findOne(created.id)
      expect(found).toEqual(created)
    })

    it('不存在的 ID 返回 null', async () => {
      const store = new McpConfigStore(testDir)
      const found = await store.findOne('nonexistent')
      expect(found).toBeNull()
    })
  })

  describe('findEnabled', () => {
    it('只返回启用的服务器', async () => {
      const store = new McpConfigStore(testDir)
      await store.create({
        name: 'Enabled',
        transport: McpTransportType.STDIO,
        config: { command: 'node' },
        enabled: true,
      })
      await store.create({
        name: 'Disabled',
        transport: McpTransportType.STDIO,
        config: { command: 'node' },
        enabled: false,
      })

      const enabled = await store.findEnabled()
      expect(enabled.length).toBe(1)
      expect(enabled[0]!.name).toBe('Enabled')
    })
  })

  describe('update', () => {
    it('更新服务器配置', async () => {
      const store = new McpConfigStore(testDir)
      const created = await store.create({
        name: 'Old Name',
        transport: McpTransportType.STDIO,
        config: { command: 'node' },
      })

      const updated = await store.update(created.id, { name: 'New Name' })
      expect(updated).not.toBeNull()
      expect(updated!.name).toBe('New Name')
      expect(updated!.id).toBe(created.id)
      expect(updated!.createdAt).toBe(created.createdAt)
    })

    it('更新不存在的 ID 返回 null', async () => {
      const store = new McpConfigStore(testDir)
      const result = await store.update('nonexistent', { name: 'Ghost' })
      expect(result).toBeNull()
    })
  })

  describe('delete', () => {
    it('删除存在的服务器返回 true', async () => {
      const store = new McpConfigStore(testDir)
      const created = await store.create({
        name: 'To Delete',
        transport: McpTransportType.STDIO,
        config: { command: 'node' },
      })

      const deleted = await store.delete(created.id)
      expect(deleted).toBe(true)

      const servers = await store.findAll()
      expect(servers.length).toBe(0)
    })

    it('删除不存在的 ID 返回 false', async () => {
      const store = new McpConfigStore(testDir)
      const result = await store.delete('nonexistent')
      expect(result).toBe(false)
    })
  })

  describe('持久化', () => {
    it('重新创建 store 实例后数据保持', async () => {
      const store1 = new McpConfigStore(testDir)
      const created = await store1.create({
        name: 'Persistent',
        transport: McpTransportType.STDIO,
        config: { command: 'node' },
      })

      const store2 = new McpConfigStore(testDir)
      const servers = await store2.findAll()

      expect(servers.length).toBe(1)
      expect(servers[0]).toEqual(created)
    })
  })
})
