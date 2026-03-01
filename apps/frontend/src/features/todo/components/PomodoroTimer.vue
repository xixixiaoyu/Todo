<script setup lang="ts">
import { usePomodoroStore } from '../stores/pomodoro'
import { GripVertical, Minimize2, X } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useGsap } from '@/composables/useGsap'
import { nativeService } from '@/services/native'
import { ref, watch, computed } from 'vue'
import { useDraggable, useWindowSize } from '@vueuse/core'
import { useI18n } from 'vue-i18n'

// Subcomponents
import PomodoroEarth from './pomodoro/PomodoroEarth.vue'
import PomodoroTimerDisplay from './pomodoro/PomodoroTimerDisplay.vue'
import PomodoroTimerControls from './pomodoro/PomodoroTimerControls.vue'
import PomodoroTaskInfo from './pomodoro/PomodoroTaskInfo.vue'
import PomodoroMiniControls from './pomodoro/PomodoroMiniControls.vue'

const pomodoroStore = usePomodoroStore()
const { t } = useI18n()
const { gsap, ctx } = useGsap()

const isWails = () => nativeService.platform === 'wails'

const containerRef = ref<HTMLElement | null>(null)
const handleRef = ref<HTMLElement | null>(null)

const { width: windowWidth, height: windowHeight } = useWindowSize()

const { x, y } = useDraggable(containerRef, {
  initialValue: {
    x: window.innerWidth > 768 ? window.innerWidth - 320 : (window.innerWidth - 288) / 2,
    y: window.innerWidth > 768 ? 60 : 20,
  },
  handle: handleRef,
  preventDefault: true,
  disabled: computed(() => pomodoroStore.isMiniMode),
})

// Calculate centered position for browser mini mode
const miniPosition = computed(() => {
  if (isWails()) return { x: 0, y: 0, width: '100%', height: '100%' }
  const w = 220
  const h = 180

  return {
    x: (windowWidth.value - w) / 2,
    y: (windowHeight.value - h) / 2,
    width: `${w}px`,
    height: `${h}px`,
  }
})

const containerStyle = computed(() => {
  if (pomodoroStore.isMiniMode) {
    if (isWails()) return { left: 0, top: 0, width: '100vw', height: '100vh' }
    return {
      left: `${miniPosition.value.x}px`,
      top: `${miniPosition.value.y}px`,
      width: miniPosition.value.width,
      height: miniPosition.value.height,
    }
  }
  return {
    left: `${x.value}px`,
    top: `${y.value}px`,
    width: '18rem', // w-72
    height: 'auto',
  }
})

function toggleMiniMode() {
  const enteringMini = !pomodoroStore.isMiniMode
  pomodoroStore.toggleMiniMode()

  if (enteringMini && !pomodoroStore.isRunning && pomodoroStore.status !== 'idle') {
    pomodoroStore.resumeTimer()
  }
}

// Animation for mode transitions
watch(
  () => pomodoroStore.isMiniMode,
  (isMini) => {
    if (containerRef.value) {
      ctx.add(() => {
        gsap.fromTo(
          containerRef.value,
          {
            scale: isMini ? 1.1 : 0.9,
            opacity: 0.8,
          },
          {
            scale: 1,
            opacity: 1,
            duration: 0.6,
            ease: 'power3.out',
          },
        )
      })
    }
    if (!isMini && !isWails()) {
      x.value = window.innerWidth - 320
      y.value = 60
    }
  },
)

// Ensure the timer stays within window bounds on resize
watch([windowWidth, windowHeight], ([newW, newH]) => {
  if (pomodoroStore.isMiniMode) return
  if (x.value + 288 > newW) x.value = newW - 320
  if (y.value + 200 > newH) y.value = newH - 240
  if (x.value < 0) x.value = 20
  if (y.value < 0) y.value = 20
})

// Animation for status changes
watch(
  () => pomodoroStore.status,
  (newStatus) => {
    if (newStatus !== 'idle' && containerRef.value) {
      // Entry animation
      ctx.add(() => {
        gsap.fromTo(
          containerRef.value,
          {
            scale: 0.8,
            opacity: 0,
            y: 40,
            rotateX: 10,
          },
          {
            scale: 1,
            opacity: 1,
            y: 0,
            rotateX: 0,
            duration: 0.8,
            ease: 'expo.out',
          },
        )
      })
    }
  },
)
</script>

<template>
  <Transition
    appear
    enter-active-class="transition-all duration-500 ease-out"
    enter-from-class="opacity-0 scale-95 translate-y-4"
    enter-to-class="opacity-100 scale-100 translate-y-0"
  >
    <div
      v-if="pomodoroStore.status !== 'idle' || pomodoroStore.isMiniMode"
      ref="containerRef"
      class="fixed z-[100] group transition-all duration-500 ease-out-quart"
      :style="containerStyle"
    >
      <!-- Background (Three.js Earth) -->
      <PomodoroEarth />

      <!-- Main Content Container -->
      <div
        class="relative w-full h-full transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)]"
      >
        <div
          class="relative backdrop-blur-3xl overflow-hidden transition-all duration-700 h-full w-full group/card"
          :class="[
            pomodoroStore.isMiniMode
              ? 'rounded-[3rem] flex flex-col border border-white/10'
              : 'rounded-[2.5rem] p-6 bg-white/80 dark:bg-neutral-900/80 shadow-2xl border border-white/40 dark:border-white/10',
            !pomodoroStore.isMiniMode && pomodoroStore.status === 'focus'
              ? 'ring-1 ring-rose-500/10'
              : !pomodoroStore.isMiniMode
                ? 'ring-1 ring-emerald-500/10'
                : '',
          ]"
          :style="{
            backgroundColor: pomodoroStore.isMiniMode
              ? pomodoroStore.isEarthReady
                ? 'rgba(0, 0, 0, 0.2)'
                : 'rgba(10, 25, 47, 0.6)' // More substantial blue-ish dark background when earth is not ready
              : '',
            boxShadow: pomodoroStore.isMiniMode
              ? '0 20px 40px -15px rgba(0, 0, 0, 0.3), inset 0 0 0 1px rgba(255, 255, 255, 0.1)'
              : '0 40px 80px -20px rgba(0, 0, 0, 0.2), inset 0 0 0 1px rgba(255, 255, 255, 0.5)',
            '--wails-draggable': 'drag',
            transform: 'translateZ(0)',
          }"
        >
          <!-- Wails Drag Area for Mini Mode -->
          <div v-if="pomodoroStore.isMiniMode && isWails()" class="absolute inset-0 z-0"></div>

          <!-- Dynamic Background Glows (Full Mode Only) - Simplified for Minimalism -->
          <div
            v-if="!pomodoroStore.isMiniMode"
            class="absolute inset-0 overflow-hidden pointer-events-none z-0"
          >
            <div
              class="absolute inset-0 transition-all duration-1000"
              :style="{
                background:
                  pomodoroStore.status === 'focus'
                    ? 'radial-gradient(circle at 50% 50%, rgba(244, 63, 94, 0.05) 0%, transparent 70%)'
                    : 'radial-gradient(circle at 50% 50%, rgba(16, 185, 129, 0.05) 0%, transparent 70%)',
              }"
            ></div>
          </div>

          <!-- Mini Mode Controls -->
          <PomodoroMiniControls v-if="pomodoroStore.isMiniMode" />

          <!-- Full Mode Header -->
          <div
            v-else
            class="relative z-20 w-full flex items-center justify-between px-2 mb-6"
            style="--wails-draggable: no-drag"
          >
            <div
              ref="handleRef"
              class="flex items-center gap-3 cursor-grab active:cursor-grabbing group/handle"
            >
              <div
                class="w-8 h-8 rounded-xl bg-foreground/5 flex items-center justify-center transition-colors group-hover/handle:bg-foreground/10"
              >
                <GripVertical class="w-4 h-4 text-foreground/40" />
              </div>
              <Badge
                variant="secondary"
                class="text-[10px] uppercase tracking-[0.2em] font-black py-1 px-3 bg-foreground/5 text-foreground/60 border-none rounded-lg"
              >
                {{ t(`pomodoro.status.${pomodoroStore.status}`) }}
              </Badge>
            </div>

            <div class="flex items-center gap-1.5 justify-end flex-1">
              <Button
                variant="ghost"
                size="icon"
                class="w-8 h-8 rounded-full hover:bg-foreground/5 active:scale-90 transition-all text-foreground/20 hover:text-foreground/50"
                @click="toggleMiniMode"
              >
                <Minimize2 class="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                class="w-8 h-8 rounded-full hover:bg-destructive/5 hover:text-destructive active:scale-90 transition-all text-foreground/20"
                @click="pomodoroStore.resetTimer"
              >
                <X class="w-4 h-4" />
              </Button>
            </div>
          </div>

          <!-- Timer Display (Shared) -->
          <PomodoroTimerDisplay />

          <!-- Full Mode Only Content -->
          <template v-if="!pomodoroStore.isMiniMode">
            <PomodoroTaskInfo />
            <PomodoroTimerControls />
          </template>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* Sophisticated Glassmorphism */
.backdrop-blur-3xl {
  backdrop-filter: blur(40px) saturate(180%);
  -webkit-backdrop-filter: blur(40px) saturate(180%);
}

.dark .bg-white\/70 {
  background-color: rgba(0, 0, 0, 0.6);
}

.ease-out-quart {
  transition-timing-function: cubic-bezier(0.25, 1, 0.5, 1);
}

span {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
</style>
