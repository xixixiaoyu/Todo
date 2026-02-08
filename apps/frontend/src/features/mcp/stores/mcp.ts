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

  /**
   * 加载所有 MCP 服务器配置
   */
  async function fetchServers() {
    isLoading.value = true
    error.value = null
    try {
      const data = await mcpApi.getServers()
      servers.value = Array.isArray(data) ? data : []

      // 初始化连接状态 (假设初始都未连接，或者后端有状态接口)
      // 这里暂时简单处理
      if (Array.isArray(data)) {
        data.forEach((s) => {
          if (connectionStates.value[s.id] === undefined) {
            connectionStates.value[s.id] = false
          }
        })
      }
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : String(err)
      console.error('Error fetching MCP servers:', err)
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
      const updatedServer = await mcpApi.updateServer(id, dto)
      const index = servers.value.findIndex((s) => s.id === id)
      if (index !== -1) {
        servers.value[index] = updatedServer
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
    try {
      await mcpApi.connect(id)
      connectionStates.value[id] = true
    } catch (err: unknown) {
      connectionStates.value[id] = false
      throw err
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

  return {
    servers,
    isLoading,
    error,
    connectionStates,
    fetchServers,
    createServer,
    updateServer,
    deleteServer,
    connectServer,
    disconnectServer,
    getTools,
  }
})
