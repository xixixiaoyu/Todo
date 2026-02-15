<script setup lang="ts">
import { computed, ref, onMounted, nextTick, onBeforeUnmount, onActivated } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDark, useResizeObserver } from '@vueuse/core'
import VChart from 'vue-echarts'
import { debounce } from 'lodash-es'
import { useTodoStore } from '../stores/todo'
import { usePomodoroStore } from '../stores/pomodoro'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useTheme } from '@/composables/useTheme'
import {
  CheckCircle2,
  Circle,
  ListTodo,
  Timer,
  TrendingUp,
  PieChart as PieChartIcon,
} from 'lucide-vue-next'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { PieChart, LineChart, BarChart } from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
} from 'echarts/components'
import { LegacyGridContainLabel } from 'echarts/features'

type Rgb = {
  r: number
  g: number
  b: number
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function getCssVar(name: string) {
  if (typeof window === 'undefined') return ''
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

function parseRgb(value: string): Rgb | null {
  const parts = value
    .split(',')
    .map((v) => Number.parseInt(v.trim(), 10))
    .filter((v) => !Number.isNaN(v))

  if (parts.length !== 3) return null
  return { r: clamp(parts[0], 0, 255), g: clamp(parts[1], 0, 255), b: clamp(parts[2], 0, 255) }
}

function parseHslTriplet(value: string) {
  const [hRaw, sRaw, lRaw] = value.split(/\s+/)
  const h = Number.parseFloat(hRaw)
  const s = Number.parseFloat((sRaw ?? '').replace('%', ''))
  const l = Number.parseFloat((lRaw ?? '').replace('%', ''))

  if ([h, s, l].some((n) => Number.isNaN(n))) return null
  return { h, s, l }
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  const hh = ((h % 360) + 360) % 360
  const ss = clamp(s, 0, 100) / 100
  const ll = clamp(l, 0, 100) / 100

  const c = (1 - Math.abs(2 * ll - 1)) * ss
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1))
  const m = ll - c / 2

  let r1 = 0
  let g1 = 0
  let b1 = 0

  if (hh < 60) {
    r1 = c
    g1 = x
  } else if (hh < 120) {
    r1 = x
    g1 = c
  } else if (hh < 180) {
    g1 = c
    b1 = x
  } else if (hh < 240) {
    g1 = x
    b1 = c
  } else if (hh < 300) {
    r1 = x
    b1 = c
  } else {
    r1 = c
    b1 = x
  }

  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  }
}

function rgbString({ r, g, b }: Rgb) {
  return `rgb(${r}, ${g}, ${b})`
}

function rgbaString({ r, g, b }: Rgb, alpha: number) {
  return `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1)})`
}

function mixRgb(a: Rgb, b: Rgb, amount: number): Rgb {
  const t = clamp(amount, 0, 1)
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  }
}

use([
  CanvasRenderer,
  PieChart,
  LineChart,
  BarChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  LegacyGridContainLabel,
])

defineOptions({ name: 'TodoStatistics' })

const { t, locale } = useI18n()
const isDark = useDark()
const todoStore = useTodoStore()
const pomodoroStore = usePomodoroStore()
const { themeColor } = useTheme()

const isReady = ref(false)
const containerRef = ref<HTMLElement | null>(null)
const completionChartRef = ref<InstanceType<typeof VChart> | null>(null)
const weeklyChartRef = ref<InstanceType<typeof VChart> | null>(null)
const focusChartRef = ref<InstanceType<typeof VChart> | null>(null)

// 使用 ResizeObserver 确保容器尺寸就绪后再初始化图表，并添加防抖优化性能
const debouncedResize = debounce(() => {
  completionChartRef.value?.resize()
  weeklyChartRef.value?.resize()
  focusChartRef.value?.resize()
}, 100)

onBeforeUnmount(() => {
  debouncedResize.cancel()
})

useResizeObserver(containerRef, (entries) => {
  const entry = entries[0]
  const { width, height } = entry.contentRect
  if (width > 0 && height > 0) {
    if (!isReady.value) {
      isReady.value = true
    }
    debouncedResize()
  }
})

onMounted(async () => {
  await nextTick()
  const checkSize = () => {
    if (
      containerRef.value &&
      containerRef.value.clientWidth > 0 &&
      containerRef.value.clientHeight > 0
    ) {
      isReady.value = true
    } else {
      let attempts = 0
      const retry = () => {
        if (attempts > 20) return
        if (
          containerRef.value &&
          containerRef.value.clientWidth > 0 &&
          containerRef.value.clientHeight > 0
        ) {
          isReady.value = true
        } else {
          attempts++
          requestAnimationFrame(retry)
        }
      }
      retry()
    }
  }
  checkSize()
})

onActivated(() => {
  requestAnimationFrame(() => {
    if (!containerRef.value) return
    if (containerRef.value.clientWidth > 0 && containerRef.value.clientHeight > 0) {
      isReady.value = true
      debouncedResize()
    }
  })
})

// 概览数据
const activeTodos = computed(() => todoStore.todos.filter((t) => !t.deletedAt))

const totalTasks = computed(() => activeTodos.value.length)
const completedTasks = computed(() => activeTodos.value.filter((t) => t.completed).length)
const pendingTasks = computed(() => totalTasks.value - completedTasks.value)
const completionRate = computed(() =>
  totalTasks.value > 0 ? Math.round((completedTasks.value / totalTasks.value) * 100) : 0,
)

// 每周活跃度（新增 vs 完成）
const weeklyActivityOption = computed(() => {
  const _themeColor = themeColor.value
  void _themeColor

  const primaryRgb =
    parseRgb(getCssVar('--primary-rgb')) ??
    (isDark.value ? { r: 201, g: 184, b: 150 } : { r: 129, g: 95, b: 49 })
  const successHsl = parseHslTriplet(getCssVar('--success'))
  const successRgb = successHsl
    ? hslToRgb(successHsl.h, successHsl.s, successHsl.l)
    : { r: 5, g: 150, b: 105 }

  const createdColor = rgbString(primaryRgb)
  const completedColor = rgbString(successRgb)

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return d.toLocaleDateString(locale.value, { weekday: 'short' })
  })

  // 计算过去 7 天每天新增和完成的任务数
  const createdData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    d.setHours(0, 0, 0, 0)
    const nextD = new Date(d)
    nextD.setDate(nextD.getDate() + 1)

    return activeTodos.value.filter((t) => {
      const createdAt = new Date(t.createdAt)
      return createdAt >= d && createdAt < nextD
    }).length
  })

  const completedData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    d.setHours(0, 0, 0, 0)
    const nextD = new Date(d)
    nextD.setDate(nextD.getDate() + 1)

    return activeTodos.value.filter((t) => {
      if (!t.completed || !t.completedAt) return false
      const completedAt = new Date(t.completedAt)
      return completedAt >= d && completedAt < nextD
    }).length
  })

  return {
    backgroundColor: 'transparent',
    legend: {
      data: [t('statistics.createdTasks'), t('statistics.completedTasks')],
      top: 0,
      right: '10%',
      textStyle: {
        color: isDark.value ? '#94a3b8' : '#64748b',
        fontSize: 10,
      },
      icon: 'circle',
    },
    grid: {
      top: '15%',
      left: '3%',
      right: '3%',
      bottom: '10%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: weekDays,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: isDark.value ? '#94a3b8' : '#64748b',
        fontSize: 10,
      },
    },
    yAxis: {
      type: 'value',
      splitLine: {
        lineStyle: {
          color: isDark.value ? '#334155' : '#f1f5f9',
          type: 'dashed',
        },
      },
      axisLabel: { show: false },
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: isDark.value ? 'rgba(30, 41, 59, 0.9)' : 'rgba(255, 255, 255, 0.9)',
      borderColor: isDark.value ? '#334155' : '#e2e8f0',
      textStyle: { color: isDark.value ? '#f8fafc' : '#1e293b' },
      extraCssText: 'backdrop-filter: blur(4px); border-radius: 8px;',
    },
    series: [
      {
        name: t('statistics.createdTasks'),
        data: createdData,
        type: 'bar',
        barWidth: '25%',
        itemStyle: {
          color: createdColor,
          borderRadius: [4, 4, 0, 0],
        },
      },
      {
        name: t('statistics.completedTasks'),
        data: completedData,
        type: 'bar',
        barWidth: '25%',
        itemStyle: {
          color: completedColor,
          borderRadius: [4, 4, 0, 0],
        },
      },
    ],
  }
})

// 完成率饼图配置
const completionChartOption = computed(() => {
  const _themeColor = themeColor.value
  void _themeColor

  const primaryRgb =
    parseRgb(getCssVar('--primary-rgb')) ??
    (isDark.value ? { r: 201, g: 184, b: 150 } : { r: 129, g: 95, b: 49 })
  const successHsl = parseHslTriplet(getCssVar('--success'))
  const successRgb = successHsl
    ? hslToRgb(successHsl.h, successHsl.s, successHsl.l)
    : { r: 5, g: 150, b: 105 }

  const pendingRgb = mixRgb(primaryRgb, { r: 255, g: 255, b: 255 }, isDark.value ? 0.35 : 0.65)

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)',
    },
    series: [
      {
        name: t('statistics.completionRate'),
        type: 'pie',
        radius: ['60%', '85%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: isDark.value ? '#1e293b' : '#fff',
          borderWidth: 2,
        },
        label: {
          show: false,
          position: 'center',
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 20,
            fontWeight: 'bold',
            color: isDark.value ? '#f8fafc' : '#1e293b',
          },
        },
        labelLine: {
          show: false,
        },
        data: [
          {
            value: completedTasks.value,
            name: t('todo.completed'),
            itemStyle: { color: rgbString(successRgb) },
          },
          {
            value: pendingTasks.value,
            name: t('todo.pending'),
            itemStyle: { color: rgbString(pendingRgb) },
          },
        ],
      },
    ],
  }
})

// 近 7 天专注时长趋势
const focusDurationOption = computed(() => {
  const _themeColor = themeColor.value
  void _themeColor

  const primaryRgb =
    parseRgb(getCssVar('--primary-rgb')) ??
    (isDark.value ? { r: 201, g: 184, b: 150 } : { r: 129, g: 95, b: 49 })
  const focusColor = rgbString(primaryRgb)
  const focusAreaStart = rgbaString(primaryRgb, isDark.value ? 0.28 : 0.22)
  const focusAreaEnd = rgbaString(primaryRgb, 0)

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return d.toLocaleDateString(locale.value, { month: 'numeric', day: 'numeric' })
  })

  const focusData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    const dateStr = d.toLocaleDateString('sv-SE')
    const entry = pomodoroStore.history.find((h) => h.date === dateStr)
    return entry ? entry.minutes : 0
  })

  return {
    backgroundColor: 'transparent',
    grid: {
      top: '15%',
      left: '3%',
      right: '3%',
      bottom: '10%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: last7Days,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: isDark.value ? '#94a3b8' : '#64748b',
        fontSize: 10,
      },
    },
    yAxis: {
      type: 'value',
      splitLine: {
        lineStyle: {
          color: isDark.value ? '#334155' : '#f1f5f9',
          type: 'dashed',
        },
      },
      axisLabel: {
        color: isDark.value ? '#94a3b8' : '#64748b',
        fontSize: 10,
        formatter: (value: number) => (value > 0 ? `${value}m` : value),
      },
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: isDark.value ? 'rgba(30, 41, 59, 0.9)' : 'rgba(255, 255, 255, 0.9)',
      borderColor: isDark.value ? '#334155' : '#e2e8f0',
      textStyle: { color: isDark.value ? '#f8fafc' : '#1e293b' },
      formatter: (
        params: { name: string; marker: string; seriesName: string; value: number }[],
      ) => {
        const item = params[0]
        return `${item.name}<br/>${item.marker} ${item.seriesName}: <b>${item.value} ${t('common.minutes')}</b>`
      },
      extraCssText: 'backdrop-filter: blur(4px); border-radius: 8px;',
    },
    series: [
      {
        name: t('statistics.focusTime'),
        data: focusData,
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        itemStyle: { color: focusColor },
        lineStyle: { width: 3, color: focusColor },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: focusAreaStart },
              { offset: 1, color: focusAreaEnd },
            ],
          },
        },
      },
    ],
  }
})
</script>

<template>
  <div ref="containerRef" class="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-1">
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <!-- 总任务 -->
      <Card
        class="border-none shadow-sm bg-gradient-to-br from-primary/10 to-primary/5 hover:from-primary/15 hover:to-primary/10 transition-colors"
      >
        <CardContent class="p-4 flex items-center space-x-4">
          <div
            class="w-12 h-12 flex items-center justify-center bg-primary/10 rounded-full shadow-inner"
          >
            <ListTodo class="w-6 h-6 text-primary" />
          </div>
          <div>
            <p class="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {{ t('statistics.totalTasks') }}
            </p>
            <h3 class="text-2xl font-black mt-0.5 leading-none">{{ totalTasks }}</h3>
          </div>
        </CardContent>
      </Card>

      <!-- 已完成 -->
      <Card
        class="border-none shadow-sm bg-gradient-to-br from-green-500/10 to-green-500/5 hover:from-green-500/15 hover:to-green-500/10 transition-colors"
      >
        <CardContent class="p-4 flex items-center space-x-4">
          <div
            class="w-12 h-12 flex items-center justify-center bg-green-500/10 rounded-full shadow-inner"
          >
            <CheckCircle2 class="w-6 h-6 text-green-500" />
          </div>
          <div>
            <p class="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {{ t('statistics.completedTasks') }}
            </p>
            <h3 class="text-2xl font-black mt-0.5 leading-none">{{ completedTasks }}</h3>
          </div>
        </CardContent>
      </Card>

      <!-- 待完成 -->
      <Card
        class="border-none shadow-sm bg-gradient-to-br from-primary/10 to-primary/5 hover:from-primary/15 hover:to-primary/10 transition-colors"
      >
        <CardContent class="p-4 flex items-center space-x-4">
          <div
            class="w-12 h-12 flex items-center justify-center bg-primary/10 rounded-full shadow-inner"
          >
            <Circle class="w-6 h-6 text-primary" />
          </div>
          <div>
            <p class="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {{ t('statistics.pendingTasks') }}
            </p>
            <h3 class="text-2xl font-black mt-0.5 leading-none">{{ pendingTasks }}</h3>
          </div>
        </CardContent>
      </Card>

      <!-- 番茄数 -->
      <Card
        class="border-none shadow-sm bg-gradient-to-br from-primary/10 to-primary/5 hover:from-primary/15 hover:to-primary/10 transition-colors"
      >
        <CardContent class="p-4 flex items-center space-x-4">
          <div
            class="w-12 h-12 flex items-center justify-center bg-primary/10 rounded-full shadow-inner"
          >
            <Timer class="w-6 h-6 text-primary" />
          </div>
          <div>
            <p class="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {{ t('statistics.pomodoroSessions') }}
            </p>
            <h3 class="text-2xl font-black mt-0.5 leading-none">
              {{ pomodoroStore.completedSessions }}
            </h3>
          </div>
        </CardContent>
      </Card>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
      <!-- 完成率饼图 -->
      <Card
        class="lg:col-span-4 border-none shadow-sm overflow-hidden bg-card/50 backdrop-blur-sm group"
      >
        <CardHeader class="pb-2">
          <CardTitle class="text-sm font-semibold flex items-center gap-2">
            <PieChartIcon class="w-4 h-4 text-primary" />
            {{ t('statistics.completionRate') }}
          </CardTitle>
        </CardHeader>
        <CardContent class="h-[300px] relative">
          <Transition
            enter-active-class="transition-opacity duration-300 ease-out"
            enter-from-class="opacity-0"
            enter-to-class="opacity-100"
            leave-active-class="transition-opacity duration-200 ease-in"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
            mode="out-in"
          >
            <VChart
              v-if="isReady"
              ref="completionChartRef"
              :option="completionChartOption"
              autoresize
            />
            <div
              v-else
              data-test="chart-skeleton"
              class="absolute inset-4 rounded-xl bg-muted/40 animate-pulse"
            />
          </Transition>
          <div
            v-if="isReady"
            class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
          >
            <span
              class="text-4xl font-black text-primary group-hover:scale-110 transition-transform duration-500"
              >{{ completionRate }}%</span
            >
          </div>
        </CardContent>
      </Card>

      <!-- 每周活跃度 -->
      <Card class="lg:col-span-8 border-none shadow-sm overflow-hidden bg-card/50 backdrop-blur-sm">
        <CardHeader class="pb-2">
          <CardTitle class="text-sm font-semibold flex items-center gap-2">
            <TrendingUp class="w-4 h-4 text-primary" />
            {{ t('statistics.weeklyActivity') }}
          </CardTitle>
        </CardHeader>
        <CardContent class="h-[300px]">
          <Transition
            enter-active-class="transition-opacity duration-300 ease-out"
            enter-from-class="opacity-0"
            enter-to-class="opacity-100"
            leave-active-class="transition-opacity duration-200 ease-in"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
            mode="out-in"
          >
            <VChart v-if="isReady" ref="weeklyChartRef" :option="weeklyActivityOption" autoresize />
            <div
              v-else
              data-test="chart-skeleton"
              class="h-full w-full rounded-xl bg-muted/40 animate-pulse"
            />
          </Transition>
        </CardContent>
      </Card>
    </div>

    <!-- 专注时长图 -->
    <Card class="border-none shadow-sm overflow-hidden bg-card/50 backdrop-blur-sm">
      <CardHeader class="pb-2">
        <CardTitle class="text-sm font-semibold flex items-center gap-2">
          <Timer class="w-4 h-4 text-primary" />
          {{ t('statistics.focusTime') }}
        </CardTitle>
      </CardHeader>
      <CardContent class="h-[280px]">
        <Transition
          enter-active-class="transition-opacity duration-300 ease-out"
          enter-from-class="opacity-0"
          enter-to-class="opacity-100"
          leave-active-class="transition-opacity duration-200 ease-in"
          leave-from-class="opacity-100"
          leave-to-class="opacity-0"
          mode="out-in"
        >
          <VChart v-if="isReady" ref="focusChartRef" :option="focusDurationOption" autoresize />
          <div
            v-else
            data-test="chart-skeleton"
            class="h-full w-full rounded-xl bg-muted/40 animate-pulse"
          />
        </Transition>
      </CardContent>
    </Card>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 10px;
}
.dark .custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
}
</style>
