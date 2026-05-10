<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { RecurrenceRule } from '@lumina/shared'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import TodoDateTimePicker from './TodoDateTimePicker.vue'
import {
  hasLegacyReminderOffset,
  isReminderOnlySchedule,
  resolveScheduleDate,
  resolveScheduleUpdate,
} from '../stores/todo.schedule'
import type { ScheduleEditorKind } from '../stores/todo.schedule'

const props = defineProps<{
  dueAt: Date | string | number | null | undefined
  remindAt: Date | string | number | null | undefined
  recurrenceRule?: RecurrenceRule | null | undefined
}>()

const emit = defineEmits<{
  apply: [dueAt: Date | null, remindAt: Date | null, recurrenceRule: RecurrenceRule | null]
  close: []
}>()

const { t } = useI18n()
const dueValue = ref<Date | null>(null)
const recurrenceValue = ref<RecurrenceRule | null>(null)
const scheduleKind = ref<ScheduleEditorKind>('due')
const keepLegacyReminderOffset = ref(false)

type QuickAction = {
  key: string
  run: () => void
}

type RecurrenceOption = {
  value: RecurrenceRule | null
  labelKey: string
}

watch(
  () => [props.dueAt, props.remindAt, props.recurrenceRule] as const,
  ([d, r, recurrenceRule]) => {
    dueValue.value = resolveScheduleDate(d, r)
    recurrenceValue.value = recurrenceRule ?? null
    scheduleKind.value = isReminderOnlySchedule(d, r) ? 'reminder' : 'due'
    keepLegacyReminderOffset.value = hasLegacyReminderOffset(d, r)
  },
  { immediate: true },
)

const isRecurrenceInvalid = computed(
  () => !!recurrenceValue.value && (scheduleKind.value !== 'due' || !dueValue.value),
)
const isLegacyReminderOnly = computed(() => isReminderOnlySchedule(props.dueAt, props.remindAt))
const showScheduleKindSwitch = computed(() => isLegacyReminderOnly.value)
const showLegacyReminderToggle = computed(
  () => scheduleKind.value === 'due' && hasLegacyReminderOffset(props.dueAt, props.remindAt),
)
const reminderHintKey = computed(() => {
  if (scheduleKind.value !== 'due') return null
  if (showLegacyReminderToggle.value && keepLegacyReminderOffset.value) {
    return 'todo.customReminder'
  }

  return 'todo.remindAtAuto'
})
const legacyReminderToggleKey = computed(() =>
  keepLegacyReminderOffset.value ? 'todo.remindAtDue' : 'todo.customReminder',
)
const primaryLabelKey = computed(() =>
  scheduleKind.value === 'reminder' ? 'todo.remindAt' : 'todo.dueAt',
)
const clearLabelKey = computed(() =>
  scheduleKind.value === 'reminder' ? 'todo.clearRemindAt' : 'todo.clearDueAt',
)

function addDays(base: Date, days: number): Date {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return d
}

function atTime(base: Date, hours: number, minutes: number): Date {
  const d = new Date(base)
  d.setHours(hours, minutes, 0, 0)
  return d
}

function nextOccurrence(hours: number, minutes: number): Date {
  const now = new Date()
  const candidate = atTime(now, hours, minutes)
  if (candidate.getTime() <= now.getTime()) {
    return atTime(addDays(now, 1), hours, minutes)
  }
  return candidate
}

const quickDue = computed<QuickAction[]>(() => [
  { key: 'todo.quickDueTonight2359', run: () => (dueValue.value = nextOccurrence(23, 59)) },
  {
    key: 'todo.quickDueTomorrow0900',
    run: () => (dueValue.value = atTime(addDays(new Date(), 1), 9, 0)),
  },
])

const recurrenceOptions = computed<RecurrenceOption[]>(() => [
  { value: null, labelKey: 'todo.recurrenceNone' },
  { value: 'DAILY', labelKey: 'todo.recurrenceDaily' },
  { value: 'WEEKDAYS', labelKey: 'todo.recurrenceWeekdays' },
  { value: 'WEEKLY', labelKey: 'todo.recurrenceWeekly' },
  { value: 'MONTHLY', labelKey: 'todo.recurrenceMonthly' },
])

function setScheduleKind(nextKind: ScheduleEditorKind) {
  scheduleKind.value = nextKind
  if (nextKind === 'due') {
    keepLegacyReminderOffset.value = false
  }
}

function apply() {
  if (isRecurrenceInvalid.value) return
  const nextSchedule = resolveScheduleUpdate(
    props.dueAt,
    props.remindAt,
    dueValue.value,
    recurrenceValue.value,
    {
      scheduleKind: scheduleKind.value,
      keepLegacyReminderOffset: keepLegacyReminderOffset.value,
    },
  )

  emit('apply', nextSchedule.dueAt, nextSchedule.remindAt, recurrenceValue.value)
  emit('close')
}
</script>

<template>
  <div class="space-y-4">
    <section class="space-y-2">
      <div class="flex items-center justify-between gap-2">
        <div class="space-y-1">
          <p class="text-sm font-semibold">{{ t(primaryLabelKey) }}</p>
          <div
            v-if="showScheduleKindSwitch"
            class="inline-flex w-fit items-center rounded-lg border border-border/60 bg-muted/20 p-1"
          >
            <Button
              data-test="schedule-kind-due"
              variant="ghost"
              size="xs"
              class="h-7 rounded-md px-2 text-xs"
              :class="
                scheduleKind === 'due'
                  ? 'bg-background text-foreground shadow-sm hover:bg-background'
                  : 'text-muted-foreground hover:bg-background/50'
              "
              @click="setScheduleKind('due')"
            >
              {{ t('todo.dueAt') }}
            </Button>
            <Button
              data-test="schedule-kind-reminder"
              variant="ghost"
              size="xs"
              class="h-7 rounded-md px-2 text-xs"
              :class="
                scheduleKind === 'reminder'
                  ? 'bg-background text-foreground shadow-sm hover:bg-background'
                  : 'text-muted-foreground hover:bg-background/50'
              "
              @click="setScheduleKind('reminder')"
            >
              {{ t('todo.remindAt') }}
            </Button>
          </div>
          <p v-if="reminderHintKey" class="text-xs text-muted-foreground">
            {{ t(reminderHintKey) }}
          </p>
        </div>
        <Button
          variant="ghost"
          size="xs"
          class="h-7 rounded-lg px-2 text-xs hover:bg-muted/50"
          :disabled="!dueValue"
          @click="dueValue = null"
        >
          {{ t(clearLabelKey) }}
        </Button>
      </div>
      <div v-if="showLegacyReminderToggle" class="flex items-center justify-between gap-2">
        <div class="min-w-0 text-xs text-muted-foreground">
          {{ t(keepLegacyReminderOffset ? 'todo.customReminder' : 'todo.remindAtAuto') }}
        </div>
        <Button
          data-test="legacy-reminder-toggle"
          variant="ghost"
          size="xs"
          class="h-7 rounded-lg px-2 text-xs hover:bg-muted/50"
          @click="keepLegacyReminderOffset = !keepLegacyReminderOffset"
        >
          {{ t(legacyReminderToggleKey) }}
        </Button>
      </div>
      <div class="flex flex-wrap gap-2">
        <Button
          v-for="item in quickDue"
          :key="item.key"
          variant="secondary"
          size="xs"
          class="rounded-xl bg-secondary/70 hover:bg-secondary/90"
          @click="item.run"
        >
          {{ t(item.key) }}
        </Button>
      </div>
      <TodoDateTimePicker v-model="dueValue" :default-expanded="true" />
    </section>

    <section class="space-y-2.5 border-t border-border/60 pt-3">
      <div class="flex items-center justify-between gap-2">
        <p class="text-sm font-semibold">{{ t('todo.recurrence') }}</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <Button
          v-for="item in recurrenceOptions"
          :key="item.labelKey"
          variant="secondary"
          size="xs"
          class="rounded-xl"
          :class="
            recurrenceValue === item.value
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'bg-secondary/70 hover:bg-secondary/90'
          "
          @click="recurrenceValue = item.value"
        >
          {{ t(item.labelKey) }}
        </Button>
      </div>
      <p
        v-if="isRecurrenceInvalid"
        class="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-600 dark:text-amber-400/90"
      >
        {{ t('todo.recurrenceNeedsDue') }}
      </p>
    </section>

    <div class="flex items-center justify-end gap-2 pt-1">
      <Button
        variant="ghost"
        size="sm"
        class="h-9 rounded-xl px-3 text-xs hover:bg-muted/50"
        @click="emit('close')"
      >
        {{ t('common.cancel') }}
      </Button>
      <Button
        variant="default"
        size="sm"
        class="h-9 rounded-xl px-3 text-xs"
        :disabled="isRecurrenceInvalid"
        @click="apply"
      >
        {{ t('common.confirm') }}
      </Button>
    </div>
  </div>
</template>
