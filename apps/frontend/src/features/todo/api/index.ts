import { httpClient } from '@/api'
import type { SyncMergeRequest, SyncResponse, Todo, ApiResponse } from '@lumina/shared'

export const todoApi = {
  /**
   * 同步并合并待办事项
   */
  sync: async (
    data: SyncMergeRequest,
    socketId?: string | null,
  ): Promise<ApiResponse<SyncResponse>> => {
    const { data: responseData } = await httpClient.post<ApiResponse<SyncResponse>>(
      '/todos/sync',
      data,
      {
        headers: socketId ? { 'X-Socket-ID': socketId } : {},
      },
    )
    return responseData
  },

  /**
   * 获取所有待办事项
   */
  findAll: async (): Promise<ApiResponse<Todo[]>> => {
    const { data } = await httpClient.get<ApiResponse<Todo[]>>('/todos')
    return data
  },

  /**
   * 获取回收站中的待办事项
   */
  findTrash: async (): Promise<ApiResponse<Todo[]>> => {
    const { data } = await httpClient.get<ApiResponse<Todo[]>>('/todos/trash')
    return data
  },

  /**
   * 恢复已删除的待办事项
   */
  restore: async (id: string): Promise<ApiResponse<Todo>> => {
    const { data } = await httpClient.post<ApiResponse<Todo>>(`/todos/${id}/restore`)
    return data
  },

  /**
   * 永久删除待办事项
   */
  deletePermanently: async (id: string): Promise<ApiResponse<{ id: string }>> => {
    const { data } = await httpClient.delete<ApiResponse<{ id: string }>>(`/todos/${id}/permanent`)
    return data
  },

  /**
   * 清空回收站
   */
  clearTrash: async (): Promise<ApiResponse<{ count: number }>> => {
    const { data } = await httpClient.delete<ApiResponse<{ count: number }>>('/todos/trash/clear')
    return data
  },
}
