import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useTodoStore } from '@/features/todo/stores/todo'
import { todoApi } from '@/features/todo/api'
import type { SyncResponse } from '@lumina/shared'

const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
  once: vi.fn(),
  emit: vi.fn(),
}

const connectMock = vi.fn(() => mockSocket)
const waitForConnectionMock = vi.fn().mockResolvedValue('mock-socket-id')

let authStoreMock: {
  isAuthenticated: boolean
  token: string | null
  hydrateFromStorage: () => void
  $subscribe?: (cb: (mutation: unknown, state: { token?: string | null }) => void) => void
} = {
  isAuthenticated: true,
  token: 'mock-token',
  hydrateFromStorage: vi.fn(),
  $subscribe: vi.fn(),
}

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
    ...authStoreMock,
  })),
}))

// Mock useSocket
vi.mock('@/composables/useSocket', () => ({
  useSocket: () => ({
    socketId: { value: 'mock-socket-id' },
    connect: connectMock,
    waitForConnection: waitForConnectionMock,
  }),
}))

describe('Todo Store Sync', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    localStorage.clear()

    authStoreMock = {
      isAuthenticated: true,
      token: 'mock-token',
      hydrateFromStorage: vi.fn(),
      $subscribe: vi.fn(),
    }
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
            version: 0,
            pomodoroCount: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        deletedIds: [],
        version: 0,
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

    expect(store.lastSyncAt).toBe(mockResponse.data.serverTime)
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

    await store.mergeOnLogin(1)

    // Should have called sync
    expect(todoApi.sync).toHaveBeenCalled()
    // Local todos should be marked as synced after successful sync
    expect(store.todos.every((t) => t.syncStatus === 'synced')).toBe(true)
  })

  it('should clear local todos when login user changes', async () => {
    const store = useTodoStore()

    store.syncOwnerId = 1
    store.todos = [
      {
        id: 'local-old-user',
        title: 'Local Old User Todo',
        completed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        syncStatus: 'pending',
        order: 0,
        isPinned: false,
        version: 0,
        pomodoroCount: 0,
      },
    ]

    const mockResponse = {
      data: {
        synced: [
          {
            id: 'server-new-user',
            title: 'Server New User Todo',
            completed: false,
            order: 0,
            isPinned: false,
            version: 1,
            pomodoroCount: 0,
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

    await store.mergeOnLogin(2)

    expect(store.syncOwnerId).toBe(2)
    expect(store.todos.some((t) => t.id === 'local-old-user')).toBe(false)
    expect(store.todos.some((t) => t.id === 'server-new-user')).toBe(true)
  })

  it('should handle deletedIds from server', async () => {
    const store = useTodoStore()

    // Add a todo that exists locally
    store.todos = [
      {
        id: 'to-be-deleted',
        title: 'Existing Todo',
        completed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        syncStatus: 'synced',
        order: 0,
        isPinned: false,
        version: 0,
        pomodoroCount: 0,
      },
    ]

    const mockResponse = {
      data: {
        synced: [],
        deletedIds: ['to-be-deleted'],
        version: 0,
        serverTime: new Date().toISOString(),
      } as SyncResponse,
    }
    vi.mocked(todoApi.sync).mockResolvedValue(
      mockResponse as unknown as Awaited<ReturnType<typeof todoApi.sync>>,
    )

    await store.sync()

    // Should be removed from local store
    expect(store.todos.find((t) => t.id === 'to-be-deleted')).toBeUndefined()
  })

  it('should mark todo as error when server reports conflict', async () => {
    const store = useTodoStore()

    store.todos = [
      {
        id: 'conflict-todo',
        title: 'Conflict Todo',
        completed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        syncStatus: 'pending',
        order: 0,
        isPinned: false,
        version: 3,
        pomodoroCount: 0,
      },
    ]

    const mockResponse = {
      data: {
        synced: [],
        deletedIds: [],
        acceptedIds: [],
        conflicts: [
          {
            id: 'conflict-todo',
            reason: 'VERSION_CONFLICT',
            serverVersion: 4,
          },
        ],
        serverTime: new Date().toISOString(),
      } as SyncResponse,
    }

    vi.mocked(todoApi.sync).mockResolvedValue(
      mockResponse as unknown as Awaited<ReturnType<typeof todoApi.sync>>,
    )

    await store.sync()

    expect(store.todos[0].syncStatus).toBe('error')
  })

  it('should purge logically deleted items after successful sync', async () => {
    const store = useTodoStore()

    // Add a todo and then delete it locally
    const id = await store.addTodo('Delete Me')
    await store.deleteTodo(id!)

    const todo = store.todos.find((t) => t.id === id)
    expect(todo?.deletedAt).toBeDefined()
    expect(todo?.syncStatus).toBe('pending')

    const mockResponse = {
      data: {
        synced: [],
        deletedIds: [],
        version: 0,
        serverTime: new Date().toISOString(),
      } as SyncResponse,
    }
    vi.mocked(todoApi.sync).mockResolvedValue(
      mockResponse as unknown as Awaited<ReturnType<typeof todoApi.sync>>,
    )

    await store.sync()

    // Logically deleted and synced items should remain in memory for Trash view
    expect(store.todos.find((t) => t.id === id)).toBeDefined()
    expect(store.todos.find((t) => t.id === id)?.deletedAt).toBeDefined()
  })

  it('should attach todos:sync listener after login when initially unauthenticated', async () => {
    const subscribers: Array<(mutation: unknown, state: { token?: string | null }) => void> = []

    authStoreMock.isAuthenticated = false
    authStoreMock.token = null
    authStoreMock.$subscribe = vi.fn((cb) => {
      subscribers.push(cb)
    })

    const store = useTodoStore()

    await store.initSocketListener()
    expect(connectMock).not.toHaveBeenCalled()

    authStoreMock.isAuthenticated = true
    authStoreMock.token = 'new-token'
    subscribers.forEach((cb) => cb({}, { token: 'new-token' }))

    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(connectMock).toHaveBeenCalled()
    expect(mockSocket.off).toHaveBeenCalledWith('todos:sync', expect.any(Function))
    expect(mockSocket.on).toHaveBeenCalledWith('todos:sync', expect.any(Function))
  })
})
