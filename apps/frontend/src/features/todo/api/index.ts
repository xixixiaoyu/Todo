import { httpClient } from '@/api'
import type { ApiResponse } from '@my-app/shared'

/**
 * Todo 相关类型定义
 */
export interface Todo {
  id: string
  title: string
  completed: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateTodoInput {
  title: string
}

export interface UpdateTodoInput {
  title?: string
  completed?: boolean
}

/**
 * Todo 相关 API
 */
export const todoApi = {
  /**
   * 获取所有待办事项
   */
  async getAll(): Promise<ApiResponse<Todo[]>> {
    const { data } = await httpClient.get<ApiResponse<Todo[]>>('/todos')
    return data
  },

  /**
   * 创建待办事项
   */
  async create(input: CreateTodoInput): Promise<ApiResponse<Todo>> {
    const { data } = await httpClient.post<ApiResponse<Todo>>('/todos', input)
    return data
  },

  /**
   * 更新待办事项
   */
  async update(id: string, input: UpdateTodoInput): Promise<ApiResponse<Todo>> {
    const { data } = await httpClient.patch<ApiResponse<Todo>>(`/todos/${id}`, input)
    return data
  },

  /**
   * 删除待办事项
   */
  async delete(id: string): Promise<ApiResponse<void>> {
    const { data } = await httpClient.delete<ApiResponse<void>>(`/todos/${id}`)
    return data
  },

  /**
   * 批量删除已完成的待办事项
   */
  async deleteCompleted(): Promise<ApiResponse<void>> {
    const { data } = await httpClient.delete<ApiResponse<void>>('/todos/completed')
    return data
  },
}
