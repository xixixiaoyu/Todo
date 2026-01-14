import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
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
  })
})
