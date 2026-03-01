<script setup lang="ts">
import { Play, Pause, Square } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { usePomodoroStore } from '../../stores/pomodoro'

const pomodoroStore = usePomodoroStore()
</script>

<template>
  <div
    class="relative z-10 flex items-center justify-center gap-8 mt-10 no-drag"
    style="--wails-draggable: no-drag"
  >
    <div class="relative group/play">
      <div
        class="absolute inset-0 bg-primary/20 blur-2xl rounded-full opacity-0 group-hover/play:opacity-100 transition-opacity duration-500"
      ></div>
      <Button
        v-if="!pomodoroStore.isRunning"
        variant="default"
        size="icon"
        class="relative w-20 h-20 rounded-[2.5rem] shadow-2xl shadow-primary/30 hover:scale-105 active:scale-95 transition-all duration-500 bg-primary text-primary-foreground"
        @click="pomodoroStore.resumeTimer"
      >
        <Play class="w-10 h-10 fill-current translate-x-1" />
      </Button>
      <Button
        v-else
        variant="secondary"
        size="icon"
        class="relative w-20 h-20 rounded-[2.5rem] shadow-xl hover:scale-105 active:scale-95 transition-all duration-500 bg-foreground/5 text-foreground hover:bg-foreground/10"
        @click="pomodoroStore.pauseTimer"
      >
        <Pause class="w-10 h-10 fill-current" />
      </Button>
    </div>

    <Button
      variant="ghost"
      size="icon"
      class="w-14 h-14 rounded-[1.5rem] hover:bg-destructive/5 hover:text-destructive transition-all duration-500 opacity-30 hover:opacity-100"
      @click="pomodoroStore.resetTimer"
    >
      <Square class="w-6 h-6 fill-current" />
    </Button>
  </div>
</template>
