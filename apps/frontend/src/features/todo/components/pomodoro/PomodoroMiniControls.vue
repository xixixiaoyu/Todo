<script setup lang="ts">
import { Maximize2, X, Sparkles } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { usePomodoroStore } from '../../stores/pomodoro'
import { useTodoStore } from '../../stores/todo'
import { nativeService } from '@/services/native'

const pomodoroStore = usePomodoroStore()
const todoStore = useTodoStore()

const isWails = () => nativeService.platform === 'wails'

function toggleAiAssistant() {
  todoStore.setDrawerOpen(!todoStore.isDrawerOpen)
}

function toggleMiniMode() {
  const enteringMini = !pomodoroStore.isMiniMode
  pomodoroStore.toggleMiniMode()

  if (enteringMini && !pomodoroStore.isRunning && pomodoroStore.status !== 'idle') {
    pomodoroStore.resumeTimer()
  }
}
</script>

<template>
  <div class="relative z-20 w-full" :class="[isWails() ? 'pt-10 pb-1' : 'pt-8 pb-1']">
    <!-- Center: Title -->
    <div
      v-if="pomodoroStore.activeTodo"
      class="absolute left-1/2 -translate-x-1/2 flex flex-col items-center justify-center min-w-0 w-full max-w-[70%] animate-in fade-in zoom-in-95 duration-500 transition-opacity"
      :class="[isWails() ? 'top-5' : 'top-4', 'group-hover/card:opacity-0']"
    >
      <span
        class="text-[9px] font-black tracking-[0.25em] text-foreground/40 truncate max-w-[140px] uppercase"
      >
        {{ pomodoroStore.activeTodo.title }}
      </span>
    </div>

    <!-- Right Side: Actions -->
    <div
      class="absolute top-4 right-4 flex items-center gap-1 opacity-0 group-hover/card:opacity-100 transition-all duration-500 -translate-y-1 group-hover/card:translate-y-0"
      style="--wails-draggable: no-drag"
    >
      <Button
        variant="ghost"
        size="icon"
        class="w-6 h-6 rounded-full hover:bg-foreground/5 text-foreground/20 hover:text-foreground/50"
        @click="toggleMiniMode"
      >
        <Maximize2 class="w-3 h-3" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        class="w-6 h-6 rounded-full hover:bg-destructive/5 hover:text-destructive text-foreground/20"
        @click="pomodoroStore.resetTimer"
      >
        <X class="w-3 h-3" />
      </Button>
    </div>

    <!-- Left Side: AI -->
    <Button
      v-if="!isWails()"
      variant="ghost"
      size="icon"
      class="absolute top-4 left-4 w-6 h-6 rounded-full hover:bg-primary/10 text-primary/30 hover:text-primary opacity-0 group-hover/card:opacity-100 transition-all duration-500 -translate-y-1 group-hover/card:translate-y-0"
      style="--wails-draggable: no-drag"
      @click.stop="toggleAiAssistant"
    >
      <Sparkles class="w-3 h-3" />
    </Button>
  </div>
</template>
