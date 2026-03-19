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
}>()

const isOverdue = computed(() => {
  const dueAt = toDate(props.todo.dueAt)
  if (!dueAt) return false
  if (props.todo.completed) return false
  return dueAt.getTime() < Date.now()
})

const hasMetaBadges = computed(() => {
  if (store.filter === 'trash') return false

  return Boolean(
    props.todo.pomodoroCount > 0 ||
    props.todo.dueAt ||
    props.todo.recurrenceRule ||
    (props.todo.remindAt && !props.todo.remindedAt),
  )
})

const recurrenceLabelKey = computed(() => {
  if (!props.todo.recurrenceRule) return null
  if (props.todo.recurrenceRule === 'DAILY') return 'todo.recurrenceDaily'
  if (props.todo.recurrenceRule === 'WEEKDAYS') return 'todo.recurrenceWeekdays'
  if (props.todo.recurrenceRule === 'WEEKLY') return 'todo.recurrenceWeekly'
  return 'todo.recurrenceMonthly'
})
</script>

<template>
  <div class="flex-1 flex flex-col min-w-0">
    <!-- Parent Path Context (Search only) -->
    <div
      v-if="parentPath.length > 0"
      class="flex items-center gap-1 text-[var(--todo-font-caption)] text-muted-foreground/50 mb-0.5 select-none overflow-hidden"
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
    <div class="flex min-w-0 flex-col gap-0.5 md:flex-row md:items-center md:gap-1.5">
      <div class="flex min-w-0 items-center gap-1 md:gap-1.5">
        <Pin
          v-if="todo.isPinned && store.filter !== 'trash'"
          class="h-3 w-3 shrink-0 text-primary/70 group-hover:hidden md:h-3.5 md:w-3.5"
        />
        <AiLuminaIcon
          v-if="todo.isProposed && store.filter !== 'trash'"
          class="h-3 w-3 shrink-0 text-success/70 md:h-3.5 md:w-3.5"
        />
        <!-- eslint-disable vue/no-v-html -->
        <Tooltip>
          <TooltipTrigger as-child>
            <span
              class="flex-1 cursor-pointer select-text truncate text-[var(--todo-font-body)] leading-[1.15] text-foreground"
              :class="[
                todo.completed && store.filter !== 'trash'
                  ? 'line-through text-muted-foreground/50'
                  : '',
                todo.isProposedDelete ? 'line-through text-destructive/50' : '',
                todo.isProposed && store.filter !== 'trash' ? 'font-medium text-success/90' : '',
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
      </div>

      <div
        v-if="hasMetaBadges"
        class="flex flex-wrap items-center gap-1 text-[11px] md:gap-1 md:text-[var(--todo-font-caption)]"
      >
        <Tooltip v-if="todo.pomodoroCount > 0">
          <TooltipTrigger as-child>
            <div
              class="animate-in fade-in zoom-in-95 flex shrink-0 items-center gap-1 rounded-lg bg-rose-500/10 px-1.5 py-[3px] font-medium text-rose-500 duration-500 dark:text-rose-400/90 md:py-0.5 md:font-semibold"
            >
              <Timer class="h-3 w-3" />
              <span>{{ todo.pomodoroCount }}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top">
            {{ t('pomodoro.sessions', { count: todo.pomodoroCount }) }}
          </TooltipContent>
        </Tooltip>

        <Tooltip v-if="todo.dueAt">
          <TooltipTrigger as-child>
            <div
              class="flex shrink-0 items-center gap-1 rounded-lg px-1.5 py-[3px] font-medium leading-none md:py-0.5"
              :class="
                isOverdue
                  ? 'bg-destructive/10 text-destructive'
                  : 'bg-primary/10 text-primary/90 dark:text-primary/90'
              "
            >
              <CalendarClock class="h-3 w-3" />
              <span>{{ formatDate(todo.dueAt!, 'MM-DD HH:mm') }}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top">{{ t('todo.dueAt') }}</TooltipContent>
        </Tooltip>

        <Tooltip v-if="todo.remindAt && !todo.remindedAt">
          <TooltipTrigger as-child>
            <div
              class="flex shrink-0 items-center gap-1 rounded-lg bg-amber-500/10 px-1.5 py-[3px] font-medium leading-none text-amber-600 dark:text-amber-400/90 md:py-0.5"
            >
              <Bell class="h-3 w-3" />
              <span>{{ formatDate(todo.remindAt!, 'HH:mm') }}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top">{{ t('todo.remindAt') }}</TooltipContent>
        </Tooltip>

        <Tooltip v-if="recurrenceLabelKey">
          <TooltipTrigger as-child>
            <div
              class="flex shrink-0 items-center rounded-lg bg-sky-500/10 px-1.5 py-[3px] font-medium leading-none text-sky-600 dark:text-sky-400/90 md:py-0.5"
            >
              <span>{{ t(recurrenceLabelKey) }}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top">{{ t('todo.recurrence') }}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  </div>
</template>
