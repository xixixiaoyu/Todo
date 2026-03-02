<script setup lang="ts">
import { usePomodoroStore } from '../stores/pomodoro'
import { useGsap } from '@/composables/useGsap'
import { useTheme } from '@/composables/useTheme'
import { nativeService } from '@/services/native'
import { ref, watch, computed } from 'vue'
import { useWindowSize } from '@vueuse/core'

// Subcomponents
import PomodoroTimerDisplay from './pomodoro/PomodoroTimerDisplay.vue'
import PomodoroMiniControls from './pomodoro/PomodoroMiniControls.vue'

const pomodoroStore = usePomodoroStore()
const { gsap, ctx } = useGsap()
const { theme } = useTheme()

const isDark = computed(() => theme.value === 'dark' || pomodoroStore.isMiniMode)

const isWails = () => nativeService.platform === 'wails'

const containerRef = ref<HTMLElement | null>(null)

const { width: windowWidth, height: windowHeight } = useWindowSize()

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
  if (isWails()) return { left: 0, top: 0, width: '100vw', height: '100vh' }
  return {
    left: `${miniPosition.value.x}px`,
    top: `${miniPosition.value.y}px`,
    width: miniPosition.value.width,
    height: miniPosition.value.height,
  }
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
      v-if="pomodoroStore.isMiniMode"
      ref="containerRef"
      class="fixed z-[100] group transition-all duration-500 ease-out-quart"
      :style="containerStyle"
    >
      <!-- Main Content Container -->
      <div
        class="relative w-full h-full transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)]"
      >
        <div
          class="relative backdrop-blur-3xl overflow-hidden transition-all duration-700 h-full w-full group/card animate-float"
          :class="[
            isDark
              ? 'rounded-[3rem] flex flex-col border border-white/10'
              : 'rounded-[3rem] flex flex-col border border-white/40 shadow-xl shadow-black/10',
          ]"
          :style="{
            backgroundColor: pomodoroStore.isEarthReady
              ? isDark
                ? 'rgba(25, 25, 30, 0.55)'
                : 'rgba(255, 255, 255, 0.3)' // 收缩模式下，浅色卡片背景保持大幅透明，因为背景始终为深色地球
              : isDark
                ? 'rgba(15, 23, 42, 0.7)'
                : 'rgba(255, 255, 255, 0.95)',
            boxShadow: isDark
              ? '0 30px 60px -12px rgba(0, 0, 0, 0.7), 0 18px 36px -18px rgba(0, 0, 0, 0.8), inset 0 0 0 1px rgba(255, 255, 255, 0.12)'
              : '0 20px 60px -15px rgba(0, 0, 0, 0.4), inset 0 0 0 1px rgba(255, 255, 255, 0.3)', // 强化阴影，在黑色背景下突出卡片
            '--wails-draggable': 'drag',
            transform: 'translateZ(0)',
          }"
        >
          <!-- Subtle Rim Light Effect -->
          <div
            class="absolute inset-0 pointer-events-none opacity-50 transition-opacity duration-700 group-hover/card:opacity-80"
            style="
              background: linear-gradient(
                135deg,
                rgba(255, 255, 255, 0.15) 0%,
                transparent 40%,
                transparent 60%,
                rgba(255, 255, 255, 0.05) 100%
              );
            "
          ></div>

          <!-- Wails Drag Area for Mini Mode -->
          <div v-if="isWails()" class="absolute inset-0 z-0"></div>

          <!-- Mini Mode Controls -->
          <PomodoroMiniControls />

          <!-- Timer Display (Shared) -->
          <PomodoroTimerDisplay />
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* Sophisticated Glassmorphism */
.backdrop-blur-3xl {
  backdrop-filter: blur(40px) saturate(180%) brightness(1.1);
  -webkit-backdrop-filter: blur(40px) saturate(180%) brightness(1.1);
}

.animate-float {
  animation: float 6s ease-in-out infinite;
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0) rotate(0deg);
  }
  50% {
    transform: translateY(-8px) rotate(0.5deg);
  }
}

.ease-out-quart {
  transition-timing-function: cubic-bezier(0.25, 1, 0.5, 1);
}

span {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
</style>
