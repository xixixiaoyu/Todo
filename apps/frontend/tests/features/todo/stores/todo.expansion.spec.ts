import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { useTodoStore } from '@/features/todo/stores/todo'

describe('useTodoStore - Expansion', () => {
  let store: ReturnType<typeof useTodoStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useTodoStore()
    vi.clearAllMocks()
  })

  describe('expansion', () => {
    it('should toggle all expansion', () => {
      store.todos = [
        {
          id: '1',
          title: 'P1',
          completed: false,
          createdAt: new Date(),
          order: 0,
          expanded: true,
        },
        {
          id: '2',
          title: 'C1',
          completed: false,
          createdAt: new Date(),
          order: 0,
          parentId: '1',
        },
        {
          id: '3',
          title: 'P2',
          completed: false,
          createdAt: new Date(),
          order: 1,
          expanded: true,
        },
        {
          id: '4',
          title: 'C2',
          completed: false,
          createdAt: new Date(),
          order: 0,
          parentId: '3',
        },
      ]
      expect(store.isAllExpanded).toBe(true)

      store.toggleAllExpansion()
      expect(store.isAllExpanded).toBe(false)
      expect(store.todos[0].expanded).toBe(false)
      expect(store.todos[2].expanded).toBe(false)

      store.toggleAllExpansion()
      expect(store.isAllExpanded).toBe(true)
      expect(store.todos[0].expanded).toBe(true)
      expect(store.todos[2].expanded).toBe(true)
    })

    it('should toggle single todo expansion', () => {
      store.todos = [
        {
          id: '1',
          title: 'T1',
          completed: false,
          createdAt: new Date(),
          order: 0,
          expanded: true,
        },
      ]
      store.toggleTodoExpansion('1')
      expect(store.todos[0].expanded).toBe(false)

      store.toggleTodoExpansion('1')
      expect(store.todos[0].expanded).toBe(true)
    })

    it('should automatically update isAllExpanded based on manual operations of parent nodes', async () => {
      store.todos = [
        {
          id: '1',
          title: 'P1',
          completed: false,
          createdAt: new Date(),
          order: 0,
          expanded: true,
        },
        {
          id: '2',
          title: 'C1',
          completed: false,
          createdAt: new Date(),
          order: 0,
          parentId: '1',
        },
        {
          id: '3',
          title: 'P2',
          completed: false,
          createdAt: new Date(),
          order: 1,
          expanded: true,
        },
        {
          id: '4',
          title: 'C2',
          completed: false,
          createdAt: new Date(),
          order: 0,
          parentId: '3',
        },
      ]
      expect(store.isAllExpanded).toBe(true)

      store.toggleTodoExpansion('1')
      await nextTick()
      expect(store.isAllExpanded).toBe(true) // P2 still expanded

      store.toggleTodoExpansion('3')
      await nextTick()
      expect(store.isAllExpanded).toBe(false) // All parents collapsed

      store.toggleTodoExpansion('1')
      await nextTick()
      expect(store.isAllExpanded).toBe(true) // P1 expanded again
    })

    it('should only consider visible parent nodes for isAllExpanded', async () => {
      store.todos = [
        {
          id: '1',
          title: 'Pending Parent',
          completed: false,
          createdAt: new Date(),
          order: 0,
          expanded: false,
        },
        {
          id: '2',
          title: 'Pending Child',
          completed: false,
          createdAt: new Date(),
          order: 0,
          parentId: '1',
        },
        {
          id: '3',
          title: 'Completed Parent',
          completed: true,
          createdAt: new Date(),
          order: 1,
          expanded: true,
        },
        {
          id: '4',
          title: 'Completed Child',
          completed: true,
          createdAt: new Date(),
          order: 0,
          parentId: '3',
        },
      ]

      // When filter is 'pending', only Pending Parent is visible
      store.setFilter('pending')
      await nextTick()
      expect(store.isAllExpanded).toBe(false) // Pending Parent is collapsed

      // When filter is 'completed', only Completed Parent is visible
      store.setFilter('completed')
      await nextTick()
      expect(store.isAllExpanded).toBe(true) // Completed Parent is expanded
    })

    it('should expand all when searching', async () => {
      store.todos = [
        {
          id: '1',
          title: 'P1',
          completed: false,
          createdAt: new Date(),
          order: 0,
          expanded: false,
        },
        {
          id: '2',
          title: 'C1',
          completed: false,
          createdAt: new Date(),
          order: 0,
          parentId: '1',
        },
      ]
      store.setSearchQuery('P')
      await nextTick()
      expect(store.todos[0].expanded).toBe(true)
      expect(store.isAllExpanded).toBe(true)
    })
  })
})
