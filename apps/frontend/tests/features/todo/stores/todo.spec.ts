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
      order: 0,
    },
    {
      id: '2',
      title: 'Second todo',
      completed: true,
      createdAt: new Date(),
      order: 1,
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
      expect(store.isDrawerOpen).toBe(false)
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

    it('should sort todos by order ascending', () => {
      store.todos = [
        { id: '1', title: 'Task 1', completed: false, createdAt: new Date(), order: 1 },
        { id: '2', title: 'Task 2', completed: false, createdAt: new Date(), order: 0 },
      ]
      store.filter = 'pending'

      expect(store.filteredTodos[0].id).toBe('2')
      expect(store.filteredTodos[1].id).toBe('1')
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

  describe('reorderTodos', () => {
    it('should update orders and parentId based on provided IDs', () => {
      store.todos = [
        {
          id: '1',
          title: 'Task 1',
          completed: false,
          createdAt: new Date(),
          order: 0,
          parentId: null,
        },
        {
          id: '2',
          title: 'Task 2',
          completed: false,
          createdAt: new Date(),
          order: 1,
          parentId: 'other',
        },
      ]

      store.reorderTodos(['2', '1'], 'newParent')

      const t2 = store.todos.find((t) => t.id === '2')
      const t1 = store.todos.find((t) => t.id === '1')

      expect(t2?.order).toBe(0)
      expect(t2?.parentId).toBe('newParent')
      expect(t1?.order).toBe(1)
      expect(t1?.parentId).toBe('newParent')
    })
  })

  describe('addTodo', () => {
    it('should add a new todo with order smaller than existing minimum', async () => {
      store.todos = [
        { id: '1', title: 'Existing', completed: false, createdAt: new Date(), order: 5 },
      ]

      await store.addTodo('New Task')

      expect(store.todos).toHaveLength(2)
      expect(store.todos[0].title).toBe('New Task')
      expect(store.todos[0].order).toBe(4)
    })

    it('should add a new todo with order -1 if list is empty', async () => {
      await store.addTodo('First Task')
      expect(store.todos[0].order).toBe(-1)
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

    it('should toggle parent and children correctly', async () => {
      store.todos = [
        { id: 'parent', title: 'Parent', completed: false, createdAt: new Date(), order: 0 },
        {
          id: 'child1',
          title: 'Child 1',
          completed: false,
          createdAt: new Date(),
          parentId: 'parent',
          order: 0,
        },
        {
          id: 'child2',
          title: 'Child 2',
          completed: false,
          createdAt: new Date(),
          parentId: 'parent',
          order: 1,
        },
      ]

      // Toggle parent -> children should follow
      await store.toggleTodo('parent')
      expect(store.todos.find((t) => t.id === 'parent')?.completed).toBe(true)
      expect(store.todos.find((t) => t.id === 'child1')?.completed).toBe(true)
      expect(store.todos.find((t) => t.id === 'child2')?.completed).toBe(true)

      // Toggle child1 off -> parent should be off
      await store.toggleTodo('child1')
      expect(store.todos.find((t) => t.id === 'child1')?.completed).toBe(false)
      expect(store.todos.find((t) => t.id === 'parent')?.completed).toBe(false)

      // Toggle child1 on again -> all children on -> parent should be on
      await store.toggleTodo('child1')
      expect(store.todos.find((t) => t.id === 'child1')?.completed).toBe(true)
      expect(store.todos.find((t) => t.id === 'parent')?.completed).toBe(true)
    })

    it('should toggle status recursively for 3 levels', async () => {
      store.todos = [
        { id: 'root', title: 'Root', completed: false, createdAt: new Date(), order: 0 },
        {
          id: 'child',
          title: 'Child',
          completed: false,
          createdAt: new Date(),
          parentId: 'root',
          order: 0,
        },
        {
          id: 'grandchild',
          title: 'Grandchild',
          completed: false,
          createdAt: new Date(),
          parentId: 'child',
          order: 0,
        },
      ]

      // Toggle root on -> child and grandchild should be on
      await store.toggleTodo('root')
      expect(store.todos.find((t) => t.id === 'root')?.completed).toBe(true)
      expect(store.todos.find((t) => t.id === 'child')?.completed).toBe(true)
      expect(store.todos.find((t) => t.id === 'grandchild')?.completed).toBe(true)

      // Toggle grandchild off -> child and root should be off
      await store.toggleTodo('grandchild')
      expect(store.todos.find((t) => t.id === 'grandchild')?.completed).toBe(false)
      expect(store.todos.find((t) => t.id === 'child')?.completed).toBe(false)
      expect(store.todos.find((t) => t.id === 'root')?.completed).toBe(false)

      // Toggle grandchild on -> child and root should be on (since they only have one child)
      await store.toggleTodo('grandchild')
      expect(store.todos.find((t) => t.id === 'grandchild')?.completed).toBe(true)
      expect(store.todos.find((t) => t.id === 'child')?.completed).toBe(true)
      expect(store.todos.find((t) => t.id === 'root')?.completed).toBe(true)
    })
  })

  describe('deleteTodo', () => {
    it('should delete todo successfully', async () => {
      store.todos = [{ ...mockTodos[0] }]

      await store.deleteTodo('1')

      expect(store.todos).toHaveLength(0)
    })

    it('should delete parent and all children recursively', async () => {
      store.todos = [
        { id: 'parent', title: 'Parent', completed: false, createdAt: new Date(), order: 0 },
        {
          id: 'child1',
          title: 'Child 1',
          completed: false,
          createdAt: new Date(),
          parentId: 'parent',
          order: 0,
        },
        {
          id: 'child2',
          title: 'Child 2',
          completed: false,
          createdAt: new Date(),
          parentId: 'parent',
          order: 1,
        },
        {
          id: 'grandchild',
          title: 'Grandchild',
          completed: false,
          createdAt: new Date(),
          parentId: 'child1',
          order: 0,
        },
      ]

      await store.deleteTodo('parent')
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

    it('should return false if todo not found', async () => {
      const result = await store.updateTodo('non-existent', 'New Title')
      expect(result).toBe(false)
    })
  })

  describe('other actions', () => {
    it('should set filter', () => {
      store.setFilter('completed')
      expect(store.filter).toBe('completed')
    })

    it('should set search query', () => {
      store.setSearchQuery('test')
      expect(store.searchQuery).toBe('test')
    })

    it('should clear search', () => {
      store.searchQuery = 'test'
      store.clearSearch()
      expect(store.searchQuery).toBe('')
    })

    it('should clear error', () => {
      store.error = 'some error'
      store.clearError()
      expect(store.error).toBeNull()
    })

    it('should set drawer open state', () => {
      store.setDrawerOpen(true)
      expect(store.isDrawerOpen).toBe(true)
      store.setDrawerOpen(false)
      expect(store.isDrawerOpen).toBe(false)
    })

    it('should toggle drawer state', () => {
      expect(store.isDrawerOpen).toBe(false)
      store.toggleDrawer()
      expect(store.isDrawerOpen).toBe(true)
      store.toggleDrawer()
      expect(store.isDrawerOpen).toBe(false)
    })

    it('should fetch todos (currently empty logic)', async () => {
      await expect(store.fetchTodos()).resolves.toBeUndefined()
    })
  })
})
