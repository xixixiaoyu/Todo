import { debounce } from 'lodash-es'
import type { Ref } from 'vue'
import type { Todo as SharedTodo, SyncConflict as SharedSyncConflict } from '@lumina/shared'
import { todoApi } from '../api'
import type { Todo, TodoSyncConflict } from './todo.types'
import i18n from '@/i18n'
import { useToast } from '@/composables/useToast'
import { toDate } from './todo.dates'

const SYNC_COOLDOWN_MS = 2000

export function createTodoCloud(deps: {
  todos: Ref<Todo[]>
  loading: Ref<boolean>
  error: Ref<string | null>
  lastSyncAt: Ref<string | null>
  syncOwnerId: Ref<number | null>
  syncConflicts: Ref<TodoSyncConflict[]>
  toSharedTodo: (todo: Todo) => SharedTodo
  isTrashLoaded: Ref<boolean>
}): {
  sync: (retryCount?: number) => Promise<void>
  debouncedSync: () => void
  mergeOnLogin: (userId: number) => Promise<void>
  resetSyncStatus: () => void
  acceptSyncConflict: (id: string) => void
  retrySyncConflict: (id: string) => void
  clearSyncConflicts: () => void
  initSocketListener: () => Promise<void>
  deleteTodoPermanently: (id: string) => Promise<void>
  clearTrash: () => Promise<void>
} {
  let isSocketInitialized = false
  const toast = useToast()
  const { t } = i18n.global

  let lastSyncCallAt = 0

  const cloneTodo = (todo: Todo): Todo => ({
    ...todo,
    dueAt: todo.dueAt ? new Date(todo.dueAt) : undefined,
    remindAt: todo.remindAt ? new Date(todo.remindAt) : undefined,
    remindedAt: todo.remindedAt ? new Date(todo.remindedAt) : undefined,
    createdAt: new Date(todo.createdAt),
    updatedAt: new Date(todo.updatedAt),
    completedAt: todo.completedAt ? new Date(todo.completedAt) : undefined,
    deletedAt: todo.deletedAt ? new Date(todo.deletedAt) : undefined,
  })

  const toLocalTodo = (serverTodo: SharedTodo): Todo => ({
    id: serverTodo.id,
    title: serverTodo.title,
    completed: serverTodo.completed,
    order: serverTodo.order,
    isPinned: serverTodo.isPinned,
    parentId: serverTodo.parentId,
    version: serverTodo.version,
    pomodoroCount: serverTodo.pomodoroCount,
    dueAt: serverTodo.dueAt ? new Date(serverTodo.dueAt) : undefined,
    remindAt: serverTodo.remindAt ? new Date(serverTodo.remindAt) : undefined,
    remindedAt: serverTodo.remindedAt ? new Date(serverTodo.remindedAt) : undefined,
    createdAt: new Date(serverTodo.createdAt),
    updatedAt: new Date(serverTodo.updatedAt),
    completedAt: serverTodo.completedAt ? new Date(serverTodo.completedAt) : undefined,
    deletedAt: serverTodo.deletedAt ? new Date(serverTodo.deletedAt) : undefined,
    syncStatus: 'synced' as const,
  })

  async function sync(retryCount = 0): Promise<void> {
    if (deps.loading.value && retryCount === 0) return

    // 防止在极短时间内多次请求同步
    const now = Date.now()
    if (retryCount === 0 && now - lastSyncCallAt < SYNC_COOLDOWN_MS) {
      return
    }

    const authStore = (await import('@/features/auth/stores/auth')).useAuthStore()
    authStore.hydrateFromStorage()
    if (!authStore.isAuthenticated) return

    deps.loading.value = true
    lastSyncCallAt = now
    try {
      let useSocketModule
      try {
        useSocketModule = await import('@/composables/useSocket')
      } catch (importErr: unknown) {
        console.error('Failed to load socket module, possibly due to a new deployment:', importErr)

        const message = importErr instanceof Error ? importErr.message : String(importErr)
        const isChunkError =
          message.includes('Failed to fetch dynamically imported module') ||
          message.includes('error loading dynamically imported module')

        if (isChunkError) {
          // 如果是 Chunk 错误，说明是新版本发布导致旧资源失效，不再重试，直接提示刷新
          toast.error(t('common.versionUpdated'), 0)
          deps.error.value = 'common.versionUpdated'
          throw importErr
        }

        if (retryCount === 0) {
          toast.error(t('common.versionUpdated'))
        }
        throw importErr
      }
      const { useSocket } = useSocketModule
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

      const { synced, deletedIds, acceptedIds, conflicts, serverTime } = response.data
      const acceptedIdSet = new Set(acceptedIds ?? [])
      const conflictIdSet = new Set((conflicts ?? []).map((item) => item.id))
      const shouldFallbackMarkSynced =
        acceptedIds === undefined && conflicts === undefined && conflictIdSet.size === 0
      const serverTodoMap = new Map<string, Todo>()
      const nextSyncConflicts = [...deps.syncConflicts.value]

      pendingTodos.forEach((t) => {
        const snapshotTime = syncSnapshots.get(t.id)
        if (snapshotTime !== new Date(t.updatedAt).getTime()) return
        if (acceptedIdSet.has(t.id) || shouldFallbackMarkSynced) {
          t.syncStatus = 'synced'
          return
        }
        if (conflictIdSet.has(t.id)) {
          t.syncStatus = 'error'
        }
      })

      if (synced && Array.isArray(synced)) {
        synced.forEach((serverTodo: SharedTodo) => {
          const todoData = toLocalTodo(serverTodo)
          serverTodoMap.set(serverTodo.id, todoData)
          if (conflictIdSet.has(serverTodo.id)) {
            return
          }
          const index = deps.todos.value.findIndex((t) => t.id === serverTodo.id)

          if (index !== -1) {
            deps.todos.value[index] = { ...deps.todos.value[index], ...todoData }
          } else {
            deps.todos.value.push(todoData)
          }
        })

        deps.todos.value = [...deps.todos.value]
      }

      ;(conflicts ?? []).forEach((conflict: SharedSyncConflict) => {
        const index = deps.todos.value.findIndex((x) => x.id === conflict.id)
        const localDraft = index !== -1 ? cloneTodo(deps.todos.value[index]) : undefined
        const serverSnapshot = serverTodoMap.get(conflict.id)
        const existingIndex = nextSyncConflicts.findIndex((x) => x.id === conflict.id)
        const conflictItem: TodoSyncConflict = {
          id: conflict.id,
          reason: conflict.reason,
          serverVersion: conflict.serverVersion,
          localDraft,
          serverSnapshot,
          occurredAt: new Date(),
        }
        if (existingIndex !== -1) {
          nextSyncConflicts[existingIndex] = conflictItem
        } else {
          nextSyncConflicts.push(conflictItem)
        }
      })

      deps.syncConflicts.value = nextSyncConflicts.filter((item) =>
        deps.todos.value.some((todo) => todo.id === item.id),
      )

      if (deletedIds && deletedIds.length > 0) {
        const deletedSet = new Set(deletedIds)
        deps.todos.value = deps.todos.value.filter((t) => !deletedSet.has(t.id))
        deps.syncConflicts.value = deps.syncConflicts.value.filter(
          (item) => !deletedSet.has(item.id),
        )
      }

      deps.lastSyncAt.value = serverTime
      deps.error.value = null
    } catch (err: unknown) {
      console.error(`Sync failed (attempt ${retryCount + 1}):`, err)

      const message = err instanceof Error ? err.message : String(err)
      const isChunkError =
        message.includes('Failed to fetch dynamically imported module') ||
        message.includes('error loading dynamically imported module')

      if (isChunkError) {
        // Chunk 错误由内部 catch 或全局 handler 处理，不再重试
        return
      }

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

  const debouncedSync = debounce(() => void sync(), SYNC_COOLDOWN_MS)

  const onTodosSync = () => {
    // 只有当存在待同步项，或距离上次同步已超过 SYNC_COOLDOWN_MS 时才触发同步
    const hasPending = deps.todos.value.some((t) => t.syncStatus === 'pending')
    const now = Date.now()
    if (hasPending || now - lastSyncCallAt > SYNC_COOLDOWN_MS) {
      debouncedSync()
    }
  }

  const onTodosRemind = (payload: { todoId: string; remindedAt?: string }) => {
    const todo = deps.todos.value.find((x) => x.id === payload.todoId)
    if (!todo || todo.deletedAt || todo.completed) return

    if (!todo.remindedAt) {
      toast.info(t('todo.reminderToast', { title: todo.title }))
    }

    todo.remindedAt = payload.remindedAt ? new Date(payload.remindedAt) : new Date()
    todo.syncStatus = 'synced'
  }

  const startLocalReminderLoop = (() => {
    let started = false
    return () => {
      if (started) return
      started = true
      setInterval(() => {
        const now = Date.now()
        for (const todo of deps.todos.value) {
          if (todo.deletedAt || todo.completed) continue
          if (!todo.remindAt || todo.remindedAt) continue
          const remindAt = toDate(todo.remindAt)
          if (!remindAt) continue
          if (remindAt.getTime() > now) continue

          toast.info(t('todo.reminderToast', { title: todo.title }))
          todo.remindedAt = new Date()
          todo.updatedAt = new Date()
          todo.syncStatus = 'pending'
          debouncedSync()
        }
      }, 15_000)
    }
  })()

  async function mergeOnLogin(userId: number): Promise<void> {
    if (deps.syncOwnerId.value !== null && deps.syncOwnerId.value !== userId) {
      deps.todos.value = []
    }

    deps.syncOwnerId.value = userId
    deps.lastSyncAt.value = null
    deps.isTrashLoaded.value = false

    deps.todos.value.forEach((t) => {
      if (!t.syncStatus) t.syncStatus = 'pending'
    })

    await sync()
  }

  function resetSyncStatus(): void {
    deps.isTrashLoaded.value = false
  }

  function clearSyncConflicts(): void {
    deps.syncConflicts.value = []
  }

  function acceptSyncConflict(id: string): void {
    const conflict = deps.syncConflicts.value.find((item) => item.id === id)
    if (!conflict) return

    if (conflict.reason === 'TOMBSTONED' || conflict.reason === 'OWNER_MISMATCH') {
      deps.todos.value = deps.todos.value.filter((todo) => todo.id !== id)
      deps.syncConflicts.value = deps.syncConflicts.value.filter((item) => item.id !== id)
      return
    }

    if (conflict.serverSnapshot) {
      const index = deps.todos.value.findIndex((todo) => todo.id === id)
      if (index !== -1) {
        deps.todos.value[index] = cloneTodo(conflict.serverSnapshot)
      } else {
        deps.todos.value.push(cloneTodo(conflict.serverSnapshot))
      }
    } else {
      const todo = deps.todos.value.find((item) => item.id === id)
      if (todo) {
        todo.syncStatus = 'synced'
      }
    }

    deps.syncConflicts.value = deps.syncConflicts.value.filter((item) => item.id !== id)
  }

  function retrySyncConflict(id: string): void {
    const conflict = deps.syncConflicts.value.find((item) => item.id === id)
    if (!conflict) return

    if (conflict.reason !== 'VERSION_CONFLICT') return

    const localDraft = conflict.localDraft
    if (!localDraft) return

    const index = deps.todos.value.findIndex((todo) => todo.id === id)
    const nextTodo = cloneTodo(localDraft)
    if (typeof conflict.serverVersion === 'number') {
      nextTodo.version = conflict.serverVersion
    }
    nextTodo.updatedAt = new Date()
    nextTodo.syncStatus = 'pending'

    if (index !== -1) {
      deps.todos.value[index] = nextTodo
    } else {
      deps.todos.value.push(nextTodo)
    }

    deps.syncConflicts.value = deps.syncConflicts.value.filter((item) => item.id !== id)
    debouncedSync()
  }

  async function initSocketListener(): Promise<void> {
    if (isSocketInitialized) return

    isSocketInitialized = true
    startLocalReminderLoop()

    const authStore = (await import('@/features/auth/stores/auth')).useAuthStore()
    authStore.hydrateFromStorage()

    const attach = async (force = false) => {
      if (!force && !authStore.isAuthenticated) return
      const { useSocket } = await import('@/composables/useSocket')
      const { connect } = useSocket()
      const socket = connect()
      if (!socket) return

      socket.off('todos:sync', onTodosSync)
      socket.on('todos:sync', onTodosSync)

      socket.off('todos:remind', onTodosRemind)
      socket.on('todos:remind', onTodosRemind)
    }

    await attach()

    if (typeof authStore.$subscribe !== 'function') return

    authStore.$subscribe((_mutation, state) => {
      if (state.token) {
        void attach(true)
      }
    })
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
    acceptSyncConflict,
    retrySyncConflict,
    clearSyncConflicts,
    initSocketListener,
    deleteTodoPermanently,
    clearTrash,
  }
}
