import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useMcpStore } from '@/features/mcp/stores/mcp'
import { mcpApi, McpTransportType, type McpServerResponse } from '@/features/mcp/api/mcp'

vi.mock('@/features/mcp/api/mcp', () => ({
  mcpApi: {
    getServers: vi.fn(),
    updateServer: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    createServer: vi.fn(),
    deleteServer: vi.fn(),
    getTools: vi.fn(),
  },
  McpTransportType: {
    STDIO: 'stdio',
    HTTP: 'http',
  },
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
    vi.mocked(mcpApi.getServers).mockResolvedValue([baseServer])
    vi.mocked(mcpApi.connect).mockResolvedValue()
    vi.mocked(mcpApi.disconnect).mockResolvedValue()
    vi.mocked(mcpApi.updateServer).mockResolvedValue({
      ...baseServer,
      config: {
        command: 'node',
        args: ['server-v2.js'],
      },
    })

    const store = useMcpStore()
    await store.fetchServers()
    vi.mocked(mcpApi.connect).mockClear()

    await store.updateServer('s1', {
      config: {
        command: 'node',
        args: ['server-v2.js'],
      },
    })

    expect(mcpApi.disconnect).toHaveBeenCalledTimes(1)
    expect(mcpApi.connect).toHaveBeenCalledTimes(1)
    expect(store.connectionStates.s1).toBe(true)
  })

  it('should disconnect after update when server becomes disabled', async () => {
    vi.mocked(mcpApi.getServers).mockResolvedValue([baseServer])
    vi.mocked(mcpApi.connect).mockResolvedValue()
    vi.mocked(mcpApi.disconnect).mockResolvedValue()
    vi.mocked(mcpApi.updateServer).mockResolvedValue({
      ...baseServer,
      enabled: false,
    })

    const store = useMcpStore()
    await store.fetchServers()
    vi.mocked(mcpApi.connect).mockClear()

    await store.updateServer('s1', { enabled: false })

    expect(mcpApi.disconnect).toHaveBeenCalledTimes(1)
    expect(mcpApi.connect).not.toHaveBeenCalled()
    expect(store.connectionStates.s1).toBe(false)
  })

  it('should connect after enabling a previously disabled server', async () => {
    const disabledServer = {
      ...baseServer,
      enabled: false,
    }
    vi.mocked(mcpApi.getServers).mockResolvedValue([disabledServer])
    vi.mocked(mcpApi.connect).mockResolvedValue()
    vi.mocked(mcpApi.disconnect).mockResolvedValue()
    vi.mocked(mcpApi.updateServer).mockResolvedValue({
      ...disabledServer,
      enabled: true,
    })

    const store = useMcpStore()
    await store.fetchServers()

    await store.updateServer('s1', { enabled: true })

    expect(mcpApi.disconnect).not.toHaveBeenCalled()
    expect(mcpApi.connect).toHaveBeenCalledTimes(1)
    expect(store.connectionStates.s1).toBe(true)
  })

  it('toggleActive should not duplicate connect/disconnect calls', async () => {
    const disabledServer = {
      ...baseServer,
      enabled: false,
    }
    vi.mocked(mcpApi.getServers).mockResolvedValue([disabledServer])
    vi.mocked(mcpApi.connect).mockResolvedValue()
    vi.mocked(mcpApi.disconnect).mockResolvedValue()
    vi.mocked(mcpApi.updateServer).mockResolvedValue({
      ...disabledServer,
      enabled: true,
    })

    const store = useMcpStore()
    await store.fetchServers()
    vi.mocked(mcpApi.connect).mockClear()

    await store.toggleActive('s1')

    expect(mcpApi.updateServer).toHaveBeenCalledWith('s1', { enabled: true })
    expect(mcpApi.connect).toHaveBeenCalledTimes(1)
    expect(mcpApi.disconnect).not.toHaveBeenCalled()
  })
})
