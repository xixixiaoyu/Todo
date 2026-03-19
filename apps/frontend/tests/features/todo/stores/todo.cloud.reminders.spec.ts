import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import {
  REMINDER_LOOP_TIMER_KEY,
  startLocalReminderLoop,
} from '@/features/todo/stores/todo.cloud.reminders'
import type { Todo } from '@/features/todo/stores/todo'

type ReminderRuntime = typeof globalThis & {
  [REMINDER_LOOP_TIMER_KEY]?: ReturnType<typeof setInterval>
}

function clearReminderTimer(): void {
  const runtime = globalThis as ReminderRuntime
  const timer = runtime[REMINDER_LOOP_TIMER_KEY]
  if (!timer) return
  clearInterval(timer)
  delete runtime[REMINDER_LOOP_TIMER_KEY]
}

function createTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: 'todo-1',
    title: 'Read docs',
    completed: false,
    order: 0,
    isPinned: false,
    version: 0,
    pomodoroCount: 0,
    createdAt: new Date('2026-03-20T00:00:00.000Z'),
    updatedAt: new Date('2026-03-20T00:00:00.000Z'),
    ...overrides,
  }
}

describe('todo.cloud.reminders', () => {
  beforeEach(() => {
    clearReminderTimer()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-20T08:00:00.000Z'))
  })

  afterEach(() => {
    clearReminderTimer()
    vi.useRealTimers()
  })

  it('triggers local reminders without remote sync side effects', () => {
    const todos = ref([
      createTodo({
        title: 'Local reminder',
        remindAt: new Date('2026-03-20T07:59:00.000Z'),
      }),
    ])
    const notifyReminder = vi.fn()
    const debouncedSync = vi.fn()

    startLocalReminderLoop({
      todos,
      isRemoteSource: ref(false),
      notifyReminder,
      debouncedSync,
    })

    vi.advanceTimersByTime(15_000)

    expect(notifyReminder).toHaveBeenCalledWith('Local reminder')
    expect(notifyReminder).toHaveBeenCalledTimes(1)
    expect(todos.value[0].remindedAt).toBeInstanceOf(Date)
    expect(todos.value[0].syncStatus).toBeUndefined()
    expect(debouncedSync).not.toHaveBeenCalled()
  })

  it('marks pending and syncs when reminder fires in remote mode', () => {
    const todos = ref([
      createTodo({
        title: 'Remote reminder',
        remindAt: new Date('2026-03-20T07:59:00.000Z'),
      }),
    ])
    const notifyReminder = vi.fn()
    const debouncedSync = vi.fn()

    startLocalReminderLoop({
      todos,
      isRemoteSource: ref(true),
      notifyReminder,
      debouncedSync,
    })

    vi.advanceTimersByTime(15_000)
    vi.advanceTimersByTime(15_000)

    expect(notifyReminder).toHaveBeenCalledWith('Remote reminder')
    expect(notifyReminder).toHaveBeenCalledTimes(1)
    expect(todos.value[0].remindedAt).toBeInstanceOf(Date)
    expect(todos.value[0].syncStatus).toBe('pending')
    expect(debouncedSync).toHaveBeenCalledTimes(1)
  })
})
