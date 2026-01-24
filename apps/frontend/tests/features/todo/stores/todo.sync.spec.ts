import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useTodoStore } from '@/features/todo/stores/todo'
import { todoApi } from '@/features/todo/api'
import type { SyncResponse } from '@my-app/shared'

// Mock todoApi
vi.mock('@/features/todo/api', () => ({
  todoApi: {
    sync: vi.fn(),
    findAll: vi.fn(),
  },
}))

// Mock auth store
vi.mock('@/features/auth/stores/auth', () => ({
  useAuthStore: vi.fn(() => ({
    isAuthenticated: true,
  })),
}))

describe('Todo Store Sync', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('should sync pending todos and update lastSyncAt', async () => {
    const store = useTodoStore()

    // Add a pending todo
    await store.addTodo('Test Todo')
    const pendingTodo = store.todos[0]
    expect(pendingTodo.syncStatus).toBe('pending')

    const mockResponse = {
      data: {
        synced: [
          {
            id: 'server-id',
            title: 'Server Todo',
            completed: false,
            order: 0,
            isPinned: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        deletedIds: [],
        serverTime: new Date().toISOString(),
      } as SyncResponse,
    }

    vi.mocked(todoApi.sync).mockResolvedValue(
      mockResponse as unknown as Awaited<ReturnType<typeof todoApi.sync>>,
    )

    await store.sync()

    // Check if pending todo was synced (status updated)
    expect(pendingTodo.syncStatus).toBe('synced')

    // Check if server todo was added
    expect(store.todos.some((t) => t.id === 'server-id')).toBe(true)

    // Check if lastSyncAt was saved
    expect(localStorage.getItem('todo_last_sync_at')).toBe(mockResponse.data.serverTime)
  })

  it('should merge data on login', async () => {
    const store = useTodoStore()

    // Add some local data
    await store.addTodo('Local Todo 1')
    await store.addTodo('Local Todo 2')

    const mockResponse = {
      data: {
        synced: [],
        deletedIds: [],
        serverTime: new Date().toISOString(),
      } as SyncResponse,
    }
    vi.mocked(todoApi.sync).mockResolvedValue(
      mockResponse as unknown as Awaited<ReturnType<typeof todoApi.sync>>,
    )

    await store.mergeOnLogin()

    // Should have called sync
    expect(todoApi.sync).toHaveBeenCalled()
    // Local todos should be marked as synced after successful sync
    expect(store.todos.every((t) => t.syncStatus === 'synced')).toBe(true)
  })
})
