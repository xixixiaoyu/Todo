<script setup lang="ts">
import { Target } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { usePomodoroStore } from '../../stores/pomodoro'

const { t } = useI18n()
const pomodoroStore = usePomodoroStore()
</script>

<template>
  <div
    v-if="pomodoroStore.activeTodo"
    class="relative z-10 mt-4 px-6 py-5 rounded-[2rem] bg-foreground/[0.02] border border-foreground/[0.05] backdrop-blur-sm group/task transition-all hover:bg-foreground/[0.04]"
  >
    <div class="flex items-center gap-5">
      <div
        class="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 shadow-inner transition-transform group-hover/task:scale-110 duration-500"
      >
        <Target class="w-6 h-6 text-primary" />
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between mb-1">
          <p class="text-[10px] text-foreground/30 uppercase font-black tracking-[0.2em]">
            {{ t('common.current_task') }}
          </p>
        </div>
        <p class="text-base font-bold truncate text-foreground/80 tracking-tight">
          {{ pomodoroStore.activeTodo.title }}
        </p>
      </div>
    </div>
  </div>
</template>
