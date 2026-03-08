<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Pin, Timer, ChevronRight, CalendarClock, Bell } from 'lucide-vue-next'
import AiLuminaIcon from '@/features/ai/components/AiLuminaIcon.vue'
import { computed } from 'vue'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { type Todo, useTodoStore } from '../stores/todo'
import { highlightMatch } from '@/lib/utils'
import { formatDate } from '@/lib/dayjs'
import { toDate } from '../stores/todo.dates'

const { t } = useI18n()
const store = useTodoStore()

const props = defineProps<{
  todo: Todo
  searchQuery?: string
  parentPath: string[]
}>()

const emit = defineEmits<{
  startEdit: []
  toggleMobileActions: []
}>()

const isOverdue = computed(() => {
  const dueAt = toDate(props.todo.dueAt)
  if (!dueAt) return false
  if (props.todo.completed) return false
  return dueAt.getTime() < Date.now()
})
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
    <div class="flex items-center gap-1 md:gap-1.5 min-w-0">
      <Pin
        v-if="todo.isPinned && store.filter !== 'trash'"
        class="h-3 w-3 md:h-3.5 md:w-3.5 text-primary/70 shrink-0 group-hover:hidden"
      />
      <AiLuminaIcon
        v-if="todo.isProposed && store.filter !== 'trash'"
        class="h-3 w-3 md:h-3.5 md:w-3.5 text-success/70 shrink-0"
      />
      <!-- eslint-disable vue/no-v-html -->
      <Tooltip>
        <TooltipTrigger as-child>
          <span
            class="flex-1 cursor-pointer select-text text-sm md:text-base text-foreground truncate"
            :class="[
              todo.completed && store.filter !== 'trash'
                ? 'line-through text-muted-foreground/50'
                : '',
              todo.isProposedDelete ? 'line-through text-destructive/50' : '',
              todo.isProposed && store.filter !== 'trash' ? 'text-success/90 font-medium' : '',
            ]"
            @dblclick="store.filter !== 'trash' && emit('startEdit')"
            v-html="highlightMatch(todo.title, searchQuery || '')"
          >
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" align="start" class="max-w-[300px] break-words">
          {{ todo.title }}
        </TooltipContent>
      </Tooltip>
      <!-- eslint-enable vue/no-v-html -->

      <!-- Pomodoro Badge -->
      <Tooltip v-if="todo.pomodoroCount > 0 && store.filter !== 'trash'">
        <TooltipTrigger as-child>
          <div
            class="flex items-center gap-0.5 md:gap-1 px-1 md:px-1.5 py-0.5 rounded-md bg-rose-500/10 text-rose-500 dark:text-rose-400/90 text-[9px] md:text-[10px] font-bold shrink-0 ml-0.5 md:ml-1 animate-in fade-in zoom-in-95 duration-500"
          >
            <Timer class="w-2.5 h-2.5 md:w-3 md:h-3" />
            <span>{{ todo.pomodoroCount }}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">
          {{ t('pomodoro.sessions', { count: todo.pomodoroCount }) }}
        </TooltipContent>
      </Tooltip>

      <Tooltip v-if="todo.dueAt && store.filter !== 'trash'">
        <TooltipTrigger as-child>
          <div
            class="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold shrink-0 ml-1"
            :class="
              isOverdue
                ? 'bg-destructive/10 text-destructive'
                : 'bg-primary/10 text-primary dark:text-primary/90'
            "
          >
            <CalendarClock class="w-3 h-3" />
            <span>{{ formatDate(todo.dueAt!, 'MM-DD HH:mm') }}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">{{ t('todo.dueAt') }}</TooltipContent>
      </Tooltip>

      <Tooltip v-if="todo.remindAt && !todo.remindedAt && store.filter !== 'trash'">
        <TooltipTrigger as-child>
          <div
            class="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400/90 text-[10px] font-bold shrink-0 ml-1"
          >
            <Bell class="w-3 h-3" />
            <span>{{ formatDate(todo.remindAt!, 'HH:mm') }}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">{{ t('todo.remindAt') }}</TooltipContent>
      </Tooltip>
    </div>
  </div>
</template>
