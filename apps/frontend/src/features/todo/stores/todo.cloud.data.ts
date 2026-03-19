import { debounce } from 'lodash-es'
import type { Ref } from 'vue'
import {
  unwrapApiResponse,
  type Todo as SharedTodo,
  type SyncConflict as SharedSyncConflict,
} from '@lumina/shared'
import i18n from '@/i18n'
import { useToast } from '@/composables/useToast'
import { nativeService } from '@/services/native'
import { todoApi } from '../api'
import { cloneTodo } from './todo.dates'
import type { Todo, TodoSyncConflict } from './todo.types'
import { startLocalReminderLoop } from './todo.cloud.reminders'

const SYNC_COOLDOWN_MS = 2_000

interface TodoCloudDataDeps {
  todos: Ref<Todo[]>
  remoteTodos: Ref<Todo[]>
  loading: Ref<boolean>
  error: Ref<string | null>
  lastSyncAt: Ref<string | null>
  syncOwnerId: Ref<number | null>
  syncConflicts: Ref<TodoSyncConflict[]>
  isTrashLoaded: Ref<boolean>
  isRemoteSource: Ref<boolean>
  toSharedTodo: (todo: Todo) => SharedTodo
}

function toLocalTodo(serverTodo: SharedTodo): Todo {
  return {
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
    recurrenceRule: serverTodo.recurrenceRule || null,
    recurrenceTz: serverTodo.recurrenceTz || null,
    recurrenceSpawnedAt: serverTodo.recurrenceSpawnedAt
      ? new Date(serverTodo.recurrenceSpawnedAt)
      : undefined,
    createdAt: new Date(serverTodo.createdAt),
    updatedAt: new Date(serverTodo.updatedAt),
    completedAt: serverTodo.completedAt ? new Date(serverTodo.completedAt) : undefined,
    deletedAt: serverTodo.deletedAt ? new Date(serverTodo.deletedAt) : undefined,
    syncStatus: 'synced' as const,
  }
}

function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return (
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('error loading dynamically imported module')
  )
}

function buildSyncConflict(
  conflict: SharedSyncConflict,
  localDraft: Todo | undefined,
  serverSnapshot: Todo | undefined,
): TodoSyncConflict {
  return {
    id: conflict.id,
    reason: conflict.reason,
    serverVersion: conflict.serverVersion,
    localDraft,
    serverSnapshot,
    occurredAt: new Date(),
  }
}

export function createTodoCloudData(deps: TodoCloudDataDeps): {
  sync: (retryCount?: number) => Promise<void>
  debouncedSync: () => void
  fetchTrash: () => Promise<void>
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

  const notifyReminder = (title: string) => {
    const message = t('todo.reminderToast', { title })
    toast.info(message)
    void nativeService.notify(t('common.appName'), message, 'info', { force: true }).catch(() => {})
  }

  async function fetchTrash(): Promise<void> {
    if (deps.isTrashLoaded.value) return

    const { useAuthStore } = await import('@/features/auth/stores/auth')
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated || !deps.isRemoteSource.value) return

    deps.loading.value = true
    try {
      const response = await todoApi.findTrash()
      if (response.success && Array.isArray(response.data)) {
        response.data.forEach((serverTodo) => {
          const index = deps.todos.value.findIndex((todo) => todo.id === serverTodo.id)
          const todoData = toLocalTodo(serverTodo)

          if (index !== -1) {
            deps.todos.value[index] = { ...deps.todos.value[index], ...todoData }
          } else {
            deps.todos.value.push(todoData)
          }
        })
        deps.isTrashLoaded.value = true
      }
    } catch (error) {
      console.error('Failed to fetch trash:', error)
      deps.error.value = 'todo.syncFailed'
    } finally {
      deps.loading.value = false
    }
  }

  async function sync(retryCount = 0): Promise<void> {
    if (!deps.isRemoteSource.value) return
    if (deps.loading.value && retryCount === 0) return

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
      } catch (importError: unknown) {
        console.error(
          'Failed to load socket module, possibly due to a new deployment:',
          importError,
        )

        if (isChunkLoadError(importError)) {
          toast.error(t('common.versionUpdated'), 0)
          deps.error.value = 'common.versionUpdated'
          throw importError
        }

        if (retryCount === 0) {
          toast.error(t('common.versionUpdated'))
        }
        throw importError
      }

      const { useSocket } = useSocketModule
      const { waitForConnection } = useSocket()
      const currentSocketId = await waitForConnection()

      const pendingTodos = deps.todos.value.filter((todo) => todo.syncStatus !== 'synced')
      const pendingTodoIds = pendingTodos.map((todo) => todo.id)
      const syncSnapshots = new Map(
        pendingTodos.map((todo) => [todo.id, new Date(todo.updatedAt).getTime()]),
      )

      const response = await todoApi.sync(
        {
          todos: pendingTodos.map((todo) => deps.toSharedTodo(todo)),
          lastSyncAt: deps.lastSyncAt.value || undefined,
        },
        currentSocketId,
      )

      const { synced, deletedIds, acceptedIds, conflicts, serverTime } = unwrapApiResponse(response)
      const acceptedIdSet = new Set(acceptedIds ?? [])
      const conflictIdSet = new Set((conflicts ?? []).map((item) => item.id))
      const shouldFallbackMarkSynced =
        acceptedIds === undefined && conflicts === undefined && conflictIdSet.size === 0
      const serverTodoMap = new Map<string, Todo>()
      const nextSyncConflicts = [...deps.syncConflicts.value]
      const applyToActiveRemote = deps.isRemoteSource.value
      let syncTargetTodos = applyToActiveRemote ? deps.todos.value : deps.remoteTodos.value

      pendingTodoIds.forEach((id) => {
        const snapshotTime = syncSnapshots.get(id)
        const targetTodo = syncTargetTodos.find((todo) => todo.id === id)
        if (!targetTodo || snapshotTime !== new Date(targetTodo.updatedAt).getTime()) return
        if (acceptedIdSet.has(id) || shouldFallbackMarkSynced) {
          targetTodo.syncStatus = 'synced'
          return
        }
        if (conflictIdSet.has(id)) {
          targetTodo.syncStatus = 'error'
        }
      })

      if (synced && Array.isArray(synced)) {
        synced.forEach((serverTodo: SharedTodo) => {
          const todoData = toLocalTodo(serverTodo)
          serverTodoMap.set(serverTodo.id, todoData)
          if (conflictIdSet.has(serverTodo.id)) {
            return
          }

          const index = syncTargetTodos.findIndex((todo) => todo.id === serverTodo.id)
          if (index !== -1) {
            syncTargetTodos[index] = { ...syncTargetTodos[index], ...todoData }
          } else {
            syncTargetTodos.push(todoData)
          }
        })
      }

      ;(conflicts ?? []).forEach((conflict: SharedSyncConflict) => {
        const index = syncTargetTodos.findIndex((todo) => todo.id === conflict.id)
        const localDraft = index !== -1 ? cloneTodo(syncTargetTodos[index]) : undefined
        const serverSnapshot = serverTodoMap.get(conflict.id)
        const existingIndex = nextSyncConflicts.findIndex((item) => item.id === conflict.id)
        const conflictItem = buildSyncConflict(conflict, localDraft, serverSnapshot)
        if (existingIndex !== -1) {
          nextSyncConflicts[existingIndex] = conflictItem
        } else {
          nextSyncConflicts.push(conflictItem)
        }
      })

      deps.syncConflicts.value = nextSyncConflicts.filter((item) =>
        syncTargetTodos.some((todo) => todo.id === item.id),
      )

      if (deletedIds && deletedIds.length > 0) {
        const deletedSet = new Set(deletedIds)
        syncTargetTodos = syncTargetTodos.filter((todo) => !deletedSet.has(todo.id))
        deps.syncConflicts.value = deps.syncConflicts.value.filter(
          (item) => !deletedSet.has(item.id),
        )
      }

      if (applyToActiveRemote) {
        deps.todos.value = [...syncTargetTodos]
      } else {
        deps.remoteTodos.value = [...syncTargetTodos]
      }

      deps.lastSyncAt.value = serverTime
      deps.error.value = null
    } catch (error) {
      console.error(`Sync failed (attempt ${retryCount + 1}):`, error)

      if (isChunkLoadError(error)) {
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
    if (!deps.isRemoteSource.value) return
    const hasPending = deps.todos.value.some((todo) => todo.syncStatus === 'pending')
    const now = Date.now()
    if (hasPending || now - lastSyncCallAt > SYNC_COOLDOWN_MS) {
      debouncedSync()
    }
  }

  const onTodosRemind = (payload: { todoId: string; remindedAt?: string }) => {
    if (!deps.isRemoteSource.value) return

    const todo = deps.todos.value.find((item) => item.id === payload.todoId)
    if (!todo || todo.deletedAt || todo.completed) return

    if (!todo.remindedAt) {
      notifyReminder(todo.title)
    }

    todo.remindedAt = payload.remindedAt ? new Date(payload.remindedAt) : new Date()
    todo.syncStatus = 'synced'
  }

  async function mergeOnLogin(userId: number): Promise<void> {
    if (!deps.isRemoteSource.value) return
    if (deps.syncOwnerId.value !== null && deps.syncOwnerId.value !== userId) {
      deps.todos.value = []
    }

    deps.syncOwnerId.value = userId
    deps.lastSyncAt.value = null
    deps.isTrashLoaded.value = false

    deps.todos.value.forEach((todo) => {
      if (!todo.syncStatus) todo.syncStatus = 'pending'
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
    if (!conflict || conflict.reason !== 'VERSION_CONFLICT') return

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
    startLocalReminderLoop({
      todos: deps.todos,
      isRemoteSource: deps.isRemoteSource,
      notifyReminder,
      debouncedSync,
    })

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
    const index = deps.todos.value.findIndex((todo) => todo.id === id)
    if (index === -1) return

    const children = deps.todos.value.filter((todo) => todo.parentId === id)
    for (const child of children) {
      await deleteTodoPermanently(child.id)
    }

    deps.todos.value.splice(index, 1)

    const authStore = (await import('@/features/auth/stores/auth')).useAuthStore()
    if (authStore.isAuthenticated && deps.isRemoteSource.value) {
      try {
        await todoApi.deletePermanently(id)
      } catch (error) {
        console.error('Failed to delete todo permanently:', error)
      }
    }
  }

  async function clearTrash(): Promise<void> {
    deps.todos.value = deps.todos.value.filter((todo) => !todo.deletedAt)

    const authStore = (await import('@/features/auth/stores/auth')).useAuthStore()
    if (authStore.isAuthenticated && deps.isRemoteSource.value) {
      try {
        await todoApi.clearTrash()
      } catch (error) {
        console.error('Failed to clear trash:', error)
      }
    }
  }

  return {
    sync,
    debouncedSync,
    fetchTrash,
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
