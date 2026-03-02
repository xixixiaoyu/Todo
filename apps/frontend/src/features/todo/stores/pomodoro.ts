import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { ImpactStyle, NotificationType } from '@capacitor/haptics'
import { useTodoStore } from './todo'
import { nativeService } from '@/services/native'

export type PomodoroStatus = 'idle' | 'focus' | 'short_break' | 'long_break'

export interface PomodoroHistory {
  date: string // YYYY-MM-DD
  minutes: number
}

export const usePomodoroStore = defineStore(
  'pomodoro',
  () => {
    const todoStore = useTodoStore()

    // Configuration (minutes)
    const FOCUS_TIME = 25
    const SHORT_BREAK = 5
    const LONG_BREAK = 15

    // State
    const status = ref<PomodoroStatus>('idle')
    const timeLeft = ref(FOCUS_TIME * 60)
    const activeTodoId = ref<string | null>(null)
    const timerInterval = ref<number | null>(null)
    const targetEndTime = ref<number | null>(null)
    const completedSessions = ref(0)
    const history = ref<PomodoroHistory[]>([])
    const isMiniMode = ref(false)
    const isEarthReady = ref(false)

    // Actions
    async function syncWailsWindow() {
      await nativeService.setMiniMode(isMiniMode.value)
    }

    // Watch for mini mode changes to sync with Wails
    watch(
      isMiniMode,
      () => {
        void syncWailsWindow()
      },
      { immediate: true },
    )

    // Computed
    const activeTodo = computed(() =>
      activeTodoId.value ? todoStore.todos.find((t) => t.id === activeTodoId.value) : null,
    )

    const progress = computed(() => {
      const total =
        status.value === 'focus'
          ? FOCUS_TIME * 60
          : status.value === 'short_break'
            ? SHORT_BREAK * 60
            : LONG_BREAK * 60
      return ((total - timeLeft.value) / total) * 100
    })

    const formattedTime = computed(() => {
      const mins = Math.floor(timeLeft.value / 60)
      const secs = timeLeft.value % 60
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    })

    // Actions
    async function startFocus(todoId: string) {
      if (timerInterval.value) clearInterval(timerInterval.value)

      activeTodoId.value = todoId
      status.value = 'focus'
      timeLeft.value = FOCUS_TIME * 60
      isMiniMode.value = true

      await nativeService.haptic(ImpactStyle.Medium)

      startTimer()
    }

    function startTimer() {
      if (timerInterval.value) clearInterval(timerInterval.value)

      // Calculate target end time for robust background operation
      targetEndTime.value = Date.now() + timeLeft.value * 1000

      // Use window.setInterval to ensure browser context and cast to number
      timerInterval.value = window.setInterval(() => {
        const now = Date.now()
        if (targetEndTime.value && now < targetEndTime.value) {
          timeLeft.value = Math.ceil((targetEndTime.value - now) / 1000)
        } else {
          timeLeft.value = 0
          void handleTimerComplete()
        }
      }, 1000) as unknown as number
    }

    function pauseTimer() {
      if (timerInterval.value) {
        clearInterval(timerInterval.value)
        timerInterval.value = null
        targetEndTime.value = null
      }
    }

    function resumeTimer() {
      if (!timerInterval.value && status.value !== 'idle') {
        startTimer()
      }
    }

    function resetTimer() {
      pauseTimer()
      status.value = 'idle'
      activeTodoId.value = null
      timeLeft.value = FOCUS_TIME * 60
      isMiniMode.value = false
    }

    async function handleTimerComplete() {
      pauseTimer()

      if (status.value === 'focus') {
        completedSessions.value++

        // Record history
        const today = new Date().toLocaleDateString('sv-SE')
        const existingEntry = history.value.find((h) => h.date === today)
        if (existingEntry) {
          existingEntry.minutes += FOCUS_TIME
        } else {
          history.value.push({ date: today, minutes: FOCUS_TIME })
        }

        if (completedSessions.value % 4 === 0) {
          status.value = 'long_break'
          timeLeft.value = LONG_BREAK * 60
        } else {
          status.value = 'short_break'
          timeLeft.value = SHORT_BREAK * 60
        }
        // Increment pomodoro count on the active todo
        if (activeTodoId.value) {
          todoStore.incrementPomodoro(activeTodoId.value)
        }
      } else {
        status.value = 'idle'
        timeLeft.value = FOCUS_TIME * 60
      }

      // Haptic feedback for completion
      await nativeService.hapticNotification(NotificationType.Success)
    }

    function toggleMiniMode() {
      isMiniMode.value = !isMiniMode.value
    }

    return {
      status,
      timeLeft,
      activeTodoId,
      activeTodo,
      progress,
      formattedTime,
      completedSessions,
      history,
      isMiniMode,
      isEarthReady,
      isRunning: computed(() => !!timerInterval.value),
      startFocus,
      pauseTimer,
      resumeTimer,
      resetTimer,
      toggleMiniMode,
    }
  },
  {
    persist: {
      key: 'pomodoro',
      storage: localStorage,
      pick: ['completedSessions', 'history', 'isMiniMode', 'status', 'timeLeft', 'activeTodoId'],
    },
  },
)
