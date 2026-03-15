<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import TodoDateTimePicker from './TodoDateTimePicker.vue'
import { toDate } from '../stores/todo.dates'

const props = defineProps<{
  dueAt: Date | string | number | null | undefined
  remindAt: Date | string | number | null | undefined
}>()

const emit = defineEmits<{
  apply: [dueAt: Date | null, remindAt: Date | null]
  close: []
}>()

const { t } = useI18n()

const active = ref<'due' | 'remind'>('due')

const dueValue = ref<Date | null>(null)
const remindValue = ref<Date | null>(null)

watch(
  () => [props.dueAt, props.remindAt] as const,
  ([d, r]) => {
    dueValue.value = toDate(d)
    remindValue.value = toDate(r)
  },
  { immediate: true },
)

const isInvalid = computed(() => {
  if (!dueValue.value || !remindValue.value) return false
  return remindValue.value.getTime() > dueValue.value.getTime()
})

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

type QuickAction = { key: string; run: () => void; disabled?: boolean }

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

function clearActive() {
  if (active.value === 'due') {
    dueValue.value = null
  } else {
    remindValue.value = null
  }
}

function apply() {
  if (isInvalid.value) return
  emit('apply', dueValue.value, remindValue.value)
  emit('close')
}
</script>

<template>
  <div class="space-y-3">
    <Tabs v-model="active" class="w-full">
      <TabsList class="w-full grid grid-cols-2 rounded-2xl bg-muted/60 p-1">
        <TabsTrigger value="due" class="rounded-xl text-sm">{{ t('todo.dueAt') }}</TabsTrigger>
        <TabsTrigger value="remind" class="rounded-xl text-sm">{{
          t('todo.remindAt')
        }}</TabsTrigger>
      </TabsList>

      <TabsContent value="due" class="mt-3">
        <div class="mb-3 flex flex-wrap gap-2">
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
        <TodoDateTimePicker v-model="dueValue" />
      </TabsContent>
      <TabsContent value="remind" class="mt-3">
        <div class="mb-3 flex flex-wrap gap-2">
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
        <TodoDateTimePicker v-model="remindValue" />
      </TabsContent>
    </Tabs>

    <div
      v-if="isInvalid"
      class="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive"
    >
      {{ t('todo.remindAfterDue') }}
    </div>

    <div class="flex items-center justify-between gap-2 pt-1">
      <Button
        variant="ghost"
        size="sm"
        class="h-9 rounded-xl px-3 text-xs hover:bg-muted/50"
        @click="clearActive"
      >
        {{ t('common.clear') }}
      </Button>
      <div class="flex items-center gap-2">
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
          :disabled="isInvalid"
          @click="apply"
        >
          {{ t('common.confirm') }}
        </Button>
      </div>
    </div>
  </div>
</template>
