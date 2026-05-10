import type { AxiosInstance } from 'axios'
import { httpClient } from '@/api'
import { unwrapApiResponse } from '@lumina/shared'
import type {
  McpServerResponse,
  CreateMcpServerDto,
  UpdateMcpServerDto,
  McpToolResponse,
  ToolCallResult,
  ApiResponse,
} from '@lumina/shared'
import type { SidecarClient } from '@/api/sidecar'

/**
 * MCP API 路由层
 * 根据 Sidecar 可用性动态路由到本地 Sidecar 或远程后端
 */

function selectClient(
  sidecarAvailable: boolean,
  sidecarClient: SidecarClient | null,
): AxiosInstance {
  if (sidecarAvailable && sidecarClient) {
    // sidecarClient 是 SidecarClient 类型，本质上是 AxiosInstance
    return sidecarClient as AxiosInstance
  }
  return httpClient
}

export function createMcpApi(
  getSidecarState: () => { isAvailable: boolean; client: SidecarClient | null },
) {
  const client = () => {
    const state = getSidecarState()
    return selectClient(state.isAvailable, state.client)
  }

  return {
    async getServers(): Promise<McpServerResponse[]> {
      const { data } = await client().get<ApiResponse<McpServerResponse[]>>('/mcp/servers')
      return unwrapApiResponse(data)
    },

    async getServer(id: string): Promise<McpServerResponse> {
      const { data } = await client().get<ApiResponse<McpServerResponse>>(`/mcp/servers/${id}`)
      return unwrapApiResponse(data)
    },

    async createServer(dto: CreateMcpServerDto): Promise<McpServerResponse> {
      const { data } = await client().post<ApiResponse<McpServerResponse>>('/mcp/servers', dto)
      return unwrapApiResponse(data)
    },

    async updateServer(id: string, dto: UpdateMcpServerDto): Promise<McpServerResponse> {
      const { data } = await client().put<ApiResponse<McpServerResponse>>(`/mcp/servers/${id}`, dto)
      return unwrapApiResponse(data)
    },

    async deleteServer(id: string): Promise<void> {
      await client().delete(`/mcp/servers/${id}`)
    },

    async getTools(id: string): Promise<McpToolResponse[]> {
      const { data } = await client().get<ApiResponse<McpToolResponse[]>>(
        `/mcp/servers/${id}/tools`,
        { timeout: 30000 },
      )
      return unwrapApiResponse(data)
    },

    async callTool(
      id: string,
      toolName: string,
      args: Record<string, unknown>,
    ): Promise<ToolCallResult> {
      const { data } = await client().post<ApiResponse<ToolCallResult>>(
        `/mcp/servers/${id}/tools/call`,
        { name: toolName, arguments: args },
        { timeout: 60000 },
      )
      return unwrapApiResponse(data)
    },

    async connect(id: string): Promise<void> {
      await client().post(`/mcp/servers/${id}/connect`, {}, { timeout: 300000 })
    },

    async disconnect(id: string): Promise<void> {
      await client().post(`/mcp/servers/${id}/disconnect`)
    },

    async getAllTools(): Promise<McpToolResponse[]> {
      const { data } = await client().get<ApiResponse<McpToolResponse[]>>('/mcp/tools')
      return unwrapApiResponse(data)
    },
  }
}

export type McpApi = ReturnType<typeof createMcpApi>
