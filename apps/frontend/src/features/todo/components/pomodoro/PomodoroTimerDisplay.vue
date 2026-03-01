<script setup lang="ts">
import { usePomodoroStore } from '../../stores/pomodoro'

const pomodoroStore = usePomodoroStore()
</script>

<template>
  <div
    class="relative z-10 flex flex-col items-center justify-center w-full flex-1"
    :class="pomodoroStore.isMiniMode ? 'pb-4' : 'py-6'"
  >
    <!-- Progress Ring -->
    <div
      class="relative flex items-center justify-center group/timer"
      :class="pomodoroStore.isMiniMode ? 'cursor-pointer' : ''"
      @click="
        pomodoroStore.isMiniMode
          ? pomodoroStore.isRunning
            ? pomodoroStore.pauseTimer()
            : pomodoroStore.resumeTimer()
          : null
      "
    >
      <!-- Star Core Glow -->
      <div
        class="absolute rounded-full transition-all duration-1000 ease-in-out"
        :class="[
          pomodoroStore.isMiniMode ? 'w-24 h-24' : 'w-56 h-56',
          pomodoroStore.isRunning ? 'animate-stellar-pulse' : 'opacity-20 scale-90',
        ]"
        :style="{
          background:
            pomodoroStore.status === 'focus'
              ? 'radial-gradient(circle, rgba(251, 113, 133, 0.4) 0%, rgba(244, 63, 94, 0.1) 50%, transparent 70%)'
              : 'radial-gradient(circle, rgba(52, 211, 153, 0.4) 0%, rgba(16, 185, 129, 0.1) 50%, transparent 70%)',
          boxShadow: pomodoroStore.isRunning
            ? `0 0 100px 20px ${pomodoroStore.status === 'focus' ? 'rgba(251, 113, 133, 0.2)' : 'rgba(52, 211, 153, 0.2)'}`
            : 'none',
        }"
      ></div>

      <!-- Stellar Rings -->
      <div
        v-if="pomodoroStore.isRunning"
        class="absolute rounded-full border border-white/5 animate-spin-slow"
        :class="pomodoroStore.isMiniMode ? 'w-36 h-36' : 'w-80 h-80'"
      ></div>

      <svg
        :class="[
          'relative z-10 transition-all duration-1000 ease-[cubic-bezier(0.23,1,0.32,1)]',
          pomodoroStore.isMiniMode ? 'w-32 h-32' : 'w-72 h-72',
          pomodoroStore.isMiniMode
            ? 'group-hover/timer:opacity-20 transition-opacity duration-300'
            : '',
        ]"
        viewBox="0 0 100 100"
      >
        <!-- Outer Atmospheric Glow -->
        <circle
          cx="50"
          cy="50"
          r="49"
          fill="none"
          stroke="currentColor"
          stroke-width="0.2"
          class="text-foreground/[0.05] dark:text-white/[0.05]"
        />
        <!-- Orbit Ring -->
        <circle
          cx="50"
          cy="50"
          r="44"
          fill="none"
          stroke="currentColor"
          stroke-width="0.5"
          class="text-foreground/[0.03] dark:text-white/[0.03] animate-pulse"
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
          class="transition-all duration-700 ease-out"
          :style="{
            strokeDasharray: '276.46',
            strokeDashoffset: 276.46 - (pomodoroStore.progress / 100) * 276.46,
            filter: pomodoroStore.isRunning
              ? `drop-shadow(0 0 15px ${
                  pomodoroStore.status === 'focus'
                    ? 'rgba(244, 63, 94, 0.6)'
                    : 'rgba(16, 185, 129, 0.6)'
                })`
              : 'none',
          }"
          transform="rotate(-90 50 50)"
        />

        <!-- Definitions for Stellar Gradient -->
        <defs>
          <linearGradient id="stellarGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop
              offset="0%"
              :stop-color="pomodoroStore.status === 'focus' ? '#fb7185' : '#34d399'"
            />
            <stop
              offset="50%"
              :stop-color="pomodoroStore.status === 'focus' ? '#f43f5e' : '#10b981'"
            />
            <stop
              offset="100%"
              :stop-color="pomodoroStore.status === 'focus' ? '#fbbf24' : '#3b82f6'"
            />
          </linearGradient>
        </defs>
      </svg>

      <!-- Time Text -->
      <div
        class="absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-none"
      >
        <span
          class="font-mono tabular-nums transition-all duration-700 leading-none select-none"
          :class="[
            pomodoroStore.isRunning ? 'text-foreground font-bold' : 'text-foreground/30 font-light',
            pomodoroStore.isMiniMode ? 'text-3xl tracking-tighter' : 'text-8xl tracking-[-0.05em]',
          ]"
          :style="{
            fontFamily: 'JetBrains Mono, monospace',
            textShadow: pomodoroStore.isRunning
              ? `0 0 20px ${pomodoroStore.status === 'focus' ? 'rgba(251, 113, 133, 0.3)' : 'rgba(52, 211, 153, 0.3)'}`
              : 'none',
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
    opacity: 0.4;
    filter: blur(20px);
  }
  50% {
    transform: scale(1.05);
    opacity: 0.5;
    filter: blur(25px);
  }
}

@keyframes spin-slow {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.animate-stellar-pulse {
  animation: stellar-pulse 4s ease-in-out infinite;
}

.animate-spin-slow {
  animation: spin-slow 60s linear infinite;
}

span {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
</style>
