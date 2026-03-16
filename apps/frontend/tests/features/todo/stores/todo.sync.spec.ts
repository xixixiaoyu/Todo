import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { useTodoStore } from '@/features/todo/stores/todo'
import { todoApi } from '@/features/todo/api'
import type { SyncResponse } from '@lumina/shared'

const REMINDER_LOOP_TIMER_KEY = '__luminaTodoReminderLoopTimer__' as const
type ReminderRuntime = typeof globalThis & {
  [REMINDER_LOOP_TIMER_KEY]?: ReturnType<typeof setInterval>
}

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
  user?: { id: number }
  hydrateFromStorage: () => void
  $subscribe?: (cb: (mutation: unknown, state: { token?: string | null }) => void) => void
} = {
  isAuthenticated: true,
  token: 'mock-token',
  user: { id: 1 },
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
    const runtime = globalThis as ReminderRuntime
    const reminderTimer = runtime[REMINDER_LOOP_TIMER_KEY]
    if (reminderTimer) {
      clearInterval(reminderTimer)
      delete runtime[REMINDER_LOOP_TIMER_KEY]
    }

    setActivePinia(createPinia())
    vi.clearAllMocks()
    localStorage.clear()

    authStoreMock = {
      isAuthenticated: true,
      token: 'mock-token',
      user: { id: 1 },
      hydrateFromStorage: vi.fn(),
      $subscribe: vi.fn(),
    }
  })

  async function createRemoteStore() {
    const store = useTodoStore()
    store.todoSource = 'remote'
    await nextTick()
    return store
  }

  it('should sync pending todos and update lastSyncAt', async () => {
    const store = await createRemoteStore()

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
    const store = await createRemoteStore()

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

  it('should keep local drafts isolated when logging in from local source', async () => {
    const store = useTodoStore()

    await store.addTodo('Local Draft 1')
    await store.addTodo('Local Draft 2')

    const syncSpy = vi.mocked(todoApi.sync).mockImplementation(async (payload) => ({
      success: true,
      data: {
        synced: [
          {
            id: 'remote-only',
            title: 'Remote Only',
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
        acceptedIds: payload.todos.map((todo) => todo.id),
        conflicts: [],
        serverTime: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    }))

    await store.mergeOnLogin(1)

    expect(store.todoSource).toBe('remote')
    expect(syncSpy).toHaveBeenCalledTimes(1)
    expect(syncSpy.mock.calls[0][0].todos).toHaveLength(0)
    expect(store.todos.some((todo) => todo.id === 'remote-only')).toBe(true)
    expect(store.todos.some((todo) => todo.title === 'Local Draft 1')).toBe(false)
    expect(store.todos.some((todo) => todo.title === 'Local Draft 2')).toBe(false)
    expect(store.localTodos.some((todo) => todo.title === 'Local Draft 1')).toBe(true)
    expect(store.localTodos.some((todo) => todo.title === 'Local Draft 2')).toBe(true)
  })

  it('should clear local todos when login user changes', async () => {
    const store = await createRemoteStore()

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
    const store = await createRemoteStore()

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
    const store = await createRemoteStore()

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
    expect(store.syncConflicts).toHaveLength(1)
    expect(store.syncConflicts[0].id).toBe('conflict-todo')
    expect(store.syncConflicts[0].reason).toBe('VERSION_CONFLICT')
  })

  it('should keep local draft on conflict and accept server snapshot manually', async () => {
    const store = await createRemoteStore()

    store.todos = [
      {
        id: 'conflict-todo',
        title: 'Local Draft',
        completed: false,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:01.000Z'),
        syncStatus: 'pending',
        order: 0,
        isPinned: false,
        version: 3,
        pomodoroCount: 0,
      },
    ]

    const mockResponse = {
      data: {
        synced: [
          {
            id: 'conflict-todo',
            title: 'Server Latest',
            completed: true,
            order: 2,
            isPinned: true,
            version: 4,
            pomodoroCount: 3,
            createdAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
            updatedAt: new Date('2026-01-01T00:00:05.000Z').toISOString(),
          },
        ],
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

    expect(store.todos[0].title).toBe('Local Draft')
    expect(store.todos[0].syncStatus).toBe('error')

    store.acceptSyncConflict('conflict-todo')

    expect(store.syncConflicts).toHaveLength(0)
    expect(store.todos[0].title).toBe('Server Latest')
    expect(store.todos[0].syncStatus).toBe('synced')
  })

  it('should retry local conflict with server version baseline', async () => {
    const store = await createRemoteStore()

    store.todos = [
      {
        id: 'conflict-todo',
        title: 'Local Draft',
        completed: false,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:01.000Z'),
        syncStatus: 'pending',
        order: 0,
        isPinned: false,
        version: 3,
        pomodoroCount: 0,
      },
    ]

    const firstSyncResponse = {
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

    const secondSyncResponse = {
      data: {
        synced: [],
        deletedIds: [],
        acceptedIds: ['conflict-todo'],
        conflicts: [],
        serverTime: new Date().toISOString(),
      } as SyncResponse,
    }

    vi.mocked(todoApi.sync)
      .mockResolvedValueOnce(
        firstSyncResponse as unknown as Awaited<ReturnType<typeof todoApi.sync>>,
      )
      .mockResolvedValueOnce(
        secondSyncResponse as unknown as Awaited<ReturnType<typeof todoApi.sync>>,
      )

    await store.sync(1)
    store.retrySyncConflict('conflict-todo')
    await store.sync(1)

    const retriedTodo = store.todos.find((t) => t.id === 'conflict-todo')
    expect(retriedTodo?.version).toBe(4)
    expect(retriedTodo?.syncStatus).toBe('synced')
    expect(store.syncConflicts).toHaveLength(0)
  })

  it('should purge logically deleted items after successful sync', async () => {
    const store = await createRemoteStore()

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

  it('should keep local snapshot available after switching source', async () => {
    const store = useTodoStore()
    await store.addTodo('Local Only')

    const mockResponse = {
      data: {
        synced: [
          {
            id: 'remote-1',
            title: 'Remote Only',
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

    await store.switchTodoSource('remote')
    expect(store.todos.some((t) => t.id === 'remote-1')).toBe(true)
    expect(store.todos.some((t) => t.title === 'Local Only')).toBe(false)

    await store.switchTodoSource('local')
    expect(store.todos.some((t) => t.title === 'Local Only')).toBe(true)
    expect(store.todos.some((t) => t.id === 'remote-1')).toBe(false)
  })

  it('should clear remote todos on logout reset', async () => {
    const store = await createRemoteStore()
    store.remoteTodos = [
      {
        id: 'remote-1',
        title: 'Remote Todo',
        completed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        syncStatus: 'synced',
        order: 0,
        isPinned: false,
        version: 1,
        pomodoroCount: 0,
      },
    ]
    store.todos = [...store.remoteTodos]
    store.syncOwnerId = 1
    store.lastSyncAt = new Date().toISOString()

    store.clearRemoteOnLogout()

    expect(store.todoSource).toBe('local')
    expect(store.remoteTodos).toHaveLength(0)
    expect(store.syncOwnerId).toBeNull()
    expect(store.lastSyncAt).toBeNull()
  })

  it('should attach todos:sync listener after login when initially unauthenticated', async () => {
    const subscribers: Array<(mutation: unknown, state: { token?: string | null }) => void> = []

    authStoreMock.isAuthenticated = false
    authStoreMock.token = null
    authStoreMock.$subscribe = vi.fn((cb) => {
      subscribers.push(cb)
    })

    const store = await createRemoteStore()

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

  it('should keep local reminder loop singleton across store instances', async () => {
    const intervalSpy = vi.spyOn(globalThis, 'setInterval')

    const store1 = await createRemoteStore()
    await store1.initSocketListener()

    setActivePinia(createPinia())
    const store2 = await createRemoteStore()
    await store2.initSocketListener()

    expect(intervalSpy).toHaveBeenCalledTimes(1)
    intervalSpy.mockRestore()
  })

  it('should not apply stale remote sync result after switching back to local', async () => {
    const store = useTodoStore()
    await store.addTodo('Local Base')

    let resolveSync!: (value: Awaited<ReturnType<typeof todoApi.sync>>) => void
    const pendingSync = new Promise<Awaited<ReturnType<typeof todoApi.sync>>>((resolve) => {
      resolveSync = resolve
    })
    vi.mocked(todoApi.sync).mockImplementationOnce(async () => pendingSync)

    const switchToRemotePromise = store.switchTodoSource('remote')
    await vi.waitFor(() => {
      expect(todoApi.sync).toHaveBeenCalledTimes(1)
    })

    await store.switchTodoSource('local')
    expect(store.todoSource).toBe('local')

    resolveSync({
      success: true,
      data: {
        synced: [
          {
            id: 'remote-race',
            title: 'Remote Race',
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
        acceptedIds: [],
        conflicts: [],
        serverTime: new Date().toISOString(),
      } as SyncResponse,
      timestamp: new Date().toISOString(),
    } as Awaited<ReturnType<typeof todoApi.sync>>)
    await switchToRemotePromise
    await nextTick()

    expect(store.todoSource).toBe('local')
    expect(store.todos.some((todo) => todo.title === 'Local Base')).toBe(true)
    expect(store.todos.some((todo) => todo.id === 'remote-race')).toBe(false)
  })
})
