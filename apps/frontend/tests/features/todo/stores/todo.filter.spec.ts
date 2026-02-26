import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useTodoStore } from '@/features/todo/stores/todo'

describe('useTodoStore - Filtering', () => {
  let store: ReturnType<typeof useTodoStore>

  const mockTodos = [
    {
      id: '1',
      title: 'First todo',
      completed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      isPinned: false,
      order: 0,
      version: 0,
      pomodoroCount: 0,
    },
    {
      id: '2',
      title: 'Second todo',
      completed: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      isPinned: false,
      order: 1,
      version: 0,
      pomodoroCount: 0,
    },
  ]

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useTodoStore()
    vi.clearAllMocks()
  })

  afterEach(() => {
    store.todos = []
    store.filter = 'pending'
    store.searchQuery = ''
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

    it('should return only matching items when searching (flat)', () => {
      const nestedTodos = [
        {
          id: 'p1',
          title: 'Parent target',
          completed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          isPinned: false,
          order: 0,
          version: 0,
          pomodoroCount: 0,
        },
        {
          id: 'c1',
          title: 'Child target',
          parentId: 'p1',
          completed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          isPinned: false,
          order: 0,
          version: 0,
          pomodoroCount: 0,
        },
        {
          id: 'c2',
          title: 'Child other',
          parentId: 'p1',
          completed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          isPinned: false,
          order: 1,
          version: 0,
          pomodoroCount: 0,
        },
      ]
      store.todos = nestedTodos
      store.searchQuery = 'target'

      // Should ONLY include items that match the query
      expect(store.filteredTodos).toHaveLength(2)
      const ids = store.filteredTodos.map((t) => t.id)
      expect(ids).toContain('p1')
      expect(ids).toContain('c1')
      expect(ids).not.toContain('c2')
    })

    it('should sort todos by order ascending', () => {
      store.todos = [
        {
          id: '1',
          title: 'Task 1',
          completed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          isPinned: false,
          order: 1,
          version: 0,
          pomodoroCount: 0,
        },
        {
          id: '2',
          title: 'Task 2',
          completed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          isPinned: false,
          order: 0,
          version: 0,
          pomodoroCount: 0,
        },
      ]
      store.filter = 'pending'

      expect(store.filteredTodos[0].id).toBe('2')
      expect(store.filteredTodos[1].id).toBe('1')
    })

    it('should get correct todo path', () => {
      store.todos = [
        {
          id: '1',
          title: 'Parent',
          completed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          isPinned: false,
          order: 0,
          version: 0,
          pomodoroCount: 0,
        },
        {
          id: '2',
          title: 'Child',
          completed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          isPinned: false,
          order: 0,
          parentId: '1',
          version: 0,
          pomodoroCount: 0,
        },
        {
          id: '3',
          title: 'Grandchild',
          completed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          isPinned: false,
          order: 0,
          parentId: '2',
          version: 0,
          pomodoroCount: 0,
        },
      ]

      expect(store.getTodoPath('1')).toEqual([])
      expect(store.getTodoPath('2')).toEqual(['Parent'])
      expect(store.getTodoPath('3')).toEqual(['Parent', 'Child'])
      expect(store.getTodoPath('4')).toEqual([]) // Non-existent
    })

    it('should sort pinned items to the top', () => {
      store.todos = [
        {
          id: '1',
          title: 'T1',
          completed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          isPinned: false,
          order: 0,
          version: 0,
          pomodoroCount: 0,
        },
        {
          id: '2',
          title: 'T2',
          completed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          isPinned: false,
          order: 1,
          version: 0,
          pomodoroCount: 0,
        },
        {
          id: '3',
          title: 'T3',
          completed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          order: 2,
          isPinned: true,
          version: 0,
          pomodoroCount: 0,
        },
      ]

      const filtered = store.filteredTodos
      expect(filtered[0].id).toBe('3') // Pinned
      expect(filtered[1].id).toBe('1') // Order 0
      expect(filtered[2].id).toBe('2') // Order 1
    })

    it('should consider a child effectively pending if its parent is pending', () => {
      const hierarchicalTodos = [
        {
          id: 'p1',
          title: 'Parent',
          completed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          isPinned: false,
          order: 0,
          version: 0,
          pomodoroCount: 0,
        },
        {
          id: 'c1',
          title: 'Child',
          parentId: 'p1',
          completed: true, // Marked as completed, but parent is pending
          createdAt: new Date(),
          updatedAt: new Date(),
          isPinned: false,
          order: 0,
          version: 0,
          pomodoroCount: 0,
        },
      ]
      store.todos = hierarchicalTodos
      store.filter = 'pending'

      // Both parent and child should be in pending list
      expect(store.filteredTodos).toHaveLength(2)
      const ids = store.filteredTodos.map((t) => t.id)
      expect(ids).toContain('p1')
      expect(ids).toContain('c1')

      store.filter = 'completed'
      expect(store.filteredTodos).toHaveLength(0)
    })

    it('should consider a child effectively completed only if all ancestors are completed', () => {
      const hierarchicalTodos = [
        {
          id: 'p1',
          title: 'Parent',
          completed: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          isPinned: false,
          order: 0,
          version: 0,
          pomodoroCount: 0,
        },
        {
          id: 'c1',
          title: 'Child',
          parentId: 'p1',
          completed: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          isPinned: false,
          order: 0,
          version: 0,
          pomodoroCount: 0,
        },
      ]
      store.todos = hierarchicalTodos
      store.filter = 'completed'

      expect(store.filteredTodos).toHaveLength(2)

      // Mark parent as pending
      store.todos[0].completed = false
      expect(store.filteredTodos).toHaveLength(0)

      store.filter = 'pending'
      expect(store.filteredTodos).toHaveLength(2)
    })
  })

  describe('counts', () => {
    it('should count pending todos', () => {
      store.todos = mockTodos.map((t) => ({ ...t }))
      expect(store.pendingCount).toBe(1)
    })

    it('should count completed todos', () => {
      store.todos = mockTodos.map((t) => ({ ...t }))
      expect(store.completedCount).toBe(1)
    })
  })
})
