<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Pin, Sparkles, Timer, ChevronRight } from 'lucide-vue-next'
import { type Todo, useTodoStore } from '../stores/todo'
import { highlightMatch } from '@/lib/utils'

const { t } = useI18n()
const store = useTodoStore()

defineProps<{
  todo: Todo
  searchQuery?: string
  parentPath: string[]
}>()

const emit = defineEmits<{
  startEdit: []
  toggleMobileActions: []
}>()
</script>

<template>
  <div class="flex-1 flex flex-col min-w-0" @click="emit('toggleMobileActions')">
    <!-- Parent Path Context (Search only) -->
    <div
      v-if="parentPath.length > 0"
      class="flex items-center gap-1 text-[10px] text-muted-foreground/50 mb-0.5 select-none overflow-hidden"
    >
      <template v-for="(name, index) in parentPath" :key="index">
        <span
          class="truncate max-w-[80px] hover:text-muted-foreground transition-colors cursor-default"
        >
          {{ name }}
        </span>
        <ChevronRight :size="10" class="shrink-0 opacity-40" />
      </template>
    </div>

    <!-- Todo Title & Badges -->
    <div class="flex items-center gap-1.5 min-w-0">
      <Pin
        v-if="todo.isPinned && store.filter !== 'trash'"
        class="h-3.5 w-3.5 text-primary/70 shrink-0 group-hover:hidden"
      />
      <Sparkles
        v-if="todo.isProposed && store.filter !== 'trash'"
        class="h-3.5 w-3.5 text-success/70 shrink-0"
      />
      <!-- eslint-disable vue/no-v-html -->
      <span
        class="flex-1 cursor-pointer select-text text-foreground truncate"
        :class="[
          todo.completed && store.filter !== 'trash' ? 'line-through text-muted-foreground/50' : '',
          todo.isProposedDelete ? 'line-through text-destructive/50' : '',
          todo.isProposed && store.filter !== 'trash' ? 'text-success/90 font-medium' : '',
        ]"
        :title="todo.title"
        @dblclick="store.filter !== 'trash' && emit('startEdit')"
        v-html="highlightMatch(todo.title, searchQuery || '')"
      >
      </span>
      <!-- eslint-enable vue/no-v-html -->

      <!-- Pomodoro Badge -->
      <div
        v-if="todo.pomodoroCount > 0 && store.filter !== 'trash'"
        class="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-rose-500/10 text-rose-500 dark:text-rose-400/90 text-[10px] font-bold shrink-0 ml-1 animate-in fade-in zoom-in-95 duration-500"
        :title="t('pomodoro.sessions', { count: todo.pomodoroCount })"
      >
        <Timer class="w-3 h-3" />
        <span>{{ todo.pomodoroCount }}</span>
      </div>
    </div>
  </div>
</template>
