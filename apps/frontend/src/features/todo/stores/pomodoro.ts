import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { ImpactStyle, NotificationType } from '@capacitor/haptics'
import { useTodoStore } from './todo'
import { nativeService } from '@/services/native'
import { useToast } from '@/composables/useToast'
import i18n from '@/i18n'

export type PomodoroStatus = 'idle' | 'focus' | 'short_break' | 'long_break'

export type PomodoroMode = 'classic' | 'icebreaker' | 'flow' | 'cosmos'

export interface PomodoroModeConfig {
  focus: number
  shortBreak: number
  longBreak: number
}

export const POMODORO_MODES: Record<PomodoroMode, PomodoroModeConfig> = {
  classic: { focus: 25, shortBreak: 5, longBreak: 15 },
  icebreaker: { focus: 15, shortBreak: 3, longBreak: 10 },
  flow: { focus: 52, shortBreak: 17, longBreak: 20 },
  cosmos: { focus: 90, shortBreak: 30, longBreak: 45 },
}

export interface PomodoroHistory {
  date: string // YYYY-MM-DD
  minutes: number
}

export const usePomodoroStore = defineStore(
  'pomodoro',
  () => {
    const todoStore = useTodoStore()

    // State
    const status = ref<PomodoroStatus>('idle')
    const currentMode = ref<PomodoroMode>('classic')
    const timeLeft = ref(POMODORO_MODES.classic.focus * 60)
    const activeTodoId = ref<string | null>(null)
    const timerInterval = ref<number | null>(null)
    const targetEndTime = ref<number | null>(null)
    const completedSessions = ref(0)
    const history = ref<PomodoroHistory[]>([])
    const isMiniMode = ref(false)
    const isEarthReady = ref(false)

    // Helper to get current mode times
    const currentModeConfig = computed(() => POMODORO_MODES[currentMode.value])

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
      const config = currentModeConfig.value
      const total =
        status.value === 'focus'
          ? config.focus * 60
          : status.value === 'short_break'
            ? config.shortBreak * 60
            : config.longBreak * 60
      return ((total - timeLeft.value) / total) * 100
    })

    const formattedTime = computed(() => {
      const mins = Math.floor(timeLeft.value / 60)
      const secs = timeLeft.value % 60
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    })

    // Actions
    async function startFocus(todoId: string, mode: PomodoroMode = 'classic') {
      if (timerInterval.value) clearInterval(timerInterval.value)

      activeTodoId.value = todoId
      currentMode.value = mode
      status.value = 'focus'
      timeLeft.value = POMODORO_MODES[mode].focus * 60
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
      if (!timerInterval.value) {
        if (status.value === 'idle' && activeTodoId.value) {
          // If idle but has an active todo, restart the focus session
          startTimer()
          status.value = 'focus'
        } else if (status.value !== 'idle') {
          startTimer()
        }
      }
    }

    function resetTimer() {
      pauseTimer()
      status.value = 'idle'
      activeTodoId.value = null
      timeLeft.value = currentModeConfig.value.focus * 60
      isMiniMode.value = false
    }

    async function handleTimerComplete() {
      pauseTimer()
      const toast = useToast()
      const t = i18n.global.t
      const config = currentModeConfig.value

      const messages: Record<Exclude<PomodoroStatus, 'idle'>, string> = {
        focus: t('pomodoro.focusComplete'),
        short_break: t('pomodoro.shortBreakComplete'),
        long_break: t('pomodoro.longBreakComplete'),
      }

      if (status.value !== 'idle') {
        const message = messages[status.value]
        if (status.value === 'focus') {
          toast.success(message)
        } else {
          toast.info(message)
        }
        void nativeService.notify(t('common.pomodoro'), message)
      }

      if (status.value === 'focus') {
        completedSessions.value++

        // Record history
        const today = new Date().toLocaleDateString('sv-SE')
        const existingEntry = history.value.find((h) => h.date === today)
        if (existingEntry) {
          existingEntry.minutes += config.focus
        } else {
          history.value.push({ date: today, minutes: config.focus })
        }

        if (completedSessions.value % 4 === 0) {
          status.value = 'long_break'
          timeLeft.value = config.longBreak * 60
        } else {
          status.value = 'short_break'
          timeLeft.value = config.shortBreak * 60
        }

        // Increment pomodoro count on the active todo
        if (activeTodoId.value) {
          todoStore.incrementPomodoro(activeTodoId.value)
        }
      } else {
        status.value = 'idle'
        timeLeft.value = config.focus * 60
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
      pick: [
        'completedSessions',
        'history',
        'isMiniMode',
        'status',
        'timeLeft',
        'activeTodoId',
        'currentMode',
      ],
    },
  },
)
