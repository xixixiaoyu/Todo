<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { RecurrenceRule } from '@lumina/shared'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import TodoDateTimePicker from './TodoDateTimePicker.vue'
import {
  hasDistinctReminderTime,
  isReminderOnlySchedule,
  resolveScheduleDate,
  resolveScheduleUpdate,
} from '../stores/todo.schedule'

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
  },
  { immediate: true },
)

const isRecurrenceInvalid = computed(() => !!recurrenceValue.value && !dueValue.value)
const isReminderOnly = computed(() => isReminderOnlySchedule(props.dueAt, props.remindAt))
const hasLegacyReminder = computed(() => hasDistinctReminderTime(props.dueAt, props.remindAt))
const primaryLabelKey = computed(() => (isReminderOnly.value ? 'todo.remindAt' : 'todo.dueAt'))
const clearLabelKey = computed(() =>
  isReminderOnly.value ? 'todo.clearRemindAt' : 'todo.clearDueAt',
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

function apply() {
  if (isRecurrenceInvalid.value) return
  const nextSchedule = resolveScheduleUpdate(
    props.dueAt,
    props.remindAt,
    dueValue.value,
    recurrenceValue.value,
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
          <p v-if="!hasLegacyReminder" class="text-xs text-muted-foreground">
            {{ t('todo.remindAtAuto') }}
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
