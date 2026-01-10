import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useTodoStore } from '@/features/todo/stores/todo'

describe('useTodoStore', () => {
  let store: ReturnType<typeof useTodoStore>

  const mockTodos = [
    {
      id: '1',
      title: 'First todo',
      completed: false,
      createdAt: new Date(),
    },
    {
      id: '2',
      title: 'Second todo',
      completed: true,
      createdAt: new Date(),
    },
  ]

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useTodoStore()
    vi.clearAllMocks()

    // Mock crypto.randomUUID
    if (!global.crypto) {
      // @ts-expect-error - Mocking crypto.randomUUID for testing environment
      global.crypto = {
        randomUUID: () =>
          '00000000-0000-0000-0000-000000000000' as `${string}-${string}-${string}-${string}-${string}`,
      }
    }
  })

  afterEach(() => {
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
  })

  describe('pendingCount', () => {
    it('should count pending todos', () => {
      store.todos = mockTodos.map((t) => ({ ...t }))

      expect(store.pendingCount).toBe(1)
    })
  })

  describe('completedCount', () => {
    it('should count completed todos', () => {
      store.todos = mockTodos.map((t) => ({ ...t }))

      expect(store.completedCount).toBe(1)
    })
  })

  describe('addTodo', () => {
    it('should add todo successfully', async () => {
      const result = await store.addTodo('New todo')

      expect(result).toBe(true)
      expect(store.todos).toHaveLength(1)
      expect(store.todos[0].title).toBe('New todo')
      expect(store.todos[0].id).toBeDefined()
    })

    it('should trim whitespace from title', async () => {
      const result = await store.addTodo('  Trimmed todo  ')

      expect(result).toBe(true)
      expect(store.todos[0].title).toBe('Trimmed todo')
    })

    it('should not add empty todo', async () => {
      const result = await store.addTodo('   ')

      expect(result).toBe(false)
      expect(store.todos).toHaveLength(0)
    })

    it('should not add duplicate todo if it is pending', async () => {
      store.todos = [{ ...mockTodos[0] }] // 'First todo', completed: false

      const result = await store.addTodo('First todo')

      expect(result).toBe(false)
      expect(store.error).toBe('todo.duplicate')
      expect(store.todos).toHaveLength(1)
    })

    it('should allow adding duplicate todo if existing one is completed', async () => {
      store.todos = [{ ...mockTodos[1] }] // 'Second todo', completed: true

      const result = await store.addTodo('Second todo')

      expect(result).toBe(true)
      expect(store.todos).toHaveLength(2)
      expect(store.todos[0].title).toBe('Second todo')
      expect(store.todos[0].completed).toBe(false)
    })
  })

  describe('toggleTodo', () => {
    it('should toggle todo status', async () => {
      store.todos = [{ ...mockTodos[0] }]

      await store.toggleTodo('1')

      expect(store.todos[0].completed).toBe(true)

      await store.toggleTodo('1')
      expect(store.todos[0].completed).toBe(false)
    })
  })

  describe('deleteTodo', () => {
    it('should delete todo successfully', async () => {
      store.todos = [{ ...mockTodos[0] }]

      await store.deleteTodo('1')

      expect(store.todos).toHaveLength(0)
    })
  })

  describe('updateTodo', () => {
    it('should update todo title successfully', async () => {
      store.todos = [{ ...mockTodos[0] }]

      const result = await store.updateTodo('1', 'Updated title')

      expect(result).toBe(true)
      expect(store.todos[0].title).toBe('Updated title')
    })

    it('should not update with empty title', async () => {
      store.todos = [{ ...mockTodos[0] }]

      const result = await store.updateTodo('1', '   ')

      expect(result).toBe(false)
      expect(store.todos[0].title).toBe('First todo')
    })

    it('should not update to a duplicate title if it exists in pending todos', async () => {
      store.todos = [
        { ...mockTodos[0], id: '1', title: 'Task 1', completed: false },
        { ...mockTodos[1], id: '2', title: 'Task 2', completed: false },
      ]

      const result = await store.updateTodo('1', 'Task 2')

      expect(result).toBe(false)
      expect(store.error).toBe('todo.duplicate')
      expect(store.todos[0].title).toBe('Task 1')
    })

    it('should allow updating to a title that exists in completed todos', async () => {
      store.todos = [
        { ...mockTodos[0], id: '1', title: 'Task 1', completed: false },
        { ...mockTodos[1], id: '2', title: 'Task 2', completed: true },
      ]

      const result = await store.updateTodo('1', 'Task 2')

      expect(result).toBe(true)
      expect(store.todos[0].title).toBe('Task 2')
    })

    it('should return true if title has not changed', async () => {
      store.todos = [{ ...mockTodos[0], title: 'Same title' }]

      const result = await store.updateTodo('1', 'Same title')

      expect(result).toBe(true)
    })
  })
})
