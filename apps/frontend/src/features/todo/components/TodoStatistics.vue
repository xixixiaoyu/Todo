<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDark } from '@vueuse/core'
import VChart from 'vue-echarts'
import { useTodoStore } from '../stores/todo'
import { usePomodoroStore } from '../stores/pomodoro'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

const { t } = useI18n()
const isDark = useDark()
const todoStore = useTodoStore()
const pomodoroStore = usePomodoroStore()

// 概览数据
const totalTasks = computed(() => todoStore.todos.length)
const completedTasks = computed(() => todoStore.todos.filter((t) => t.completed).length)
const pendingTasks = computed(() => totalTasks.value - completedTasks.value)
const completionRate = computed(() =>
  totalTasks.value > 0 ? Math.round((completedTasks.value / totalTasks.value) * 100) : 0,
)

// 每周活跃度（新增 vs 完成）
const weeklyActivityOption = computed(() => {
  const weekDays =
    t('common.language') === 'zh-CN'
      ? ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
      : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  // 计算过去 7 天每天新增和完成的任务数
  const createdData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    d.setHours(0, 0, 0, 0)
    const nextD = new Date(d)
    nextD.setDate(nextD.getDate() + 1)

    return todoStore.todos.filter(
      (t) => new Date(t.createdAt) >= d && new Date(t.createdAt) < nextD,
    ).length
  })

  const completedData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    d.setHours(0, 0, 0, 0)
    const nextD = new Date(d)
    nextD.setDate(nextD.getDate() + 1)

    return todoStore.todos.filter(
      (t) =>
        t.completed &&
        t.completedAt &&
        new Date(t.completedAt) >= d &&
        new Date(t.completedAt) < nextD,
    ).length
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
          color: isDark.value ? '#38bdf8' : '#0ea5e9',
          borderRadius: [4, 4, 0, 0],
        },
      },
      {
        name: t('statistics.completedTasks'),
        data: completedData,
        type: 'bar',
        barWidth: '25%',
        itemStyle: {
          color: isDark.value ? '#8b5cf6' : '#7c3aed',
          borderRadius: [4, 4, 0, 0],
        },
      },
    ],
  }
})

// 完成率饼图配置
const completionChartOption = computed(() => ({
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
          itemStyle: { color: isDark.value ? '#10b981' : '#059669' },
        },
        {
          value: pendingTasks.value,
          name: t('todo.pending'),
          itemStyle: { color: isDark.value ? '#334155' : '#e2e8f0' },
        },
      ],
    },
  ],
}))

// 近 7 天专注时长趋势
const focusDurationOption = computed(() => {
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return d.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })
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
        itemStyle: { color: '#f59e0b' },
        lineStyle: { width: 3, color: '#f59e0b' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(245, 158, 11, 0.3)' },
              { offset: 1, color: 'rgba(245, 158, 11, 0)' },
            ],
          },
        },
      },
    ],
  }
})
</script>

<template>
  <div class="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-1">
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
        class="border-none shadow-sm bg-gradient-to-br from-blue-500/10 to-blue-500/5 hover:from-blue-500/15 hover:to-blue-500/10 transition-colors"
      >
        <CardContent class="p-4 flex items-center space-x-4">
          <div
            class="w-12 h-12 flex items-center justify-center bg-blue-500/10 rounded-full shadow-inner"
          >
            <Circle class="w-6 h-6 text-blue-500" />
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
        class="border-none shadow-sm bg-gradient-to-br from-amber-500/10 to-amber-500/5 hover:from-amber-500/15 hover:to-amber-500/10 transition-colors"
      >
        <CardContent class="p-4 flex items-center space-x-4">
          <div
            class="w-12 h-12 flex items-center justify-center bg-amber-500/10 rounded-full shadow-inner"
          >
            <Timer class="w-6 h-6 text-amber-500" />
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
          <VChart :option="completionChartOption" autoresize />
          <div
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
            <TrendingUp class="w-4 h-4 text-violet-500" />
            {{ t('statistics.weeklyActivity') }}
          </CardTitle>
        </CardHeader>
        <CardContent class="h-[300px]">
          <VChart :option="weeklyActivityOption" autoresize />
        </CardContent>
      </Card>
    </div>

    <!-- 专注时长图 -->
    <Card class="border-none shadow-sm overflow-hidden bg-card/50 backdrop-blur-sm">
      <CardHeader class="pb-2">
        <CardTitle class="text-sm font-semibold flex items-center gap-2">
          <Timer class="w-4 h-4 text-amber-500" />
          {{ t('statistics.focusTime') }}
        </CardTitle>
      </CardHeader>
      <CardContent class="h-[280px]">
        <VChart :option="focusDurationOption" autoresize />
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
  background: rgba(255, 255, 255, 0.1);
}
</style>
