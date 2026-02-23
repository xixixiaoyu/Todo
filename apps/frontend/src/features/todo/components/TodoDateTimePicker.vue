<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ChevronLeft, ChevronRight, Clock3 } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { toDate } from '../stores/todo.dates'

const props = defineProps<{
  modelValue: Date | string | number | null | undefined
}>()

const emit = defineEmits<{
  'update:modelValue': [Date | null]
}>()

const { locale } = useI18n()

function pad2(n: number): string {
  return n.toString().padStart(2, '0')
}

const value = computed<Date | null>(() => toDate(props.modelValue))

const viewYear = ref<number>(new Date().getFullYear())
const viewMonth = ref<number>(new Date().getMonth())

const hour = ref<number>(new Date().getHours())
const minute = ref<number>(Math.floor(new Date().getMinutes() / 5) * 5)

watch(
  value,
  (v) => {
    if (!v) return
    viewYear.value = v.getFullYear()
    viewMonth.value = v.getMonth()
    hour.value = v.getHours()
    minute.value = v.getMinutes()
  },
  { immediate: true },
)

function formatMonthTitle(year: number, month: number): string {
  const loc = locale.value || 'en-US'
  if (loc.startsWith('zh')) {
    return `${year}年${pad2(month + 1)}月`
  }
  return new Intl.DateTimeFormat(loc, { year: 'numeric', month: 'long' }).format(
    new Date(year, month, 1),
  )
}

const monthTitle = computed(() => formatMonthTitle(viewYear.value, viewMonth.value))

function startOfMonth(year: number, month: number): Date {
  return new Date(year, month, 1)
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function weekdayIndexMon0(date: Date): number {
  const js = date.getDay()
  return (js + 6) % 7
}

const weekdayLabels = ['一', '二', '三', '四', '五', '六', '日']

const gridDays = computed(() => {
  const first = startOfMonth(viewYear.value, viewMonth.value)
  const leading = weekdayIndexMon0(first)
  const total = daysInMonth(viewYear.value, viewMonth.value)

  const cells: Array<{ day: number; isCurrentMonth: boolean }> = []
  for (let i = 0; i < leading; i++) cells.push({ day: 0, isCurrentMonth: false })
  for (let d = 1; d <= total; d++) cells.push({ day: d, isCurrentMonth: true })
  while (cells.length % 7 !== 0) cells.push({ day: 0, isCurrentMonth: false })
  return cells
})

const selectedKey = computed(() => {
  const v = value.value
  if (!v) return ''
  return `${v.getFullYear()}-${v.getMonth()}-${v.getDate()}`
})

const todayKey = computed(() => {
  const now = new Date()
  return `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`
})

function cellKey(day: number): string {
  return `${viewYear.value}-${viewMonth.value}-${day}`
}

function dayAriaLabel(day: number): string {
  return `${viewYear.value}-${pad2(viewMonth.value + 1)}-${pad2(day)}`
}

function setMonth(delta: number) {
  const date = new Date(viewYear.value, viewMonth.value + delta, 1)
  viewYear.value = date.getFullYear()
  viewMonth.value = date.getMonth()
}

function setToday() {
  const now = new Date()
  viewYear.value = now.getFullYear()
  viewMonth.value = now.getMonth()
  hour.value = now.getHours()
  minute.value = Math.floor(now.getMinutes() / 5) * 5
  emit(
    'update:modelValue',
    new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour.value, minute.value),
  )
}

function setSelectedDay(day: number) {
  if (day <= 0) return
  const base = value.value ?? new Date()
  const d = new Date(viewYear.value, viewMonth.value, day, hour.value, minute.value, 0, 0)
  if (Number.isNaN(d.getTime())) return
  if (!value.value) {
    hour.value = base.getHours()
    minute.value = Math.floor(base.getMinutes() / 5) * 5
    d.setHours(hour.value, minute.value, 0, 0)
  }
  emit('update:modelValue', d)
}

function updateTime(nextHour: number, nextMinute: number) {
  hour.value = nextHour
  minute.value = nextMinute
  const base = value.value
  if (base) {
    const d = new Date(base)
    d.setHours(nextHour, nextMinute, 0, 0)
    emit('update:modelValue', d)
    return
  }

  const now = new Date()
  const day =
    now.getFullYear() === viewYear.value && now.getMonth() === viewMonth.value ? now.getDate() : 1
  emit(
    'update:modelValue',
    new Date(viewYear.value, viewMonth.value, day, nextHour, nextMinute, 0, 0),
  )
}

const hours = Array.from({ length: 24 }, (_, i) => i)
const minutes = Array.from({ length: 12 }, (_, i) => i * 5)
</script>

<template>
  <div class="rounded-2xl border border-border/50 bg-background/50 backdrop-blur-xl p-3">
    <div class="flex items-center justify-between gap-2">
      <div class="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          class="h-8 w-8 rounded-xl hover:bg-muted/50"
          aria-label="Previous month"
          @click.stop="setMonth(-1)"
        >
          <ChevronLeft class="h-4 w-4 opacity-70" />
        </Button>
        <p class="text-sm font-semibold tracking-tight tabular-nums">{{ monthTitle }}</p>
        <Button
          variant="ghost"
          size="icon"
          class="h-8 w-8 rounded-xl hover:bg-muted/50"
          aria-label="Next month"
          @click.stop="setMonth(1)"
        >
          <ChevronRight class="h-4 w-4 opacity-70" />
        </Button>
      </div>

      <Button
        variant="ghost"
        size="sm"
        class="h-8 rounded-xl px-3 text-xs hover:bg-muted/50"
        @click.stop="setToday"
      >
        今天
      </Button>
    </div>

    <div class="mt-3 grid grid-cols-7 gap-1">
      <div
        v-for="w in weekdayLabels"
        :key="w"
        class="h-7 flex items-center justify-center text-[10px] font-semibold text-muted-foreground/70"
      >
        {{ w }}
      </div>

      <button
        v-for="(cell, idx) in gridDays"
        :key="idx"
        type="button"
        class="h-9 rounded-xl text-sm font-semibold tabular-nums transition-all duration-150 hover:-translate-y-[1px] active:translate-y-0"
        :class="[
          cell.isCurrentMonth
            ? 'text-foreground hover:bg-muted/50'
            : 'text-muted-foreground/30 cursor-default',
          cell.isCurrentMonth && selectedKey === cellKey(cell.day)
            ? 'bg-primary/15 text-primary'
            : '',
          cell.isCurrentMonth && todayKey === cellKey(cell.day) && selectedKey !== cellKey(cell.day)
            ? 'ring-1 ring-primary/20'
            : '',
        ]"
        :disabled="!cell.isCurrentMonth"
        :aria-label="cell.isCurrentMonth ? dayAriaLabel(cell.day) : undefined"
        @click.stop="setSelectedDay(cell.day)"
      >
        {{ cell.day || '' }}
      </button>
    </div>

    <div class="mt-3 flex items-center justify-between gap-2">
      <div class="flex items-center gap-2 text-xs text-muted-foreground">
        <Clock3 class="h-3.5 w-3.5 opacity-70" />
        <span class="tabular-nums">{{ pad2(hour) }}:{{ pad2(minute) }}</span>
      </div>

      <div class="flex items-center gap-2">
        <select
          class="h-9 rounded-xl border border-border/50 bg-background/60 px-2 text-sm tabular-nums outline-none focus:ring-1 focus:ring-ring"
          :value="hour"
          @change="updateTime(Number(($event.target as HTMLSelectElement).value), minute)"
        >
          <option v-for="h in hours" :key="h" :value="h">{{ pad2(h) }}</option>
        </select>
        <select
          class="h-9 rounded-xl border border-border/50 bg-background/60 px-2 text-sm tabular-nums outline-none focus:ring-1 focus:ring-ring"
          :value="minute"
          @change="updateTime(hour, Number(($event.target as HTMLSelectElement).value))"
        >
          <option v-for="m in minutes" :key="m" :value="m">{{ pad2(m) }}</option>
        </select>
      </div>
    </div>
  </div>
</template>
