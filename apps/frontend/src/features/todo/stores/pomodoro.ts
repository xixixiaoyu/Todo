import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import { useTodoStore } from './todo'
import { isWails, system } from '@/lib/wails'

export type PomodoroStatus = 'idle' | 'focus' | 'short_break' | 'long_break'

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
    const completedSessions = ref(0)
    const isMiniMode = ref(false)

    // Actions
    async function syncWailsWindow() {
      if (isWails()) {
        try {
          await system.setMiniMode(isMiniMode.value)
        } catch (e) {
          console.error('Failed to sync Wails window state:', e)
        }
      }
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

      try {
        await Haptics.impact({ style: ImpactStyle.Medium })
      } catch {
        // Ignore if not on mobile
      }

      startTimer()
    }

    function startTimer() {
      if (timerInterval.value) clearInterval(timerInterval.value)

      // Use window.setInterval to ensure browser context and cast to number
      timerInterval.value = window.setInterval(() => {
        if (timeLeft.value > 0) {
          timeLeft.value--
        } else {
          void handleTimerComplete()
        }
      }, 1000) as unknown as number
    }

    function pauseTimer() {
      if (timerInterval.value) {
        clearInterval(timerInterval.value)
        timerInterval.value = null
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
    }

    async function handleTimerComplete() {
      pauseTimer()

      // Haptic feedback for completion
      try {
        await Haptics.notification({ type: NotificationType.Success })
      } catch {
        // Ignore if not on mobile
      }

      if (status.value === 'focus') {
        completedSessions.value++
        if (completedSessions.value % 4 === 0) {
          status.value = 'long_break'
          timeLeft.value = LONG_BREAK * 60
        } else {
          status.value = 'short_break'
          timeLeft.value = SHORT_BREAK * 60
        }
        // If a todo was active, we could mark it as partially done or increment a "pomodoro count" on it
      } else {
        status.value = 'idle'
        timeLeft.value = FOCUS_TIME * 60
      }
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
      isMiniMode,
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
      pick: ['completedSessions', 'isMiniMode', 'status', 'timeLeft', 'activeTodoId'],
    },
  },
)
