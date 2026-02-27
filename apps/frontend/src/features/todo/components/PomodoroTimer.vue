<script setup lang="ts">
import { usePomodoroStore } from '../stores/pomodoro'
import { useTodoStore } from '../stores/todo'
import {
  Play,
  Pause,
  Square,
  Target,
  X,
  GripVertical,
  Minimize2,
  Maximize2,
  Sparkles,
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useGsap } from '@/composables/useGsap'
import { watch, ref, computed } from 'vue'
import { useDraggable, useWindowSize } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { nativeService } from '@/services/native'

const pomodoroStore = usePomodoroStore()
const todoStore = useTodoStore()
const { t } = useI18n()
const { gsap } = useGsap()

// Toggle AI Assistant
function toggleAiAssistant() {
  todoStore.setDrawerOpen(!todoStore.isDrawerOpen)
}

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
  // Web (Browser) Positioning Logic: Centered (Focus Mode)
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

// Toggle Mini Mode with Wails support
function toggleMiniMode() {
  const enteringMini = !pomodoroStore.isMiniMode
  pomodoroStore.toggleMiniMode()

  // 如果进入缩小模式且计时器已暂停但未闲置，则自动恢复
  if (enteringMini && !pomodoroStore.isRunning && pomodoroStore.status !== 'idle') {
    pomodoroStore.resumeTimer()
  }
}

// Reset draggable position when exiting mini mode
watch(
  () => pomodoroStore.isMiniMode,
  (isMini) => {
    if (!isMini && !isWails()) {
      // Ensure we don't jump when returning to list mode
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

// Floating animation for mini mode (Disabled as per user request for less movement)
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
      <!-- Overlay Background (Browser Only) -->
      <Transition
        enter-active-class="transition-opacity duration-700"
        leave-active-class="transition-opacity duration-300"
        enter-from-class="opacity-0"
        leave-to-class="opacity-0"
      >
        <div
          v-if="pomodoroStore.isMiniMode && !isWails()"
          class="fixed inset-0 bg-background/30 backdrop-blur-3xl -z-10 pointer-events-none"
        ></div>
      </Transition>

      <!-- Main Content Container -->
      <div class="relative w-full h-full transition-all duration-500 ease-out-quart">
        <!-- Card Content -->
        <div
          class="relative backdrop-blur-3xl border border-white/20 dark:border-white/5 overflow-hidden transition-all duration-700 h-full w-full glass-grain"
          :class="[
            pomodoroStore.isMiniMode
              ? 'rounded-[2.5rem] bg-white/60 dark:bg-black/40 flex flex-col'
              : 'rounded-3xl p-5 bg-card/95 shadow-2xl',
            pomodoroStore.status === 'focus'
              ? 'ring-1 ring-primary/5 shadow-primary/5'
              : 'ring-1 ring-orange-500/5 shadow-orange-500/5',
          ]"
          :style="{
            boxShadow: pomodoroStore.isMiniMode
              ? '0 10px 30px -5px rgba(0, 0, 0, 0.05), 0 20px 50px -10px rgba(0, 0, 0, 0.1), inset 0 0 0 1px rgba(255, 255, 255, 0.4)'
              : '0 20px 50px -12px rgba(0, 0, 0, 0.5)',
            '--wails-draggable': 'drag',
            transform: 'translateZ(0)',
          }"
        >
          <!-- Wails Drag Area for Mini Mode -->
          <div v-if="pomodoroStore.isMiniMode && isWails()" class="absolute inset-0 z-0"></div>

          <!-- Colorful Background Glows -->
          <div
            class="absolute inset-0 overflow-hidden pointer-events-none z-0 opacity-30 dark:opacity-20"
          >
            <div
              class="absolute -top-[10%] -left-[10%] w-[60%] h-[60%] rounded-full blur-[80px] animate-float-slow"
              :class="pomodoroStore.status === 'focus' ? 'bg-rose-400/20' : 'bg-emerald-400/20'"
            ></div>
            <div
              class="absolute -bottom-[10%] -right-[10%] w-[50%] h-[50%] rounded-full blur-[70px] animate-float-reverse"
              :class="pomodoroStore.status === 'focus' ? 'bg-amber-400/20' : 'bg-blue-400/20'"
            ></div>
          </div>

          <!-- Header Controls -->
          <div
            class="relative z-20 w-full"
            :class="[
              pomodoroStore.isMiniMode
                ? isWails()
                  ? 'pt-12 pb-2'
                  : 'pt-10 pb-2'
                : 'flex items-center justify-between px-1 mb-4',
            ]"
            style="--wails-draggable: no-drag"
          >
            <!-- Left Side (Full Mode Only) -->
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

            <!-- Center: Title (Absolute Centered in Mini Mode) -->
            <div
              v-if="pomodoroStore.isMiniMode && pomodoroStore.activeTodo"
              class="absolute left-1/2 -translate-x-1/2 flex flex-col items-center justify-center min-w-0 w-full max-w-[60%] animate-in fade-in duration-500"
              :class="isWails() ? 'top-6' : 'top-4'"
            >
              <span
                class="text-[10px] font-bold tracking-[0.15em] text-foreground/70 truncate max-w-[120px] uppercase transition-opacity duration-300 group-hover:opacity-100"
              >
                {{ pomodoroStore.activeTodo.title }}
              </span>
            </div>

            <!-- Right: Actions (Absolute in Mini Mode) -->
            <div
              class="flex items-center gap-1"
              :class="[
                pomodoroStore.isMiniMode
                  ? 'absolute right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300'
                  : 'justify-end flex-1',
                pomodoroStore.isMiniMode ? (isWails() ? 'top-6' : 'top-4') : '',
              ]"
            >
              <!-- AI Assistant Trigger (Mini Mode - Only in Browser) -->
              <Button
                v-if="pomodoroStore.isMiniMode && !isWails()"
                variant="ghost"
                size="icon"
                class="w-7 h-7 rounded-full hover:bg-primary/10 active:scale-90 transition-all text-primary/60 hover:text-primary relative z-30"
                style="--wails-draggable: no-drag"
                :title="t('ai.assistant')"
                @click.stop="toggleAiAssistant"
              >
                <Sparkles class="w-3.5 h-3.5" />
              </Button>

              <!-- Mini Mode Toggle -->
              <Button
                variant="ghost"
                size="icon"
                class="w-7 h-7 rounded-full hover:bg-foreground/5 active:scale-90 transition-all text-foreground/30 hover:text-foreground/60"
                @click="toggleMiniMode"
              >
                <Maximize2 v-if="pomodoroStore.isMiniMode" class="w-3.5 h-3.5" />
                <Minimize2 v-else class="w-3.5 h-3.5" />
              </Button>

              <!-- Reset/Close Button -->
              <Button
                variant="ghost"
                size="icon"
                class="w-7 h-7 rounded-full hover:bg-destructive/5 hover:text-destructive active:scale-90 transition-all text-foreground/30"
                @click="pomodoroStore.resetTimer"
              >
                <X class="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          <!-- Timer Display -->
          <div
            class="relative z-10 flex flex-col items-center justify-center w-full flex-1"
            :class="pomodoroStore.isMiniMode ? 'pb-2' : 'py-4'"
          >
            <!-- Progress Ring -->
            <div class="relative flex items-center justify-center">
              <svg
                :class="[
                  'transition-all duration-1000 ease-in-out drop-shadow-sm',
                  pomodoroStore.isMiniMode ? 'w-28 h-28' : 'w-64 h-64',
                ]"
                viewBox="0 0 100 100"
              >
                <!-- Background Ring -->
                <circle
                  cx="50"
                  cy="50"
                  r="46"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  class="text-foreground/[0.03] dark:text-white/[0.03]"
                />
                <!-- Progress Ring -->
                <circle
                  cx="50"
                  cy="50"
                  r="46"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  class="transition-all duration-500 ease-out"
                  :class="pomodoroStore.status === 'focus' ? 'text-primary' : 'text-orange-500'"
                  :style="{
                    strokeDasharray: '289',
                    strokeDashoffset: 289 - (pomodoroStore.progress / 100) * 289,
                    opacity: pomodoroStore.isRunning ? 0.6 : 0.2,
                    filter: pomodoroStore.isRunning
                      ? `drop-shadow(0 0 8px ${
                          pomodoroStore.status === 'focus'
                            ? 'hsla(var(--primary), 0.3)'
                            : 'rgba(249, 115, 22, 0.3)'
                        })`
                      : 'none',
                  }"
                  transform="rotate(-90 50 50)"
                />
              </svg>

              <!-- Time Text -->
              <div class="absolute inset-0 flex flex-col items-center justify-center">
                <span
                  class="font-mono font-light tracking-tight tabular-nums transition-all leading-none"
                  :class="[
                    pomodoroStore.isRunning ? 'text-foreground/90' : 'text-foreground/40',
                    pomodoroStore.isMiniMode ? 'text-2xl' : 'text-7xl',
                  ]"
                  :style="{
                    fontFamily: 'JetBrains Mono, monospace',
                    textShadow: pomodoroStore.isRunning
                      ? `0 0 30px hsla(var(--foreground), 0.05)`
                      : 'none',
                  }"
                >
                  {{ pomodoroStore.formattedTime }}
                </span>
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
                <div class="flex items-center justify-between mb-0.5">
                  <p
                    class="text-[10px] text-muted-foreground uppercase font-bold tracking-widest opacity-70"
                  >
                    {{ t('common.current_task') }}
                  </p>
                  <span
                    v-if="pomodoroStore.activeTodo.pomodoroCount"
                    class="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full"
                    :title="
                      t('pomodoro.sessions', { count: pomodoroStore.activeTodo.pomodoroCount })
                    "
                  >
                    {{ pomodoroStore.activeTodo.pomodoroCount }}
                  </span>
                </div>
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
        </div>
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
.bg-card\/95 {
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.05) inset,
    0 20px 50px -12px rgba(0, 0, 0, 0.5);
}

:root.dark .bg-card\/95 {
  background-color: rgba(28, 25, 23, 0.95);
}

@keyframes pulse-subtle {
  0%,
  100% {
    opacity: 1;
    stroke-width: var(--stroke-width);
    filter: drop-shadow(0 0 8px hsla(var(--primary), 0.4));
  }
  50% {
    opacity: 0.8;
    stroke-width: calc(var(--stroke-width) + 0.5px);
    filter: drop-shadow(0 0 12px hsla(var(--primary), 0.6));
  }
}

@keyframes float-slow {
  0%,
  100% {
    transform: translate(0, 0) scale(1);
  }
  33% {
    transform: translate(10%, 15%) scale(1.1);
  }
  66% {
    transform: translate(-5%, 10%) scale(0.95);
  }
}

@keyframes float-reverse {
  0%,
  100% {
    transform: translate(0, 0) scale(1);
  }
  33% {
    transform: translate(-15%, -10%) scale(0.9);
  }
  66% {
    transform: translate(10%, -15%) scale(1.15);
  }
}

.animate-float-slow {
  animation: float-slow 15s ease-in-out infinite;
}

.animate-float-reverse {
  animation: float-reverse 18s ease-in-out infinite;
}

.animate-pulse-slow {
  animation: pulse 8s ease-in-out infinite;
}

.animate-pulse-subtle {
  --stroke-width: 4px;
  animation: pulse-subtle 4s ease-in-out infinite;
}

.isMiniMode .animate-pulse-subtle {
  --stroke-width: 3px;
}

.glass-grain::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  border-radius: inherit;
  background: radial-gradient(circle at top left, rgba(255, 255, 255, 0.05), transparent 40%);
}
</style>
