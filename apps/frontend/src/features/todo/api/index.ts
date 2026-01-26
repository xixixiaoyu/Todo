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
}
