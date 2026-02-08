import { debounce } from 'lodash-es'
import type { Ref } from 'vue'
import type { Todo as SharedTodo } from '@my-app/shared'
import { todoApi } from '../api'
import type { Todo } from './todo.types'

export function createTodoCloud(deps: {
  todos: Ref<Todo[]>
  loading: Ref<boolean>
  error: Ref<string | null>
  lastSyncAt: Ref<string | null>
  toSharedTodo: (todo: Todo) => SharedTodo
}): {
  sync: (retryCount?: number) => Promise<void>
  debouncedSync: () => void
  mergeOnLogin: () => Promise<void>
  resetSyncStatus: () => void
  initSocketListener: () => Promise<void>
  deleteTodoPermanently: (id: string) => Promise<void>
  clearTrash: () => Promise<void>
} {
  let isSocketInitialized = false

  async function sync(retryCount = 0): Promise<void> {
    if (deps.loading.value && retryCount === 0) return

    const authStore = (await import('@/features/auth/stores/auth')).useAuthStore()
    authStore.hydrateFromStorage()
    if (!authStore.isAuthenticated) return

    deps.loading.value = true
    try {
      const { useSocket } = await import('@/composables/useSocket')
      const { waitForConnection } = useSocket()

      const currentSocketId = await waitForConnection()

      const pendingTodos = deps.todos.value.filter((t) => t.syncStatus !== 'synced')

      const syncSnapshots = new Map(
        pendingTodos.map((t) => [t.id, new Date(t.updatedAt).getTime()]),
      )

      const response = await todoApi.sync(
        {
          todos: pendingTodos.map(deps.toSharedTodo),
          lastSyncAt: deps.lastSyncAt.value || undefined,
        },
        currentSocketId,
      )

      const { synced, deletedIds, serverTime } = response.data

      pendingTodos.forEach((t) => {
        const snapshotTime = syncSnapshots.get(t.id)
        if (snapshotTime === new Date(t.updatedAt).getTime()) {
          t.syncStatus = 'synced'
        }
      })

      if (synced && Array.isArray(synced)) {
        synced.forEach((serverTodo: SharedTodo) => {
          const index = deps.todos.value.findIndex((t) => t.id === serverTodo.id)
          const todoData: Todo = {
            id: serverTodo.id,
            title: serverTodo.title,
            completed: serverTodo.completed,
            order: serverTodo.order,
            isPinned: serverTodo.isPinned,
            parentId: serverTodo.parentId,
            version: serverTodo.version,
            pomodoroCount: serverTodo.pomodoroCount,
            createdAt: new Date(serverTodo.createdAt),
            updatedAt: new Date(serverTodo.updatedAt),
            completedAt: serverTodo.completedAt ? new Date(serverTodo.completedAt) : undefined,
            deletedAt: serverTodo.deletedAt ? new Date(serverTodo.deletedAt) : undefined,
            syncStatus: 'synced' as const,
          }

          if (index !== -1) {
            deps.todos.value[index] = { ...deps.todos.value[index], ...todoData }
          } else {
            deps.todos.value.push(todoData)
          }
        })

        deps.todos.value = [...deps.todos.value]
      }

      if (deletedIds && deletedIds.length > 0) {
        const deletedSet = new Set(deletedIds)
        deps.todos.value = deps.todos.value.filter((t) => !deletedSet.has(t.id))
      }

      deps.lastSyncAt.value = serverTime
      deps.error.value = null
    } catch (err) {
      console.error(`Sync failed (attempt ${retryCount + 1}):`, err)

      if (retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 1000
        setTimeout(() => void sync(retryCount + 1), delay)
      } else {
        deps.error.value = 'todo.syncFailed'
      }
    } finally {
      deps.loading.value = false
    }
  }

  const debouncedSync = debounce(() => void sync(), 1000)

  async function mergeOnLogin(): Promise<void> {
    deps.lastSyncAt.value = null

    deps.todos.value.forEach((t) => {
      if (!t.syncStatus) t.syncStatus = 'pending'
    })

    await sync()
  }

  function resetSyncStatus(): void {
    deps.lastSyncAt.value = null
    deps.todos.value.forEach((t) => {
      t.syncStatus = undefined
    })
  }

  async function initSocketListener(): Promise<void> {
    if (isSocketInitialized) return

    const authStore = (await import('@/features/auth/stores/auth')).useAuthStore()
    authStore.hydrateFromStorage()
    if (!authStore.isAuthenticated) return

    const { useSocket } = await import('@/composables/useSocket')
    const { connect } = useSocket()
    const socket = connect()

    if (!socket) return

    socket.on('todos:sync', () => {
      debouncedSync()
    })

    isSocketInitialized = true
  }

  async function deleteTodoPermanently(id: string): Promise<void> {
    const index = deps.todos.value.findIndex((t) => t.id === id)
    if (index === -1) return

    const children = deps.todos.value.filter((t) => t.parentId === id)
    for (const child of children) {
      await deleteTodoPermanently(child.id)
    }

    deps.todos.value.splice(index, 1)

    const authStore = (await import('@/features/auth/stores/auth')).useAuthStore()
    if (authStore.isAuthenticated) {
      try {
        await todoApi.deletePermanently(id)
      } catch (err) {
        console.error('Failed to delete todo permanently:', err)
      }
    }
  }

  async function clearTrash(): Promise<void> {
    deps.todos.value = deps.todos.value.filter((t) => !t.deletedAt)

    const authStore = (await import('@/features/auth/stores/auth')).useAuthStore()
    if (authStore.isAuthenticated) {
      try {
        await todoApi.clearTrash()
      } catch (err) {
        console.error('Failed to clear trash:', err)
      }
    }
  }

  return {
    sync,
    debouncedSync,
    mergeOnLogin,
    resetSyncStatus,
    initSocketListener,
    deleteTodoPermanently,
    clearTrash,
  }
}
