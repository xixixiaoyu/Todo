import { httpClient } from '@/api'
import type { SyncMergeRequest, SyncResponse, Todo } from '@my-app/shared'

export const todoApi = {
  /**
   * 同步并合并待办事项
   */
  sync: (data: SyncMergeRequest) => httpClient.post<SyncResponse>('/todos/sync', data),

  /**
   * 获取所有待办事项
   */
  findAll: () => httpClient.get<Todo[]>('/todos'),
}
