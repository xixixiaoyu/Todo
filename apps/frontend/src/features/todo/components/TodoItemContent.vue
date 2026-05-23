<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Pin, Timer, ChevronRight, CalendarClock, Bell, Clock3 } from 'lucide-vue-next'
import AiLuminaIcon from '@/features/ai/components/AiLuminaIcon.vue'
import { computed } from 'vue'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTodoStore } from '../stores/todo'
import type { Todo } from '../stores/todo'
import { highlightMatch } from '@/lib/utils'
import dayjs, { formatDate, formatRelativeTime } from '@/lib/dayjs'
import { toDate } from '../stores/todo.schedule'
import { hasDistinctReminderTime } from '../stores/todo.schedule'

const { t, locale } = useI18n()
const store = useTodoStore()

const props = defineProps<{
  todo: Todo
  searchQuery?: string
  parentPath: string[]
  hideDeferredBadge?: boolean
}>()

const emit = defineEmits<{
  startEdit: []
}>()

const dueAtDate = computed(() => toDate(props.todo.dueAt))
const remindAtDate = computed(() => toDate(props.todo.remindAt))

const isOverdue = computed(() => {
  const dueAt = dueAtDate.value
  if (!dueAt) return false
  if (props.todo.completed) return false
  return dueAt.getTime() < Date.now()
})

const hasDueAt = computed(() => !!dueAtDate.value)
const hasStandaloneReminder = computed(
  () => !props.todo.remindedAt && hasDistinctReminderTime(props.todo.dueAt, props.todo.remindAt),
)

const isReminderOverdue = computed(() => {
  const remindAt = remindAtDate.value
  if (!remindAt) return false
  if (props.todo.completed || props.todo.remindedAt) return false
  return remindAt.getTime() < Date.now()
})

const showDeferredBadge = computed(
  () => !props.hideDeferredBadge && !!props.todo.deferredAt && !props.todo.completed,
)

const hasSecondaryMetaBadges = computed(() => {
  if (store.filter === 'trash') return false

  return Boolean(
    showDeferredBadge.value ||
    props.todo.pomodoroCount > 0 ||
    props.todo.recurrenceRule ||
    hasStandaloneReminder.value,
  )
})

const recurrenceLabelKey = computed(() => {
  if (!props.todo.recurrenceRule) return null
  if (props.todo.recurrenceRule === 'DAILY') return 'todo.recurrenceDaily'
  if (props.todo.recurrenceRule === 'WEEKDAYS') return 'todo.recurrenceWeekdays'
  if (props.todo.recurrenceRule === 'WEEKLY') return 'todo.recurrenceWeekly'
  return 'todo.recurrenceMonthly'
})

const dueDisplay = computed(() => {
  if (!dueAtDate.value) return null
  return formatDate(dueAtDate.value, 'MM-DD HH:mm')
})

const showDueBadge = computed(
  () => store.filter !== 'trash' && hasDueAt.value && !!dueDisplay.value,
)

const remindDisplay = computed(() => {
  const remindAt = remindAtDate.value
  if (!remindAt) return null

  const dueAt = dueAtDate.value
  if (dueAt && dayjs(remindAt).isSame(dueAt, 'day')) {
    return formatDate(remindAt, 'HH:mm')
  }

  if (dayjs(remindAt).isSame(new Date(), 'day')) {
    return formatDate(remindAt, 'HH:mm')
  }

  return formatDate(remindAt, 'MM-DD HH:mm')
})

const remindRelativeDisplay = computed(() => {
  const remindAt = remindAtDate.value
  if (!remindAt) return null
  return formatRelativeTime(remindAt, locale.value)
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
    <div class="flex min-w-0 flex-col gap-0.5">
      <div class="flex min-w-0 items-center gap-2">
        <div class="flex min-w-0 flex-1 items-center gap-1 md:gap-1.5">
          <Pin
            v-if="todo.isPinned && store.filter !== 'trash'"
            class="h-3 w-3 shrink-0 text-primary/70 opacity-80 transition-opacity duration-200 group-hover:opacity-100 md:h-3.5 md:w-3.5"
          />
          <AiLuminaIcon
            v-if="todo.isProposed && store.filter !== 'trash'"
            class="h-3 w-3 shrink-0 text-success/70 md:h-3.5 md:w-3.5"
          />
          <!-- eslint-disable vue/no-v-html -->
          <Tooltip>
            <TooltipTrigger as-child>
              <span
                class="flex-1 cursor-pointer select-text truncate text-[var(--todo-font-body)] leading-[1.2] text-foreground"
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

        <Tooltip v-if="showDueBadge">
          <TooltipTrigger as-child>
            <div
              data-test="todo-due-badge"
              class="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold leading-none ring-1 ring-inset md:text-[var(--todo-font-caption)]"
              :class="
                isOverdue
                  ? 'bg-destructive/10 text-destructive ring-destructive/25'
                  : 'bg-primary/10 text-primary/90 ring-primary/20 dark:text-primary/90'
              "
            >
              <CalendarClock class="h-3 w-3" />
              <span>{{ dueDisplay }}</span>
              <span
                v-if="isOverdue"
                class="rounded-full bg-destructive/15 px-1.5 py-[2px] text-[10px] font-semibold leading-none tracking-wide"
              >
                {{ t('todo.overdue') }}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top">{{ t('todo.dueAt') }}</TooltipContent>
        </Tooltip>
      </div>

      <div
        v-if="hasSecondaryMetaBadges"
        data-test="todo-secondary-meta"
        class="flex flex-wrap items-center gap-0.5 pl-0.5 text-[11px] md:gap-1 md:text-[var(--todo-font-caption)]"
      >
        <Tooltip v-if="hasStandaloneReminder && remindDisplay">
          <TooltipTrigger as-child>
            <div
              class="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border px-1.5 py-[3px] font-medium leading-none md:py-0.5"
              :class="
                isReminderOverdue
                  ? 'border-destructive/35 bg-destructive/10 text-destructive'
                  : hasDueAt
                    ? 'border-border/70 bg-muted/45 text-muted-foreground'
                    : 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400/90'
              "
            >
              <Bell class="h-3 w-3" />
              <span>{{ remindDisplay }}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" class="space-y-0.5">
            <p>{{ t('todo.remindAt') }}</p>
            <p v-if="remindRelativeDisplay" class="text-[11px] text-muted-foreground">
              {{ remindRelativeDisplay }}
            </p>
          </TooltipContent>
        </Tooltip>

        <Tooltip v-if="showDeferredBadge">
          <TooltipTrigger as-child>
            <div
              class="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border border-border/70 bg-muted/45 px-1.5 py-[3px] font-medium leading-none text-muted-foreground md:py-0.5"
            >
              <Clock3 class="h-3 w-3" />
              <span>{{ t('todo.deferred') }}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top">{{ t('todo.deferredSection') }}</TooltipContent>
        </Tooltip>

        <Tooltip v-if="todo.pomodoroCount > 0">
          <TooltipTrigger as-child>
            <div
              class="animate-in fade-in zoom-in-95 flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg bg-rose-500/10 px-1.5 py-[3px] font-medium text-rose-500 duration-500 dark:text-rose-400/90 md:py-0.5 md:font-semibold"
            >
              <Timer class="h-3 w-3" />
              <span>{{ todo.pomodoroCount }}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top">
            {{ t('pomodoro.sessions', { count: todo.pomodoroCount }) }}
          </TooltipContent>
        </Tooltip>

        <Tooltip v-if="recurrenceLabelKey">
          <TooltipTrigger as-child>
            <div
              class="flex shrink-0 items-center whitespace-nowrap rounded-lg bg-sky-500/10 px-1.5 py-[3px] font-medium leading-none text-sky-600 dark:text-sky-400/90 md:py-0.5"
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
