import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useTodoStore } from '@/features/todo/stores/todo'
import { todoApi } from '@/features/todo/api'

// Mock todoApi
vi.mock('@/features/todo/api', () => ({
  todoApi: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteCompleted: vi.fn(),
  },
}))

describe('useTodoStore', () => {
  let store: ReturnType<typeof useTodoStore>

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

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useTodoStore()
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Reset store state manually since setup syntax doesn't support $reset()
    store.todos = []
    store.filter = 'pending'
    store.searchQuery = ''
    store.loading = false
    store.error = null
  })

  describe('initial state', () => {
    it('should initialize with default values', () => {
      expect(store.todos).toEqual([])
      expect(store.filter).toBe('pending')
      expect(store.searchQuery).toBe('')
      expect(store.loading).toBe(false)
      expect(store.error).toBeNull()
    })
  })

  describe('filteredTodos', () => {
    it('should filter pending todos', () => {
      store.todos = mockTodos.map((t) => ({ ...t }))
      store.filter = 'pending'

      expect(store.filteredTodos).toHaveLength(1)
      expect(store.filteredTodos[0].id).toBe('1')
    })

    it('should filter completed todos', () => {
      store.todos = mockTodos.map((t) => ({ ...t }))
      store.filter = 'completed'

      expect(store.filteredTodos).toHaveLength(1)
      expect(store.filteredTodos[0].id).toBe('2')
    })

    it('should filter by search query', () => {
      store.todos = mockTodos.map((t) => ({ ...t }))
      store.searchQuery = 'first'

      expect(store.filteredTodos).toHaveLength(1)
      expect(store.filteredTodos[0].title).toBe('First todo')
    })

    it('should filter by search query case insensitive', () => {
      store.todos = mockTodos.map((t) => ({ ...t }))
      store.searchQuery = 'FIRST'

      expect(store.filteredTodos).toHaveLength(1)
      expect(store.filteredTodos[0].title).toBe('First todo')
    })

    it('should combine filter and search', () => {
      store.todos = mockTodos.map((t) => ({ ...t }))
      store.filter = 'completed'
      store.searchQuery = 'second'

      expect(store.filteredTodos).toHaveLength(1)
      expect(store.filteredTodos[0].id).toBe('2')
    })
  })

  describe('pendingCount', () => {
    it('should count pending todos', () => {
      store.todos = mockTodos.map((t) => ({ ...t }))

      expect(store.pendingCount).toBe(1)
    })

    it('should return 0 when all todos are completed', () => {
      store.todos = [
        { ...mockTodos[0], completed: true },
        { ...mockTodos[1], completed: true },
      ]

      expect(store.pendingCount).toBe(0)
    })
  })

  describe('completedCount', () => {
    it('should count completed todos', () => {
      store.todos = mockTodos.map((t) => ({ ...t }))

      expect(store.completedCount).toBe(1)
    })

    it('should return 0 when no todos are completed', () => {
      store.todos = [
        { ...mockTodos[0], completed: false },
        { ...mockTodos[1], completed: false },
      ]

      expect(store.completedCount).toBe(0)
    })
  })

  describe('fetchTodos', () => {
    it('should fetch todos successfully', async () => {
      const apiTodos = [
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

      vi.mocked(todoApi.getAll).mockResolvedValue({
        success: true,
        data: apiTodos,
        timestamp: new Date().toISOString(),
      })

      await store.fetchTodos()

      expect(store.todos).toHaveLength(2)
      expect(store.loading).toBe(false)
      expect(store.error).toBeNull()
      expect(todoApi.getAll).toHaveBeenCalled()
    })

    it('should handle fetch failure', async () => {
      const error = {
        response: {
          data: {
            message: 'Network error',
          },
        },
      }

      vi.mocked(todoApi.getAll).mockRejectedValue(error)

      await store.fetchTodos()

      expect(store.todos).toEqual([])
      expect(store.loading).toBe(false)
      expect(store.error).toBe('Network error')
    })
  })

  describe('addTodo', () => {
    it('should add todo successfully', async () => {
      const newTodo = {
        id: '3',
        title: 'New todo',
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      vi.mocked(todoApi.create).mockResolvedValue({
        success: true,
        data: newTodo,
        timestamp: new Date().toISOString(),
      })

      const result = await store.addTodo('New todo')

      expect(result).toBe(true)
      expect(store.todos).toHaveLength(1)
      expect(store.todos[0].title).toBe('New todo')
      expect(todoApi.create).toHaveBeenCalledWith({ title: 'New todo' })
    })

    it('should trim whitespace from title', async () => {
      const newTodo = {
        id: '3',
        title: 'Trimmed todo',
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      vi.mocked(todoApi.create).mockResolvedValue({
        success: true,
        data: newTodo,
        timestamp: new Date().toISOString(),
      })

      const result = await store.addTodo('  Trimmed todo  ')

      expect(result).toBe(true)
      expect(todoApi.create).toHaveBeenCalledWith({ title: 'Trimmed todo' })
    })

    it('should not add empty todo', async () => {
      const result = await store.addTodo('   ')

      expect(result).toBe(false)
      expect(todoApi.create).not.toHaveBeenCalled()
    })

    it('should not add duplicate todo', async () => {
      store.todos = [mockTodos[0]]

      const result = await store.addTodo('First todo')

      expect(result).toBe(false)
      expect(todoApi.create).not.toHaveBeenCalled()
    })

    it('should handle add failure', async () => {
      const error = {
        response: {
          data: {
            message: 'Failed to create todo',
          },
        },
      }

      vi.mocked(todoApi.create).mockRejectedValue(error)

      const result = await store.addTodo('New todo')

      expect(result).toBe(false)
      expect(store.error).toBe('Failed to create todo')
    })
  })

  describe('toggleTodo', () => {
    it('should toggle todo successfully', async () => {
      store.todos = [{ ...mockTodos[0] }]

      vi.mocked(todoApi.update).mockResolvedValue({
        success: true,
        data: { ...mockTodos[0], completed: true },
        timestamp: new Date().toISOString(),
      })

      await store.toggleTodo('1')

      expect(store.todos[0].completed).toBe(true)
      expect(todoApi.update).toHaveBeenCalledWith('1', { completed: true })
    })

    it('should not toggle non-existent todo', async () => {
      store.todos = [{ ...mockTodos[0] }]

      await store.toggleTodo('999')

      expect(todoApi.update).not.toHaveBeenCalled()
    })

    it('should handle toggle failure', async () => {
      store.todos = [{ ...mockTodos[0] }]

      const error = {
        response: {
          data: {
            message: 'Failed to update todo',
          },
        },
      }

      vi.mocked(todoApi.update).mockRejectedValue(error)

      await store.toggleTodo('1')

      expect(store.todos[0].completed).toBe(false)
      expect(store.error).toBe('Failed to update todo')
    })
  })

  describe('deleteTodo', () => {
    it('should delete todo successfully', async () => {
      store.todos = mockTodos.map((t) => ({ ...t }))

      vi.mocked(todoApi.delete).mockResolvedValue({
        success: true,
        data: undefined,
        timestamp: new Date().toISOString(),
      })

      await store.deleteTodo('1')

      expect(store.todos).toHaveLength(1)
      expect(store.todos[0].id).toBe('2')
      expect(todoApi.delete).toHaveBeenCalledWith('1')
    })

    it('should handle delete failure', async () => {
      store.todos = mockTodos.map((t) => ({ ...t }))

      const error = {
        response: {
          data: {
            message: 'Failed to delete todo',
          },
        },
      }

      vi.mocked(todoApi.delete).mockRejectedValue(error)

      await store.deleteTodo('1')

      expect(store.todos).toHaveLength(2)
      expect(store.error).toBe('Failed to delete todo')
    })
  })

  describe('updateTodo', () => {
    it('should update todo successfully', async () => {
      store.todos = [{ ...mockTodos[0] }]

      vi.mocked(todoApi.update).mockResolvedValue({
        success: true,
        data: { ...mockTodos[0], title: 'Updated title' },
        timestamp: new Date().toISOString(),
      })

      await store.updateTodo('1', 'Updated title')

      expect(store.todos[0].title).toBe('Updated title')
      expect(todoApi.update).toHaveBeenCalledWith('1', { title: 'Updated title' })
    })

    it('should trim whitespace from title', async () => {
      store.todos = [{ ...mockTodos[0] }]

      vi.mocked(todoApi.update).mockResolvedValue({
        success: true,
        data: { ...mockTodos[0], title: 'Trimmed' },
        timestamp: new Date().toISOString(),
      })

      await store.updateTodo('1', '  Trimmed  ')

      expect(store.todos[0].title).toBe('Trimmed')
    })

    it('should not update with empty title', async () => {
      store.todos = [{ ...mockTodos[0] }]

      await store.updateTodo('1', '   ')

      expect(todoApi.update).not.toHaveBeenCalled()
    })

    it('should not update non-existent todo', async () => {
      store.todos = [{ ...mockTodos[0] }]

      await store.updateTodo('999', 'New title')

      expect(todoApi.update).not.toHaveBeenCalled()
    })

    it('should handle update failure', async () => {
      store.todos = [{ ...mockTodos[0] }]

      const error = {
        response: {
          data: {
            message: 'Failed to update todo',
          },
        },
      }

      vi.mocked(todoApi.update).mockRejectedValue(error)

      await store.updateTodo('1', 'New title')

      expect(store.todos[0].title).toBe('First todo')
      expect(store.error).toBe('Failed to update todo')
    })
  })

  describe('setFilter', () => {
    it('should set filter to pending', () => {
      store.setFilter('pending')

      expect(store.filter).toBe('pending')
    })

    it('should set filter to completed', () => {
      store.setFilter('completed')

      expect(store.filter).toBe('completed')
    })
  })

  describe('setSearchQuery', () => {
    it('should set search query', () => {
      store.setSearchQuery('test query')

      expect(store.searchQuery).toBe('test query')
    })
  })

  describe('clearSearch', () => {
    it('should clear search query', () => {
      store.searchQuery = 'test query'

      store.clearSearch()

      expect(store.searchQuery).toBe('')
    })
  })

  describe('clearError', () => {
    it('should clear error', () => {
      store.error = 'Some error'

      store.clearError()

      expect(store.error).toBeNull()
    })
  })
})
