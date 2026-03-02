import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { usePomodoroStore } from '@/features/todo/stores/pomodoro'

const mockToast = {
  success: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
}

vi.mock('@/composables/useToast', () => ({
  useToast: () => mockToast,
}))

vi.mock('@/i18n', () => ({
  default: {
    global: {
      t: (key: string) => key,
    },
  },
}))

describe('usePomodoroStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'))
    vi.clearAllMocks()
  })

  const advanceTime = (ms: number) => {
    vi.advanceTimersByTime(ms)
    vi.setSystemTime(new Date(Date.now() + ms))
  }

  it('should initialize with default values', () => {
    const store = usePomodoroStore()
    expect(store.status).toBe('idle')
    expect(store.timeLeft).toBe(25 * 60)
    expect(store.activeTodoId).toBeNull()
    expect(store.completedSessions).toBe(0)
  })

  it('should start focus correctly', async () => {
    const store = usePomodoroStore()
    await store.startFocus('todo-1')
    expect(store.status).toBe('focus')
    expect(store.activeTodoId).toBe('todo-1')
  })

  it('should count down correctly', async () => {
    const store = usePomodoroStore()
    await store.startFocus('todo-1')

    advanceTime(1000)
    expect(store.timeLeft).toBe(25 * 60 - 1)
  })

  it('should transition to break after focus completes', async () => {
    const store = usePomodoroStore()
    await store.startFocus('todo-1')

    // Fast forward to exactly the end
    advanceTime(25 * 60 * 1000)

    // One more tick to trigger completion logic
    advanceTime(1000)

    expect(store.status).toBe('short_break')
    expect(store.timeLeft).toBe(5 * 60)
    expect(store.completedSessions).toBe(1)
    expect(mockToast.success).toHaveBeenCalledWith('pomodoro.focusComplete')
  })

  it('should show info toast after break completes', async () => {
    const store = usePomodoroStore()
    // Manual setup for break completion test
    store.status = 'short_break'
    store.timeLeft = 0
    store.resumeTimer()
    advanceTime(1000)

    expect(store.status).toBe('idle')
    expect(mockToast.info).toHaveBeenCalledWith('pomodoro.shortBreakComplete')
  })

  it('should pause and resume timer', async () => {
    const store = usePomodoroStore()
    await store.startFocus('todo-1')
    advanceTime(1000)

    store.pauseTimer()
    const timeLeft = store.timeLeft
    advanceTime(1000)
    expect(store.timeLeft).toBe(timeLeft)

    store.resumeTimer()
    advanceTime(1000)
    expect(store.timeLeft).toBe(timeLeft - 1)
  })
})
