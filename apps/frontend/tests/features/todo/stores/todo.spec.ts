import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { useTodoStore } from '@/features/todo/stores/todo'

describe('useTodoStore - Basic State', () => {
  let store: ReturnType<typeof useTodoStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useTodoStore()
    vi.clearAllMocks()
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
      expect(store.viewMode).toBe('list')
      expect(store.searchQuery).toBe('')
      expect(store.loading).toBe(false)
      expect(store.error).toBeNull()
      expect(store.isDrawerOpen).toBe(false)
    })
  })

  describe('viewMode', () => {
    it('should update view mode', () => {
      store.viewMode = 'visual'
      expect(store.viewMode).toBe('visual')
      store.viewMode = 'list'
      expect(store.viewMode).toBe('list')
    })
  })

  describe('basic actions', () => {
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

    it('should restore current todos when local snapshot is hydrated', async () => {
      const hydratedTodos = [
        {
          id: 'hydrated-local',
          title: 'Hydrated Local Todo',
          completed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          isPinned: false,
          order: 0,
          version: 1,
          pomodoroCount: 0,
        },
      ]

      store.localTodos = hydratedTodos
      await nextTick()

      expect(store.todos).toHaveLength(1)
      expect(store.todos[0].id).toBe('hydrated-local')
    })

    it('should restore collapsed expansion state when local snapshot is hydrated', async () => {
      const hydratedTodos = [
        {
          id: 'hydrated-parent',
          title: 'Hydrated Parent Todo',
          completed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          isPinned: false,
          order: 0,
          expanded: false,
          version: 1,
          pomodoroCount: 0,
        },
      ]

      store.todoExpansionState = {
        'hydrated-parent': false,
      }
      store.localTodos = hydratedTodos
      await nextTick()

      expect(store.todos).toHaveLength(1)
      expect(store.todos[0].expanded).toBe(false)
    })
  })
})
