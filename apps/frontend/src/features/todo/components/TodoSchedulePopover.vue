<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { RecurrenceRule } from '@lumina/shared'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import TodoDateTimePicker from './TodoDateTimePicker.vue'
import { toDate } from '../stores/todo.dates'
import { useIsMobile } from '@/composables/useWindowSize'

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
const { isMobile } = useIsMobile()

const dueValue = ref<Date | null>(null)
const remindValue = ref<Date | null>(null)
const recurrenceValue = ref<RecurrenceRule | null>(null)
const mobileActiveField = ref<'due' | 'remind'>('due')

type QuickAction = {
  key: string
  run: () => void
  disabled?: boolean
}

type RecurrenceOption = {
  value: RecurrenceRule | null
  labelKey: string
}

watch(
  () => [props.dueAt, props.remindAt, props.recurrenceRule] as const,
  ([d, r, recurrenceRule]) => {
    dueValue.value = toDate(d)
    remindValue.value = toDate(r)
    recurrenceValue.value = recurrenceRule ?? null
  },
  { immediate: true },
)

const isInvalid = computed(() => {
  if (!dueValue.value || !remindValue.value) return false
  return remindValue.value.getTime() > dueValue.value.getTime()
})

const isRecurrenceInvalid = computed(() => !!recurrenceValue.value && !dueValue.value)

function addMinutes(base: Date, minutes: number): Date {
  const d = new Date(base)
  d.setMinutes(d.getMinutes() + minutes)
  d.setSeconds(0, 0)
  return d
}

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

const quickRemind = computed<QuickAction[]>(() => {
  const now = new Date()
  const due = dueValue.value
  return [
    { key: 'todo.quickRemindIn15m', run: () => (remindValue.value = addMinutes(now, 15)) },
    { key: 'todo.quickRemindIn1h', run: () => (remindValue.value = addMinutes(now, 60)) },
    {
      key: 'todo.quickRemindBeforeDue10m',
      run: () => {
        if (!due) return
        remindValue.value = addMinutes(due, -10)
      },
      disabled: !due,
    },
    {
      key: 'todo.quickRemindBeforeDue30m',
      run: () => {
        if (!due) return
        remindValue.value = addMinutes(due, -30)
      },
      disabled: !due,
    },
  ]
})

const recurrenceOptions = computed<RecurrenceOption[]>(() => [
  { value: null, labelKey: 'todo.recurrenceNone' },
  { value: 'DAILY', labelKey: 'todo.recurrenceDaily' },
  { value: 'WEEKDAYS', labelKey: 'todo.recurrenceWeekdays' },
  { value: 'WEEKLY', labelKey: 'todo.recurrenceWeekly' },
  { value: 'MONTHLY', labelKey: 'todo.recurrenceMonthly' },
])

const mobileActiveValue = computed<Date | null>({
  get: () => (mobileActiveField.value === 'due' ? dueValue.value : remindValue.value),
  set: (nextValue) => {
    if (mobileActiveField.value === 'due') {
      dueValue.value = nextValue
      return
    }
    remindValue.value = nextValue
  },
})

const mobileQuickActions = computed(() =>
  mobileActiveField.value === 'due' ? quickDue.value : quickRemind.value,
)

const mobileTitleKey = computed(() =>
  mobileActiveField.value === 'due' ? 'todo.dueAt' : 'todo.remindAt',
)

const mobileClearKey = computed(() =>
  mobileActiveField.value === 'due' ? 'todo.clearDueAt' : 'todo.clearRemindAt',
)

const mobileCanClear = computed(() =>
  mobileActiveField.value === 'due' ? !!dueValue.value : !!remindValue.value,
)

function clearMobileActiveValue() {
  if (mobileActiveField.value === 'due') {
    dueValue.value = null
    return
  }
  remindValue.value = null
}

function apply() {
  if (isInvalid.value || isRecurrenceInvalid.value) return
  emit('apply', dueValue.value, remindValue.value, recurrenceValue.value)
  emit('close')
}
</script>

<template>
  <div class="space-y-4">
    <template v-if="isMobile">
      <div class="rounded-xl border border-border/60 bg-muted/25 p-1">
        <div class="grid grid-cols-2 gap-1">
          <Button
            variant="ghost"
            size="sm"
            class="h-9 rounded-lg text-xs"
            :class="
              mobileActiveField === 'due'
                ? 'bg-background text-foreground shadow-sm hover:bg-background'
                : 'text-muted-foreground hover:bg-background/50'
            "
            @click="mobileActiveField = 'due'"
          >
            {{ t('todo.dueAt') }}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            class="h-9 rounded-lg text-xs"
            :class="
              mobileActiveField === 'remind'
                ? 'bg-background text-foreground shadow-sm hover:bg-background'
                : 'text-muted-foreground hover:bg-background/50'
            "
            @click="mobileActiveField = 'remind'"
          >
            {{ t('todo.remindAt') }}
          </Button>
        </div>
      </div>

      <section class="space-y-2">
        <div class="flex items-center justify-between gap-2">
          <p class="text-sm font-semibold">{{ t(mobileTitleKey) }}</p>
          <Button
            variant="ghost"
            size="xs"
            class="h-7 rounded-lg px-2 text-xs hover:bg-muted/50"
            :disabled="!mobileCanClear"
            @click="clearMobileActiveValue"
          >
            {{ t(mobileClearKey) }}
          </Button>
        </div>
        <div class="flex flex-wrap gap-2">
          <Button
            v-for="item in mobileQuickActions"
            :key="item.key"
            variant="secondary"
            size="xs"
            class="rounded-xl bg-secondary/70 hover:bg-secondary/90"
            :disabled="item.disabled"
            @click="item.run"
          >
            {{ t(item.key) }}
          </Button>
        </div>
        <div class="max-h-[58vh] overflow-y-auto pr-1">
          <TodoDateTimePicker v-model="mobileActiveValue" :default-expanded="false" />
        </div>
      </section>
    </template>

    <template v-else>
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-start">
        <section class="space-y-2">
          <div class="flex items-center justify-between gap-2">
            <p class="text-sm font-semibold">{{ t('todo.dueAt') }}</p>
            <Button
              variant="ghost"
              size="xs"
              class="h-7 rounded-lg px-2 text-xs hover:bg-muted/50"
              :disabled="!dueValue"
              @click="dueValue = null"
            >
              {{ t('todo.clearDueAt') }}
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

        <section class="space-y-2">
          <div class="flex items-center justify-between gap-2">
            <p class="text-sm font-semibold">{{ t('todo.remindAt') }}</p>
            <Button
              variant="ghost"
              size="xs"
              class="h-7 rounded-lg px-2 text-xs hover:bg-muted/50"
              :disabled="!remindValue"
              @click="remindValue = null"
            >
              {{ t('todo.clearRemindAt') }}
            </Button>
          </div>
          <div class="flex flex-wrap gap-2">
            <Button
              v-for="item in quickRemind"
              :key="item.key"
              variant="secondary"
              size="xs"
              class="rounded-xl bg-secondary/70 hover:bg-secondary/90"
              :disabled="item.disabled"
              @click="item.run"
            >
              {{ t(item.key) }}
            </Button>
          </div>
          <TodoDateTimePicker v-model="remindValue" :default-expanded="true" />
        </section>
      </div>
    </template>

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

    <div
      v-if="isInvalid"
      class="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive"
    >
      {{ t('todo.remindAfterDue') }}
    </div>

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
        :disabled="isInvalid || isRecurrenceInvalid"
        @click="apply"
      >
        {{ t('common.confirm') }}
      </Button>
    </div>
  </div>
</template>
