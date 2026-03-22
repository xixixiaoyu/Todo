import { debounce } from 'lodash-es'
import {
  unwrapApiResponse,
  type SyncConflict as SharedSyncConflict,
  type Todo as SharedTodo,
} from '@lumina/shared'
import i18n from '@/i18n'
import { useToast } from '@/composables/useToast'
import { todoApi } from '../api'
import { mapServerTodoToLocalTodo } from './todo.actions.common'
import { buildTodoSyncConflict } from './todo.cloud.conflicts'
import type { TodoCloudDataDeps } from './todo.cloud.types'
import { cloneTodo } from './todo.dates'

const SYNC_COOLDOWN_MS = 2_000

function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return (
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('error loading dynamically imported module')
  )
}

export function createTodoCloudSyncActions(deps: TodoCloudDataDeps): {
  sync: (retryCount?: number) => Promise<void>
  debouncedSync: () => void
  mergeOnLogin: (userId: number) => Promise<void>
  resetSyncStatus: () => void
  getLastSyncCallAt: () => number
} {
  const toast = useToast()
  const { t } = i18n.global
  let lastSyncCallAt = 0

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
      const serverTodoMap = new Map<string, ReturnType<typeof mapServerTodoToLocalTodo>>()
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
          const todoData = mapServerTodoToLocalTodo(serverTodo)
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
        const conflictItem = buildTodoSyncConflict(conflict, localDraft, serverSnapshot)
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

  return {
    sync,
    debouncedSync,
    mergeOnLogin,
    resetSyncStatus,
    getLastSyncCallAt: () => lastSyncCallAt,
  }
}
