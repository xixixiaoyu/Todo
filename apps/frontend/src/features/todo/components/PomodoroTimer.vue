<script setup lang="ts">
import { usePomodoroStore } from '../stores/pomodoro'
import { Play, Pause, Square, Target, X, GripVertical, Minimize2, Maximize2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useGsap } from '@/composables/useGsap'
import { watch, ref, computed } from 'vue'
import { useDraggable, useWindowSize } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { nativeService } from '@/services/native'

const pomodoroStore = usePomodoroStore()
const { t } = useI18n()
const { gsap } = useGsap()

const isWails = () => nativeService.platform === 'wails'

const containerRef = ref<HTMLElement | null>(null)
const handleRef = ref<HTMLElement | null>(null)

const { width: windowWidth, height: windowHeight } = useWindowSize()

const { x, y, style } = useDraggable(containerRef, {
  initialValue: {
    x: window.innerWidth > 768 ? window.innerWidth - 320 : (window.innerWidth - 288) / 2,
    y: window.innerWidth > 768 ? 60 : 20,
  },
  handle: handleRef,
  preventDefault: true,
  disabled: computed(() => pomodoroStore.isMiniMode),
})

// Toggle Mini Mode with Wails support
async function toggleMiniMode() {
  pomodoroStore.toggleMiniMode()
  await nativeService.setMiniMode(pomodoroStore.isMiniMode)
}

// Reset draggable position when exiting mini mode
watch(
  () => pomodoroStore.isMiniMode,
  (isMini) => {
    if (!isMini) {
      x.value = window.innerWidth - 320
      y.value = 60
    } else {
      x.value = 0
      y.value = 0
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
      gsap.from(containerRef.value, {
        scale: 0.9,
        opacity: 0,
        y: '+=20',
        duration: 0.5,
        ease: 'elastic.out(1, 0.8)',
      })
    }
  },
)

const progressRingDash = computed(() => (pomodoroStore.isMiniMode ? 400 : 264))
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
      class="fixed z-[100] group"
      :class="[
        pomodoroStore.isMiniMode
          ? 'inset-0 w-full h-full flex items-center justify-center bg-background/80 backdrop-blur-xl'
          : 'w-72',
      ]"
      :style="pomodoroStore.isMiniMode ? {} : style"
    >
      <!-- Main Content -->
      <div
        class="relative bg-card/90 backdrop-blur-xl border border-border/50 shadow-2xl overflow-hidden transition-all duration-300"
        :class="[
          pomodoroStore.isMiniMode
            ? 'w-full h-full border-none flex flex-col items-center justify-center p-4'
            : 'rounded-3xl p-5',
          pomodoroStore.status === 'focus' ? 'ring-2 ring-primary/20' : 'ring-2 ring-orange-500/20',
        ]"
        style="--wails-draggable: drag"
      >
        <!-- Wails Drag Area for Mini Mode (Enhanced) -->
        <div v-if="pomodoroStore.isMiniMode && isWails()" class="absolute inset-0 z-0"></div>

        <!-- Header Controls -->
        <div
          class="relative z-20 flex items-center justify-between w-full"
          :class="pomodoroStore.isMiniMode ? 'absolute top-2 px-4' : 'px-1 mb-4'"
          style="--wails-draggable: no-drag"
        >
          <div
            v-if="!pomodoroStore.isMiniMode"
            ref="handleRef"
            class="flex items-center gap-2 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors"
          >
            <GripVertical class="w-4 h-4 opacity-50" />
            <Badge
              variant="secondary"
              class="text-[10px] uppercase tracking-wider font-bold py-0.5 px-2 bg-primary/10 text-primary border-none"
            >
              {{ t(`pomodoro.status.${pomodoroStore.status}`) }}
            </Badge>
          </div>

          <div class="flex items-center gap-1 ml-auto">
            <!-- Mini Mode Status Indicator -->
            <div v-if="pomodoroStore.isMiniMode" class="mr-auto">
              <Badge
                variant="secondary"
                class="text-[9px] uppercase tracking-tighter font-black py-0 px-1.5 bg-primary/20 text-primary border-none"
              >
                {{ t(`pomodoro.status.${pomodoroStore.status}`) }}
              </Badge>
            </div>

            <!-- Mini Mode Toggle -->
            <Button
              v-if="isWails()"
              variant="ghost"
              size="icon"
              class="w-7 h-7 rounded-full hover:bg-primary/10 transition-colors"
              @click="toggleMiniMode"
            >
              <Maximize2 v-if="pomodoroStore.isMiniMode" class="w-3.5 h-3.5" />
              <Minimize2 v-else class="w-3.5 h-3.5" />
            </Button>

            <!-- Reset/Close Button (Only in Full Mode) -->
            <Button
              v-if="!pomodoroStore.isMiniMode"
              variant="ghost"
              size="icon"
              class="w-7 h-7 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors"
              @click="pomodoroStore.resetTimer"
            >
              <X class="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        <!-- Timer Display -->
        <div
          class="relative z-10 flex flex-col items-center justify-center"
          :class="pomodoroStore.isMiniMode ? 'py-0 mt-2' : 'py-4'"
        >
          <div class="relative flex items-center justify-center">
            <!-- Progress Ring (SVG) -->
            <svg
              class="transform -rotate-90 transition-all duration-500 ease-out"
              :class="pomodoroStore.isMiniMode ? 'w-36 h-36' : 'w-44 h-44'"
            >
              <circle
                cx="50%"
                cy="50%"
                :r="pomodoroStore.isMiniMode ? '44%' : '44%'"
                class="stroke-muted/5 fill-none"
                stroke-width="6"
              />
              <circle
                cx="50%"
                cy="50%"
                :r="pomodoroStore.isMiniMode ? '44%' : '44%'"
                class="stroke-primary fill-none transition-all duration-700 ease-in-out"
                :stroke-width="pomodoroStore.isMiniMode ? 6 : 8"
                stroke-linecap="round"
                :stroke-dasharray="progressRingDash"
                :stroke-dashoffset="progressRingDash * (1 - pomodoroStore.progress / 100)"
              />
            </svg>

            <!-- Time Text -->
            <div
              class="absolute inset-0 flex flex-col items-center justify-center"
              style="--wails-draggable: no-drag"
            >
              <span
                class="font-mono font-black tracking-tighter tabular-nums transition-all leading-none"
                :class="[
                  pomodoroStore.isMiniMode ? 'text-4xl' : 'text-5xl',
                  pomodoroStore.isRunning
                    ? 'text-primary drop-shadow-[0_0_8px_hsla(var(--primary),0.3)]'
                    : 'text-foreground/80',
                ]"
              >
                {{ pomodoroStore.formattedTime }}
              </span>
              <span
                v-if="!pomodoroStore.isMiniMode"
                class="text-[11px] text-muted-foreground mt-2 uppercase font-bold tracking-[0.2em] opacity-60"
              >
                {{ pomodoroStore.isRunning ? t('common.focusing') : t('common.paused') }}
              </span>

              <!-- Mini Mode Task Title -->
              <div
                v-else-if="pomodoroStore.activeTodo"
                class="flex items-center gap-1.5 mt-2 px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 backdrop-blur-sm animate-in fade-in zoom-in duration-500"
              >
                <span class="text-[10px] text-primary font-bold truncate max-w-[120px]">
                  {{ pomodoroStore.activeTodo.title }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Task Info (Only in Full Mode) -->
        <div
          v-if="!pomodoroStore.isMiniMode && pomodoroStore.activeTodo"
          class="relative z-10 mt-2 px-4 py-4 rounded-2xl bg-muted/20 border border-border/40"
        >
          <div class="flex items-center gap-4">
            <div
              class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"
            >
              <Target class="w-5 h-5 text-primary" />
            </div>
            <div class="flex-1 min-w-0">
              <p
                class="text-[10px] text-muted-foreground uppercase font-bold tracking-widest opacity-70 mb-0.5"
              >
                {{ t('common.current_task') }}
              </p>
              <p class="text-sm font-bold truncate text-foreground/90">
                {{ pomodoroStore.activeTodo.title }}
              </p>
            </div>
          </div>
        </div>

        <!-- Controls (Only in Full Mode) -->
        <div
          v-if="!pomodoroStore.isMiniMode"
          class="relative z-10 flex items-center justify-center gap-6 mt-8 no-drag"
          style="--wails-draggable: no-drag"
        >
          <Button
            v-if="!pomodoroStore.isRunning"
            variant="default"
            size="icon"
            class="w-16 h-16 rounded-[2rem] shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all bg-primary text-primary-foreground"
            @click="pomodoroStore.resumeTimer"
          >
            <Play class="w-8 h-8 fill-current translate-x-0.5" />
          </Button>
          <Button
            v-else
            variant="secondary"
            size="icon"
            class="w-16 h-16 rounded-[2rem] shadow-lg hover:scale-105 active:scale-95 transition-all"
            @click="pomodoroStore.pauseTimer"
          >
            <Pause class="w-8 h-8 fill-current" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            class="w-12 h-12 rounded-2xl hover:bg-destructive/10 hover:text-destructive transition-all opacity-60 hover:opacity-100"
            @click="pomodoroStore.resetTimer"
          >
            <Square class="w-5 h-5 fill-current" />
          </Button>
        </div>

        <!-- Background Decor -->
        <div
          class="absolute -bottom-10 -right-10 w-32 h-32 bg-primary/5 rounded-full blur-3xl"
        ></div>
        <div
          class="absolute -top-10 -left-10 w-32 h-32 bg-orange-500/5 rounded-full blur-3xl"
        ></div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.font-mono {
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'tnum';
}

/* Glassmorphism subtle glow */
.bg-card\/90 {
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.05) inset,
    0 20px 50px -12px rgba(0, 0, 0, 0.5);
}

:root.dark .bg-card\/90 {
  background-color: rgba(28, 25, 23, 0.9);
}
</style>
