import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { usePomodoroStore } from '@/features/todo/stores/pomodoro'

describe('usePomodoroStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })

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

    vi.advanceTimersByTime(1000)
    expect(store.timeLeft).toBe(25 * 60 - 1)
  })

  it('should transition to break after focus completes', async () => {
    const store = usePomodoroStore()
    await store.startFocus('todo-1')

    // Fast forward to 0
    vi.advanceTimersByTime(25 * 60 * 1000)
    expect(store.timeLeft).toBe(0)
    expect(store.status).toBe('focus')

    // One more tick to trigger completion
    vi.advanceTimersByTime(1000)

    expect(store.status).toBe('short_break')
    expect(store.completedSessions).toBe(1)
  })

  it('should pause and resume timer', async () => {
    const store = usePomodoroStore()
    await store.startFocus('todo-1')
    vi.advanceTimersByTime(1000)

    store.pauseTimer()
    const timeLeft = store.timeLeft
    vi.advanceTimersByTime(1000)
    expect(store.timeLeft).toBe(timeLeft)

    store.resumeTimer()
    vi.advanceTimersByTime(1000)
    expect(store.timeLeft).toBe(timeLeft - 1)
  })
})
