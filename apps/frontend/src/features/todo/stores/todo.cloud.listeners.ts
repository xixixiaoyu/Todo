import i18n from '@/i18n'
import { useToast } from '@/composables/useToast'
import { nativeService } from '@/services/native'
import { startLocalReminderLoop } from './todo.cloud.reminders'
import type { TodoCloudDataDeps } from './todo.cloud.types'

export function createTodoCloudListenerActions(
  deps: TodoCloudDataDeps,
  debouncedSync: () => void,
  getLastSyncCallAt: () => number,
): {
  initSocketListener: () => Promise<void>
} {
  let isSocketInitialized = false
  const toast = useToast()
  const { t } = i18n.global

  const notifyReminder = (title: string) => {
    const message = t('todo.reminderToast', { title })
    toast.info(message)
    void nativeService.notify(t('common.appName'), message, 'info', { force: true }).catch(() => {})
  }

  const onTodosSync = () => {
    if (!deps.isRemoteSource.value) return
    const hasPending = deps.todos.value.some((todo) => todo.syncStatus === 'pending')
    const now = Date.now()
    if (hasPending || now - getLastSyncCallAt() > 2_000) {
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

  return {
    initSocketListener,
  }
}
