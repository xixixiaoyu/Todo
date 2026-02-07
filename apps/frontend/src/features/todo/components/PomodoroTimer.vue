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

interface Star {
  id: number
  x: number
  y: number
  size: number
  opacity: number
  duration: number
  delay: number
}

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

// Stars System
const stars = ref<Star[]>([])

function generateStar(id: number): Star {
  const angle = Math.random() * Math.PI * 2
  const distance = 45 + Math.random() * 40 // Distribute stars within/around the ring
  return {
    id,
    x: 50 + Math.cos(angle) * distance,
    y: 50 + Math.sin(angle) * distance,
    size: 1 + Math.random() * 2.5,
    opacity: 0.2 + Math.random() * 0.6,
    duration: 3 + Math.random() * 4,
    delay: Math.random() * 2,
  }
}

// Update stars based on progress
watch(
  () => Math.floor(pomodoroStore.progress),
  (newProgress, oldProgress) => {
    if (newProgress > (oldProgress || 0)) {
      // Add a star every 4% of progress (approx. 1 per minute for 25min)
      const count = Math.floor(newProgress / 4)
      if (stars.value.length < count) {
        for (let i = stars.value.length; i < count; i++) {
          stars.value.push(generateStar(i))
        }
      }
    } else if (newProgress === 0) {
      stars.value = []
    }
  },
)

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
  const w = 420
  const h = 315 // 4/3 ratio
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

// Floating animation for mini mode
const ctx = gsap.context(() => {})
watch(
  () => pomodoroStore.isMiniMode,
  (isMini) => {
    ctx.revert()
    if (isMini && containerRef.value) {
      ctx.add(() => {
        gsap.to(containerRef.value, {
          y: '+=8',
          duration: 3,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
        })
      })
    }
  },
  { immediate: true },
)

const progressRingDash = computed(() => {
  // r is 44% of w-48(192px)
  const r = 84.48
  return 2 * Math.PI * r
})
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
      class="fixed z-[100] group transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)]"
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
      <div
        class="relative w-full h-full transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)]"
      >
        <!-- Card Content -->
        <div
          class="relative backdrop-blur-2xl border border-white/20 dark:border-white/5 shadow-2xl overflow-hidden transition-all duration-700 h-full w-full glass-grain"
          :class="[
            pomodoroStore.isMiniMode
              ? 'rounded-[3rem] bg-white/40 dark:bg-black/20 flex flex-col'
              : 'rounded-3xl p-5 bg-card/95',
            pomodoroStore.status === 'focus'
              ? 'ring-1 ring-primary/20 shadow-primary/5'
              : 'ring-1 ring-orange-500/20 shadow-orange-500/5',
          ]"
          :style="{
            boxShadow: pomodoroStore.isMiniMode
              ? '0 8px 32px 0 rgba(0, 0, 0, 0.1), inset 0 0 0 1px rgba(255, 255, 255, 0.2)'
              : '0 20px 50px -12px rgba(0, 0, 0, 0.5)',
            '--wails-draggable': 'drag',
            transform: 'translateZ(0)',
          }"
        >
          <!-- Wails Drag Area for Mini Mode -->
          <div v-if="pomodoroStore.isMiniMode && isWails()" class="absolute inset-0 z-0"></div>

          <!-- Header Controls -->
          <div
            class="relative z-20 flex items-center justify-between w-full"
            :class="pomodoroStore.isMiniMode ? 'px-8 pt-8 pb-2' : 'px-1 mb-4'"
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

            <!-- Mini Mode Center Title -->
            <div
              v-if="pomodoroStore.isMiniMode && pomodoroStore.activeTodo"
              class="absolute left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 animate-in fade-in zoom-in-95 duration-700"
            >
              <div class="flex items-center gap-2.5">
                <span
                  class="text-[14px] font-bold tracking-tight text-foreground/90 whitespace-nowrap"
                >
                  {{ pomodoroStore.activeTodo.title }}
                </span>
                <div class="h-3 w-[1px] bg-border/40 mx-0.5"></div>
                <div class="flex items-center gap-1.5">
                  <div
                    v-if="pomodoroStore.isRunning"
                    class="w-1.5 h-1.5 rounded-full bg-primary/80 animate-pulse shadow-[0_0_8px_hsla(var(--primary),0.4)]"
                  ></div>
                  <span class="text-[11px] font-bold text-primary/70 uppercase tracking-widest">
                    {{ t(`pomodoro.status.${pomodoroStore.status}`) }}
                  </span>
                </div>
              </div>
              <div v-if="pomodoroStore.activeTodo.pomodoroCount" class="flex gap-1.5 mt-0.5">
                <div
                  v-for="i in Math.min(pomodoroStore.activeTodo.pomodoroCount, 5)"
                  :key="i"
                  class="w-1.5 h-1 rounded-full bg-primary/20 transition-colors"
                  :class="{
                    'bg-primary/40':
                      i <= pomodoroStore.activeTodo.pomodoroCount % 5 ||
                      pomodoroStore.activeTodo.pomodoroCount >= 5,
                  }"
                ></div>
              </div>
            </div>

            <div class="flex items-center gap-3 ml-auto">
              <!-- AI Assistant Trigger (Mini Mode) -->
              <Button
                v-if="pomodoroStore.isMiniMode"
                variant="ghost"
                size="icon"
                class="w-9 h-9 rounded-xl hover:bg-primary/10 active:scale-95 transition-all text-primary/60 hover:text-primary animate-in fade-in zoom-in-95 duration-1000 relative z-30"
                style="--wails-draggable: no-drag"
                :title="t('ai.assistant')"
                @click.stop="toggleAiAssistant"
              >
                <Sparkles class="w-4 h-4" />
              </Button>

              <!-- Mini Mode Toggle -->
              <Button
                variant="ghost"
                size="icon"
                class="w-9 h-9 rounded-xl hover:bg-primary/5 active:scale-95 transition-all text-foreground/40 hover:text-foreground/80"
                @click="toggleMiniMode"
              >
                <Maximize2 v-if="pomodoroStore.isMiniMode" class="w-4 h-4" />
                <Minimize2 v-else class="w-4 h-4" />
              </Button>

              <!-- Reset/Close Button -->
              <Button
                variant="ghost"
                size="icon"
                class="w-9 h-9 rounded-xl hover:bg-destructive/5 hover:text-destructive active:scale-95 transition-all text-foreground/40"
                @click="pomodoroStore.resetTimer"
              >
                <X class="w-4 h-4" />
              </Button>
            </div>
          </div>

          <!-- Timer Display -->
          <div
            class="relative z-10 flex flex-col items-center justify-center w-full flex-1"
            :class="pomodoroStore.isMiniMode ? 'pb-8' : 'py-4'"
          >
            <div class="relative flex items-center justify-center w-48 h-48">
              <!-- Star Field -->
              <div
                v-if="pomodoroStore.status === 'focus' || pomodoroStore.status === 'short_break'"
                class="absolute inset-0 pointer-events-none z-0"
              >
                <TransitionGroup
                  enter-active-class="transition-all duration-1000 ease-out"
                  enter-from-class="opacity-0 scale-0"
                  enter-to-class="opacity-100 scale-100"
                >
                  <div
                    v-for="star in stars"
                    :key="star.id"
                    class="absolute rounded-full bg-primary blur-[1px] animate-pulse-slow"
                    :style="{
                      left: `${star.x}%`,
                      top: `${star.y}%`,
                      width: `${star.size}px`,
                      height: `${star.size}px`,
                      opacity: star.opacity,
                      animationDelay: `${star.delay}s`,
                      boxShadow: `0 0 ${star.size * 2}px hsla(var(--primary), 0.5)`,
                    }"
                  ></div>
                </TransitionGroup>
              </div>

              <!-- Progress Ring (SVG) -->
              <svg class="transform -rotate-90 transition-all duration-700 ease-out z-10 w-48 h-48">
                <defs>
                  <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <!-- Focus State: Emerald Green to Amber Yellow -->
                    <stop
                      offset="0%"
                      :stop-color="pomodoroStore.status === 'focus' ? '#10b981' : '#34d399'"
                    />
                    <stop
                      offset="100%"
                      :stop-color="pomodoroStore.status === 'focus' ? '#f59e0b' : '#3b82f6'"
                    />
                  </linearGradient>

                  <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="10" result="blur" />
                    <feFlood
                      :flood-color="pomodoroStore.status === 'focus' ? '#10b981' : '#34d399'"
                      flood-opacity="0.4"
                      result="color"
                    />
                    <feComposite in="color" in2="blur" operator="in" result="glow" />
                    <feComposite in="SourceGraphic" in2="glow" operator="over" />
                  </filter>
                </defs>
                <circle
                  cx="50%"
                  cy="50%"
                  r="44%"
                  class="stroke-foreground/[0.04] dark:stroke-white/[0.06] fill-none"
                  stroke-width="3"
                />
                <circle
                  cx="50%"
                  cy="50%"
                  r="44%"
                  class="fill-none transition-all duration-1000 ease-in-out"
                  stroke="url(#ringGradient)"
                  :stroke-width="pomodoroStore.isRunning ? 5 : 4"
                  stroke-linecap="round"
                  :stroke-dasharray="progressRingDash"
                  :stroke-dashoffset="progressRingDash * (1 - pomodoroStore.progress / 100)"
                  :style="{
                    filter: pomodoroStore.isRunning ? 'url(#softGlow)' : 'none',
                    transition: 'stroke-dashoffset 1s linear, stroke-width 0.3s ease',
                  }"
                />
              </svg>

              <!-- Time Text -->
              <div
                class="absolute inset-0 flex flex-col items-center justify-center"
                style="--wails-draggable: no-drag"
              >
                <span
                  class="font-mono font-medium tracking-tighter tabular-nums transition-all leading-none text-5xl"
                  :class="[pomodoroStore.isRunning ? 'text-foreground/90' : 'text-foreground/60']"
                  :style="{
                    fontFamily: 'JetBrains Mono, monospace',
                    textShadow: pomodoroStore.isRunning
                      ? `0 0 30px ${pomodoroStore.status === 'focus' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(52, 211, 153, 0.15)'}`
                      : 'none',
                  }"
                >
                  {{ pomodoroStore.formattedTime }}
                </span>
                <span
                  v-if="!pomodoroStore.isMiniMode"
                  class="text-[10px] text-muted-foreground mt-3 uppercase font-bold tracking-[0.3em] opacity-40"
                >
                  {{ pomodoroStore.isRunning ? t('common.focusing') : t('common.paused') }}
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

          <!-- Star Field -->
          <div
            v-if="!pomodoroStore.isMiniMode"
            class="absolute inset-0 z-0 pointer-events-none opacity-20"
          >
            <div
              v-for="i in 12"
              :key="i"
              class="absolute w-1 h-1 bg-primary rounded-full animate-pulse"
              :style="{
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`,
                opacity: Math.random(),
              }"
            ></div>
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
