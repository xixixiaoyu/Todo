import { debounce } from 'lodash-es'
import type { Ref } from 'vue'
import type { Todo as SharedTodo } from '@my-app/shared'
import { todoApi } from '../api'
import type { Todo } from './todo.types'
import i18n from '@/i18n'
import { useToast } from '@/composables/useToast'
import { toDate } from './todo.dates'

const SYNC_COOLDOWN_MS = 2000

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
  const toast = useToast()
  const { t } = i18n.global

  let lastSyncCallAt = 0

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
            dueAt: serverTodo.dueAt ? new Date(serverTodo.dueAt) : undefined,
            remindAt: serverTodo.remindAt ? new Date(serverTodo.remindAt) : undefined,
            remindedAt: serverTodo.remindedAt ? new Date(serverTodo.remindedAt) : undefined,
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
    initSocketListener,
    deleteTodoPermanently,
    clearTrash,
  }
}
