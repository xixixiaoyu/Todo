import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useTodoStore } from '@/features/todo/stores/todo'

describe('useTodoStore - Actions', () => {
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
    if (typeof crypto === 'undefined') {
      // @ts-expect-error - Mocking crypto for testing environment
      global.crypto = {
        randomUUID: () =>
          '00000000-0000-0000-0000-000000000000' as `${string}-${string}-${string}-${string}-${string}`,
      }
    } else {
      vi.spyOn(crypto, 'randomUUID').mockReturnValue(
        '00000000-0000-0000-0000-000000000000' as `${string}-${string}-${string}-${string}-${string}`,
      )
    }
  })

  afterEach(() => {
    store.todos = []
    store.error = null
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

      expect(result).toBe('00000000-0000-0000-0000-000000000000')
      expect(store.todos[0].title).toBe('Trimmed todo')
    })

    it('should not add empty todo', async () => {
      const result = await store.addTodo('   ')

      expect(result).toBeNull()
      expect(store.todos).toHaveLength(0)
    })

    it('should not add duplicate todo if it is pending at the same level', async () => {
      store.todos = [{ ...mockTodos[0], parentId: null }] // 'First todo', completed: false

      const result = await store.addTodo('First todo', null)

      expect(result).toBeNull()
      expect(store.error).toBe('todo.duplicate')
      expect(store.todos).toHaveLength(1)
    })

    it('should allow adding duplicate todo if it is at a different level', async () => {
      store.todos = [{ ...mockTodos[0], parentId: null }] // 'First todo', completed: false

      const result = await store.addTodo('First todo', 'parent-id')

      expect(result).toBe('00000000-0000-0000-0000-000000000000')
      expect(store.todos).toHaveLength(2)
      expect(store.todos[0].parentId).toBe('parent-id')
    })

    it('should not add subtask if parent is completed', async () => {
      store.todos = [
        { id: 'parent-1', title: 'Parent Task', completed: true, createdAt: new Date(), order: 0 },
      ]

      const result = await store.addTodo('Subtask', 'parent-1')

      expect(result).toBeNull()
      expect(store.error).toBe('todo.parentCompleted')
      expect(store.todos).toHaveLength(1)
    })

    it('should allow adding duplicate todo if existing one is completed at the same level', async () => {
      store.todos = [{ ...mockTodos[1], parentId: null }] // 'Second todo', completed: true

      const result = await store.addTodo('Second todo', null)

      expect(result).toBe('00000000-0000-0000-0000-000000000000')
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

    it('should not update to a duplicate title if it exists at the same level', async () => {
      store.todos = [
        { ...mockTodos[0], id: '1', title: 'Task 1', parentId: 'p1', completed: false },
        { ...mockTodos[1], id: '2', title: 'Task 2', parentId: 'p1', completed: false },
      ]

      const result = await store.updateTodo('1', 'Task 2')

      expect(result).toBe(false)
      expect(store.error).toBe('todo.duplicate')
      expect(store.todos.find((t) => t.id === '1')?.title).toBe('Task 1')
    })

    it('should allow updating to a duplicate title if it exists at a different level', async () => {
      store.todos = [
        { ...mockTodos[0], id: '1', title: 'Task 1', parentId: 'p1', completed: false },
        { ...mockTodos[1], id: '2', title: 'Task 2', parentId: 'p2', completed: false },
      ]

      const result = await store.updateTodo('1', 'Task 2')

      expect(result).toBe(true)
      expect(store.todos.find((t) => t.id === '1')?.title).toBe('Task 2')
    })

    it('should allow updating to a title that exists in completed todos at the same level', async () => {
      store.todos = [
        { ...mockTodos[0], id: '1', title: 'Task 1', parentId: 'p1', completed: false },
        { ...mockTodos[1], id: '2', title: 'Task 2', parentId: 'p1', completed: true },
      ]

      const result = await store.updateTodo('1', 'Task 2')

      expect(result).toBe(true)
      expect(store.todos.find((t) => t.id === '1')?.title).toBe('Task 2')
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

  describe('togglePin', () => {
    it('should toggle pin state', async () => {
      store.todos = [{ id: '1', title: 'T1', completed: false, createdAt: new Date(), order: 0 }]
      expect(store.todos[0].isPinned).toBeFalsy()

      await store.togglePin('1')
      expect(store.todos[0].isPinned).toBe(true)

      await store.togglePin('1')
      expect(store.todos[0].isPinned).toBe(false)
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

    it('should not allow reordering if it creates a duplicate in the target level', () => {
      store.todos = [
        {
          id: '1',
          title: 'Task',
          completed: false,
          createdAt: new Date(),
          order: 0,
          parentId: 'p1',
        },
        {
          id: '2',
          title: 'Task',
          completed: false,
          createdAt: new Date(),
          order: 0,
          parentId: 'p2',
        },
      ]

      store.reorderTodos(['2'], 'p1')

      const t2 = store.todos.find((t) => t.id === '2')
      expect(t2?.parentId).toBe('p2') // Should not have changed
      expect(store.error).toBe('todo.duplicate')
    })

    it('should allow reordering if parentId has not changed (just reordering)', () => {
      store.todos = [
        {
          id: '1',
          title: 'Task',
          completed: false,
          createdAt: new Date(),
          order: 0,
          parentId: 'p1',
        },
        {
          id: '2',
          title: 'Other',
          completed: false,
          createdAt: new Date(),
          order: 1,
          parentId: 'p1',
        },
      ]

      store.reorderTodos(['2', '1'], 'p1')

      const t1 = store.todos.find((t) => t.id === '1')
      const t2 = store.todos.find((t) => t.id === '2')
      expect(t1?.order).toBe(1)
      expect(t2?.order).toBe(0)
      expect(store.error).toBeNull()
    })
  })
})
