import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useTodoStore } from '@/features/todo/stores/todo'
import { todoApi } from '@/features/todo/api'

// Mock todoApi
vi.mock('@/features/todo/api', () => ({
  todoApi: {
    findTrash: vi.fn(),
  },
}))

// Mock auth store
vi.mock('@/features/auth/stores/auth', () => ({
  useAuthStore: vi.fn(() => ({
    isAuthenticated: true,
  })),
}))

describe('Todo Store Trash', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  function createRemoteStore() {
    const store = useTodoStore()
    store.todoSource = 'remote'
    return store
  }

  it('should fetch trash and update store when filter is set to trash', async () => {
    const store = createRemoteStore()
    const mockTrashTodos = [
      {
        id: 'trash-1',
        title: 'Deleted Task',
        completed: false,
        order: 0,
        isPinned: false,
        version: 1,
        pomodoroCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: new Date().toISOString(),
      },
    ]

    vi.mocked(todoApi.findTrash).mockResolvedValue({
      success: true,
      data: mockTrashTodos,
      timestamp: new Date().toISOString(),
    } as unknown as Awaited<ReturnType<typeof todoApi.findTrash>>)

    expect(store.isTrashLoaded).toBe(false)

    // Set filter to trash should trigger fetchTrash
    store.setFilter('trash')

    // Wait for the async fetchTrash
    await vi.waitFor(() => expect(store.isTrashLoaded).toBe(true))

    expect(todoApi.findTrash).toHaveBeenCalledTimes(1)
    expect(store.todos).toHaveLength(1)
    expect(store.todos[0].id).toBe('trash-1')
    expect(store.todos[0].syncStatus).toBe('synced')
  })

  it('should not fetch trash again if already loaded', async () => {
    const store = createRemoteStore()
    store.isTrashLoaded = true

    await store.fetchTrash()

    expect(todoApi.findTrash).not.toHaveBeenCalled()
  })

  it('should merge trash items with existing items in store', async () => {
    const store = createRemoteStore()
    store.todos = [
      {
        id: 'trash-1',
        title: 'Old Title',
        completed: false,
        order: 0,
        isPinned: false,
        version: 1,
        pomodoroCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: new Date(),
      },
    ]

    const mockTrashTodos = [
      {
        id: 'trash-1',
        title: 'New Title from Server',
        completed: false,
        order: 0,
        isPinned: false,
        version: 2,
        pomodoroCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: new Date().toISOString(),
      },
    ]

    vi.mocked(todoApi.findTrash).mockResolvedValue({
      success: true,
      data: mockTrashTodos,
      timestamp: new Date().toISOString(),
    } as unknown as Awaited<ReturnType<typeof todoApi.findTrash>>)

    await store.fetchTrash()

    expect(store.todos).toHaveLength(1)
    expect(store.todos[0].title).toBe('New Title from Server')
    expect(store.todos[0].version).toBe(2)
  })
})
