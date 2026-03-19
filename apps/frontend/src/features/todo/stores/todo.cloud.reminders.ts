import type { Ref } from 'vue'
import { toDate } from './todo.dates'
import type { Todo } from './todo.types'

export const REMINDER_LOOP_TIMER_KEY = '__luminaTodoReminderLoopTimer__' as const

type ReminderRuntime = typeof globalThis & {
  [REMINDER_LOOP_TIMER_KEY]?: ReturnType<typeof setInterval>
}

export function startLocalReminderLoop(deps: {
  todos: Ref<Todo[]>
  isRemoteSource: Ref<boolean>
  notifyReminder: (title: string) => void
  debouncedSync: () => void
}): void {
  const runtime = globalThis as ReminderRuntime
  if (runtime[REMINDER_LOOP_TIMER_KEY]) return

  runtime[REMINDER_LOOP_TIMER_KEY] = setInterval(() => {
    const now = Date.now()
    for (const todo of deps.todos.value) {
      if (todo.deletedAt || todo.completed) continue
      if (!todo.remindAt || todo.remindedAt) continue

      const remindAt = toDate(todo.remindAt)
      if (!remindAt) continue
      if (remindAt.getTime() > now) continue

      deps.notifyReminder(todo.title)
      todo.remindedAt = new Date()
      todo.updatedAt = new Date()
      if (deps.isRemoteSource.value) {
        todo.syncStatus = 'pending'
        deps.debouncedSync()
      }
    }
  }, 15_000)
}
