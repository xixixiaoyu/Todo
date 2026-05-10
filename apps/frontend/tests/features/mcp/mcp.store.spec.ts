import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref, computed } from 'vue'
import { useMcpStore } from '@/features/mcp/stores/mcp'
import { McpTransportType } from '@lumina/shared'
import type { McpServerResponse } from '@lumina/shared'

// 在 hoisted 中创建 mock 函数以便测试中引用
const mockApiFunctions = vi.hoisted(() => ({
  getServers: vi.fn(),
  getServer: vi.fn(),
  createServer: vi.fn(),
  updateServer: vi.fn(),
  deleteServer: vi.fn(),
  getTools: vi.fn(),
  callTool: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  getAllTools: vi.fn(),
}))

vi.mock('@/composables/useSidecar', () => ({
  useSidecar: () => ({
    isAvailable: ref(false),
    sidecarPort: ref(null),
    sidecarClient: computed(() => null),
    sidecarInfo: ref(null),
    restart: vi.fn(),
  }),
}))

vi.mock('@/features/mcp/api/mcp-router', () => ({
  createMcpApi: () => mockApiFunctions,
}))

const baseServer: McpServerResponse = {
  id: 's1',
  name: 'Server 1',
  description: null,
  transport: McpTransportType.STDIO,
  config: {
    command: 'node',
    args: ['server.js'],
  },
  enabled: true,
  userId: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

describe('useMcpStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('should reconnect after runtime config update when already connected', async () => {
    mockApiFunctions.getServers.mockResolvedValue([baseServer])
    mockApiFunctions.connect.mockResolvedValue(undefined)
    mockApiFunctions.disconnect.mockResolvedValue(undefined)
    mockApiFunctions.updateServer.mockResolvedValue({
      ...baseServer,
      config: {
        command: 'node',
        args: ['server-v2.js'],
      },
    })

    const store = useMcpStore()
    await store.fetchServers()
    mockApiFunctions.connect.mockClear()

    await store.updateServer('s1', {
      config: {
        command: 'node',
        args: ['server-v2.js'],
      },
    })

    expect(mockApiFunctions.disconnect).toHaveBeenCalledTimes(1)
    expect(mockApiFunctions.connect).toHaveBeenCalledTimes(1)
    expect(store.connectionStates.s1).toBe(true)
  })

  it('should disconnect after update when server becomes disabled', async () => {
    mockApiFunctions.getServers.mockResolvedValue([baseServer])
    mockApiFunctions.connect.mockResolvedValue(undefined)
    mockApiFunctions.disconnect.mockResolvedValue(undefined)
    mockApiFunctions.updateServer.mockResolvedValue({
      ...baseServer,
      enabled: false,
    })

    const store = useMcpStore()
    await store.fetchServers()
    mockApiFunctions.connect.mockClear()

    await store.updateServer('s1', { enabled: false })

    expect(mockApiFunctions.disconnect).toHaveBeenCalledTimes(1)
    expect(mockApiFunctions.connect).not.toHaveBeenCalled()
    expect(store.connectionStates.s1).toBe(false)
  })

  it('should connect after enabling a previously disabled server', async () => {
    const disabledServer: McpServerResponse = {
      ...baseServer,
      enabled: false,
    }
    mockApiFunctions.getServers.mockResolvedValue([disabledServer])
    mockApiFunctions.connect.mockResolvedValue(undefined)
    mockApiFunctions.disconnect.mockResolvedValue(undefined)
    mockApiFunctions.updateServer.mockResolvedValue({
      ...disabledServer,
      enabled: true,
    })

    const store = useMcpStore()
    await store.fetchServers()

    await store.updateServer('s1', { enabled: true })

    expect(mockApiFunctions.disconnect).not.toHaveBeenCalled()
    expect(mockApiFunctions.connect).toHaveBeenCalledTimes(1)
    expect(store.connectionStates.s1).toBe(true)
  })

  it('toggleActive should not duplicate connect/disconnect calls', async () => {
    const disabledServer: McpServerResponse = {
      ...baseServer,
      enabled: false,
    }
    mockApiFunctions.getServers.mockResolvedValue([disabledServer])
    mockApiFunctions.connect.mockResolvedValue(undefined)
    mockApiFunctions.disconnect.mockResolvedValue(undefined)
    mockApiFunctions.updateServer.mockResolvedValue({
      ...disabledServer,
      enabled: true,
    })

    const store = useMcpStore()
    await store.fetchServers()
    mockApiFunctions.connect.mockClear()

    await store.toggleActive('s1')

    expect(mockApiFunctions.updateServer).toHaveBeenCalledWith('s1', { enabled: true })
    expect(mockApiFunctions.connect).toHaveBeenCalledTimes(1)
    expect(mockApiFunctions.disconnect).not.toHaveBeenCalled()
  })

  it('should not auto-connect enabled servers when fetchServers disables autoConnect', async () => {
    mockApiFunctions.getServers.mockResolvedValue([baseServer])
    mockApiFunctions.connect.mockResolvedValue(undefined)

    const store = useMcpStore()
    await store.fetchServers({ autoConnect: false })

    expect(mockApiFunctions.connect).not.toHaveBeenCalled()
    expect(store.connectionStates.s1).toBe(false)
    expect(store.servers).toHaveLength(1)
  })
})
