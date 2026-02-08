import httpClient from '@/api'
export * from '@my-app/shared'
import {
  type McpServerResponse,
  type CreateMcpServerDto,
  type UpdateMcpServerDto,
  type McpToolResponse,
  type ToolCallResult,
} from '@my-app/shared'

/**
 * MCP API 服务
 */
export const mcpApi = {
  /**
   * 获取所有 MCP Server 配置
   */
  async getServers(): Promise<McpServerResponse[]> {
    const { data } = await httpClient.get<McpServerResponse[]>('/mcp/servers')
    return data
  },

  /**
   * 获取单个 MCP Server 配置
   */
  async getServer(id: string): Promise<McpServerResponse> {
    const { data } = await httpClient.get<McpServerResponse>(`/mcp/servers/${id}`)
    return data
  },

  /**
   * 创建 MCP Server 配置
   */
  async createServer(dto: CreateMcpServerDto): Promise<McpServerResponse> {
    const { data } = await httpClient.post<McpServerResponse>('/mcp/servers', dto)
    return data
  },

  /**
   * 更新 MCP Server 配置
   */
  async updateServer(id: string, dto: UpdateMcpServerDto): Promise<McpServerResponse> {
    const { data } = await httpClient.put<McpServerResponse>(`/mcp/servers/${id}`, dto)
    return data
  },

  /**
   * 删除 MCP Server 配置
   */
  async deleteServer(id: string): Promise<void> {
    await httpClient.delete(`/mcp/servers/${id}`)
  },

  /**
   * 获取 MCP Server 提供的工具列表
   */
  async getTools(id: string): Promise<McpToolResponse[]> {
    const { data } = await httpClient.get<McpToolResponse[]>(`/mcp/servers/${id}/tools`)
    return data
  },

  /**
   * 调用 MCP Server 的工具
   */
  async callTool(
    id: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<ToolCallResult> {
    const { data } = await httpClient.post<ToolCallResult>(`/mcp/servers/${id}/tools/call`, {
      name: toolName,
      arguments: args,
    })
    return data
  },

  /**
   * 连接到 MCP Server
   */
  async connect(id: string): Promise<void> {
    await httpClient.post(`/mcp/servers/${id}/connect`)
  },

  /**
   * 断开与 MCP Server 的连接
   */
  async disconnect(id: string): Promise<void> {
    await httpClient.post(`/mcp/servers/${id}/disconnect`)
  },

  /**
   * 获取所有启用的 MCP Server 工具列表 (用于 AI 辅助)
   */
  async getAllTools(): Promise<McpToolResponse[]> {
    const { data } = await httpClient.get<McpToolResponse[]>('/mcp/tools')
    return data
  },
}
