import { describe, it, expect, vi, beforeEach } from 'vitest'
import { todoApi } from '@/features/todo/api'
import { httpClient } from '@/api'

// Mock httpClient
vi.mock('@/api', () => ({
  httpClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

describe('todoApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getAll', () => {
    it('should get all todos', async () => {
      const mockTodos = [
        {
          id: '1',
          title: 'First todo',
          completed: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: '2',
          title: 'Second todo',
          completed: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]

      const mockResponse = {
        success: true,
        data: mockTodos,
        timestamp: new Date().toISOString(),
      }

      vi.mocked(httpClient.get).mockResolvedValue({ data: mockResponse })

      const result = await todoApi.getAll()

      expect(httpClient.get).toHaveBeenCalledWith('/todos')
      expect(result).toEqual(mockResponse)
    })
  })

  describe('create', () => {
    it('should create a new todo', async () => {
      const input = {
        title: 'New todo',
      }

      const mockTodo = {
        id: '1',
        title: 'New todo',
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const mockResponse = {
        success: true,
        data: mockTodo,
        timestamp: new Date().toISOString(),
      }

      vi.mocked(httpClient.post).mockResolvedValue({ data: mockResponse })

      const result = await todoApi.create(input)

      expect(httpClient.post).toHaveBeenCalledWith('/todos', input)
      expect(result).toEqual(mockResponse)
    })
  })

  describe('update', () => {
    it('should update a todo', async () => {
      const id = '1'
      const input = {
        title: 'Updated title',
      }

      const mockTodo = {
        id: '1',
        title: 'Updated title',
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const mockResponse = {
        success: true,
        data: mockTodo,
        timestamp: new Date().toISOString(),
      }

      vi.mocked(httpClient.patch).mockResolvedValue({ data: mockResponse })

      const result = await todoApi.update(id, input)

      expect(httpClient.patch).toHaveBeenCalledWith(`/todos/${id}`, input)
      expect(result).toEqual(mockResponse)
    })

    it('should update todo completion status', async () => {
      const id = '1'
      const input = {
        completed: true,
      }

      const mockTodo = {
        id: '1',
        title: 'Test todo',
        completed: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const mockResponse = {
        success: true,
        data: mockTodo,
        timestamp: new Date().toISOString(),
      }

      vi.mocked(httpClient.patch).mockResolvedValue({ data: mockResponse })

      const result = await todoApi.update(id, input)

      expect(httpClient.patch).toHaveBeenCalledWith(`/todos/${id}`, input)
      expect(result).toEqual(mockResponse)
    })
  })

  describe('delete', () => {
    it('should delete a todo', async () => {
      const id = '1'

      const mockResponse = {
        success: true,
        data: undefined,
        timestamp: new Date().toISOString(),
      }

      vi.mocked(httpClient.delete).mockResolvedValue({ data: mockResponse })

      const result = await todoApi.delete(id)

      expect(httpClient.delete).toHaveBeenCalledWith(`/todos/${id}`)
      expect(result).toEqual(mockResponse)
    })
  })

  describe('deleteCompleted', () => {
    it('should delete all completed todos', async () => {
      const mockResponse = {
        success: true,
        data: undefined,
        timestamp: new Date().toISOString(),
      }

      vi.mocked(httpClient.delete).mockResolvedValue({ data: mockResponse })

      const result = await todoApi.deleteCompleted()

      expect(httpClient.delete).toHaveBeenCalledWith('/todos/completed')
      expect(result).toEqual(mockResponse)
    })
  })
})
