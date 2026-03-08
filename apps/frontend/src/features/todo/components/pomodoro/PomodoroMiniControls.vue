<script setup lang="ts">
import { X } from 'lucide-vue-next'
import AiLuminaIcon from '@/features/ai/components/AiLuminaIcon.vue'
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
</script>

<template>
  <div class="relative z-20 w-full" :class="[isWails() ? 'pt-10 pb-1' : 'pt-8 pb-1']">
    <!-- Center: Title -->
    <div
      v-if="pomodoroStore.activeTodo"
      class="absolute left-1/2 -translate-x-1/2 flex flex-col items-center justify-center min-w-0 w-full max-w-[80%] animate-in fade-in zoom-in-95 duration-500 transition-all"
      :class="[
        isWails() ? 'top-5' : 'top-4',
        'group-hover/card:opacity-20 group-hover/card:scale-95',
      ]"
    >
      <span
        class="text-[11px] font-bold tracking-[0.15em] text-white/70 truncate max-w-[160px] uppercase drop-shadow-sm"
      >
        {{ pomodoroStore.activeTodo.title }}
      </span>
    </div>

    <!-- Right Side: Actions -->
    <div
      class="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover/card:opacity-100 transition-all duration-500 -translate-y-1 group-hover/card:translate-y-0"
      style="--wails-draggable: no-drag"
    >
      <Button
        variant="ghost"
        size="icon"
        class="w-7 h-7 rounded-full hover:bg-destructive/20 hover:text-destructive text-white/50 bg-white/5"
        @click="pomodoroStore.resetTimer"
      >
        <X class="w-4 h-4" />
      </Button>
    </div>

    <!-- Left Side: AI -->
    <Button
      v-if="!isWails()"
      variant="ghost"
      size="icon"
      class="absolute top-3 left-3 w-7 h-7 rounded-full hover:bg-primary/20 text-primary/60 hover:text-primary opacity-0 group-hover/card:opacity-100 transition-all duration-500 -translate-y-1 group-hover/card:translate-y-0 bg-white/5"
      style="--wails-draggable: no-drag"
      @click.stop="toggleAiAssistant"
    >
      <AiLuminaIcon class="w-4 h-4" />
    </Button>
  </div>
</template>
