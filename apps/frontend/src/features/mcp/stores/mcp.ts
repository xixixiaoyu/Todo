import { defineStore } from 'pinia'
import { ref } from 'vue'
import { mcpApi } from '../api/mcp'
import type {
  McpServerResponse,
  CreateMcpServerDto,
  UpdateMcpServerDto,
  McpToolResponse,
} from '../api/mcp'

/**
 * MCP Store
 * 管理前端 MCP 服务器配置和状态
 */
export const useMcpStore = defineStore('mcp', () => {
  const servers = ref<McpServerResponse[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // 活跃连接状态 (serverId -> isConnected)
  const connectionStates = ref<Record<string, boolean>>({})
  // 正在连接状态 (serverId -> isConnecting)
  const connectingStates = ref<Record<string, boolean>>({})
  // 错误信息 (serverId -> errorMessage)
  const serverErrors = ref<Record<string, string | null>>({})

  function hasRuntimeConfigChanged(
    previous: McpServerResponse | undefined,
    next: McpServerResponse,
  ): boolean {
    if (!previous) return false
    if (previous.transport !== next.transport) return true
    return JSON.stringify(previous.config) !== JSON.stringify(next.config)
  }

  /**
   * 加载所有 MCP 服务器配置
   */
  async function fetchServers() {
    isLoading.value = true
    error.value = null
    try {
      const data = await mcpApi.getServers()
      servers.value = Array.isArray(data) ? data : []

      // 初始化连接状态
      if (Array.isArray(data)) {
        data.forEach((s) => {
          if (connectionStates.value[s.id] === undefined) {
            connectionStates.value[s.id] = false
          }
          if (connectingStates.value[s.id] === undefined) {
            connectingStates.value[s.id] = false
          }

          // 如果服务器是启用的但未连接，尝试自动连接
          if (s.enabled && !connectionStates.value[s.id] && !connectingStates.value[s.id]) {
            connectServer(s.id).catch((err) => {
              console.error(`Auto-connect failed for ${s.name}:`, err)
            })
          }
        })
      }
    } catch (errorOrUnknown: unknown) {
      const err = errorOrUnknown as { response?: { status?: number }; message?: string }
      error.value = err instanceof Error ? err.message : String(err)
      // 只有在非 401 错误时才打印控制台错误，避免未登录/会话过期时的冗余报错
      if (err?.response?.status !== 401 && err?.message !== 'Refresh token invalid') {
        console.error('Error fetching MCP servers:', err)
      }
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 创建 MCP 服务器配置
   */
  async function createServer(dto: CreateMcpServerDto) {
    isLoading.value = true
    try {
      const newServer = await mcpApi.createServer(dto)
      servers.value.unshift(newServer)
      connectionStates.value[newServer.id] = false
      connectingStates.value[newServer.id] = false

      // 如果创建时就是启用的，尝试连接
      if (newServer.enabled) {
        connectServer(newServer.id).catch((err) => {
          console.error('Initial connection failed:', err)
        })
      }

      return newServer
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : String(err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 更新 MCP 服务器配置
   */
  async function updateServer(id: string, dto: UpdateMcpServerDto) {
    isLoading.value = true
    try {
      const previousServer = servers.value.find((s) => s.id === id)
      const wasConnected = !!connectionStates.value[id]
      const updatedServer = await mcpApi.updateServer(id, dto)
      const index = servers.value.findIndex((s) => s.id === id)
      if (index !== -1) {
        servers.value[index] = updatedServer
      }

      if (!updatedServer.enabled) {
        if (wasConnected) {
          await disconnectServer(id)
        }
        return updatedServer
      }

      const runtimeChanged = hasRuntimeConfigChanged(previousServer, updatedServer)
      if (wasConnected && runtimeChanged) {
        await disconnectServer(id)
        await connectServer(id)
        return updatedServer
      }

      if (!wasConnected && previousServer && !previousServer.enabled && updatedServer.enabled) {
        await connectServer(id)
      }

      return updatedServer
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : String(err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 删除 MCP 服务器配置
   */
  async function deleteServer(id: string) {
    isLoading.value = true
    try {
      await mcpApi.deleteServer(id)
      servers.value = servers.value.filter((s) => s.id !== id)
      delete connectionStates.value[id]
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : String(err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 连接到 MCP 服务器
   */
  async function connectServer(id: string) {
    connectingStates.value[id] = true
    serverErrors.value[id] = null
    try {
      await mcpApi.connect(id)
      connectionStates.value[id] = true
    } catch (err: unknown) {
      connectionStates.value[id] = false
      const msg = err instanceof Error ? err.message : String(err)
      serverErrors.value[id] = msg
      throw err
    } finally {
      connectingStates.value[id] = false
    }
  }

  /**
   * 断开 MCP 服务器连接
   */
  async function disconnectServer(id: string) {
    try {
      await mcpApi.disconnect(id)
      connectionStates.value[id] = false
    } catch (err: unknown) {
      console.error(`Error disconnecting ${id}:`, err)
      connectionStates.value[id] = false
    }
  }

  /**
   * 获取工具列表 (实时)
   */
  async function getTools(id: string): Promise<McpToolResponse[]> {
    return await mcpApi.getTools(id)
  }

  /**
   * 切换服务器激活状态 (包含 Enabled 持久化 和 Connect 运行时状态)
   */
  async function toggleActive(id: string) {
    const server = servers.value.find((s) => s.id === id)
    if (!server) return

    const newEnabled = !server.enabled

    // 1. 先更新数据库持久化状态
    try {
      await updateServer(id, { enabled: newEnabled })
    } catch (err) {
      console.error('Failed to update enabled status:', err)
      return // 如果更新失败，不进行连接操作
    }

    // 2. 根据启用状态自动连接或断开
    if (newEnabled) {
      await connectServer(id)
    } else {
      await disconnectServer(id)
    }
  }

  return {
    servers,
    isLoading,
    error,
    connectionStates,
    connectingStates,
    serverErrors,
    fetchServers,
    createServer,
    updateServer,
    deleteServer,
    connectServer,
    disconnectServer,
    getTools,
    toggleActive,
  }
})
