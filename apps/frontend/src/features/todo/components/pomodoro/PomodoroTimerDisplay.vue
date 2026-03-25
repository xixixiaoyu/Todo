<script setup lang="ts">
import { usePomodoroStore } from '../../stores/pomodoro'
import { useTheme } from '@/composables/useTheme'
import { computed } from 'vue'

const pomodoroStore = usePomodoroStore()
const { isDark: isThemeDark } = useTheme()

const isDark = computed(() => isThemeDark.value || pomodoroStore.isMiniMode)

// Use global theme color for progress ring and favicon
const themeColor = 'hsl(var(--primary))'
const themeColorRgb = 'var(--primary-rgb)'
</script>

<template>
  <div
    class="relative z-10 flex flex-col items-center justify-center w-full flex-1"
    :class="pomodoroStore.isMiniMode ? 'pb-4' : 'py-6'"
  >
    <!-- Progress Ring -->
    <div
      class="relative flex items-center justify-center group/timer cursor-pointer"
      @click="pomodoroStore.isRunning ? pomodoroStore.pauseTimer() : pomodoroStore.resumeTimer()"
    >
      <!-- Star Core Glow - Minimalist -->
      <div
        class="absolute rounded-full transition-all duration-1000 ease-in-out"
        :class="[
          pomodoroStore.isMiniMode ? 'w-28 h-28' : 'w-64 h-64',
          pomodoroStore.isRunning ? 'animate-stellar-pulse' : 'opacity-5 scale-90',
        ]"
        :style="{
          background: `radial-gradient(circle, rgba(${themeColorRgb}, ${isDark ? '0.2' : '0.08'}) 0%, transparent 70%)`,
        }"
      ></div>

      <svg
        :class="[
          'relative z-10 transition-all duration-1000 ease-apple',
          pomodoroStore.isMiniMode ? 'w-32 h-32' : 'w-72 h-72',
          pomodoroStore.isMiniMode
            ? 'group-hover/timer:opacity-30 transition-opacity duration-300'
            : '',
        ]"
        viewBox="0 0 100 100"
      >
        <!-- Background Track (Single, Subtle) -->
        <circle
          cx="50"
          cy="50"
          r="44"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          class="text-foreground/[0.03] dark:text-white/[0.03]"
        />

        <!-- Progress Arc -->
        <circle
          cx="50"
          cy="50"
          r="44"
          fill="none"
          stroke="url(#stellarGradient)"
          stroke-width="2.5"
          stroke-linecap="round"
          class="transition-all duration-300 ease-linear"
          :style="{
            strokeDasharray: '276.46',
            strokeDashoffset: 276.46 - (pomodoroStore.progress / 100) * 276.46,
            filter: pomodoroStore.isRunning
              ? `drop-shadow(0 0 12px rgba(${themeColorRgb}, ${isDark ? '0.6' : '0.3'}))`
              : 'none',
          }"
          transform="rotate(-90 50 50)"
        />

        <!-- Definitions for Stellar Gradient -->
        <defs>
          <linearGradient id="stellarGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" :stop-color="themeColor" />
            <stop offset="100%" :stop-color="themeColor" />
          </linearGradient>
        </defs>
      </svg>

      <!-- Time Text -->
      <div
        class="absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-none"
      >
        <span
          class="font-mono tabular-nums leading-none select-none text-white"
          :class="[
            pomodoroStore.isRunning ? 'font-bold' : 'opacity-40 font-light',
            pomodoroStore.isMiniMode ? 'text-3xl tracking-tighter' : 'text-8xl tracking-[-0.05em]',
          ]"
          :style="{
            fontFamily: 'JetBrains Mono, monospace',
            transition: 'all 0.3s linear',
            textShadow: isDark
              ? `0 0 20px rgba(${themeColorRgb}, 0.6), 0 4px 12px rgba(0, 0, 0, 0.5)`
              : `0 0 20px rgba(${themeColorRgb}, 0.2)`,
          }"
        >
          {{ pomodoroStore.formattedTime }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.font-mono {
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'tnum';
}

@keyframes stellar-pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.3;
    filter: blur(20px);
  }
  50% {
    transform: scale(1.05);
    opacity: 0.4;
    filter: blur(25px);
  }
}

.animate-stellar-pulse {
  animation: stellar-pulse 8s ease-in-out infinite;
}

span {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
</style>
