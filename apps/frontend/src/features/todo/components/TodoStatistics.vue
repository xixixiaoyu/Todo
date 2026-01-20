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

// 近 7 天完成趋势
const trendChartOption = computed(() => {
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return d.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })
  })

  // 模拟数据：根据 createdAt 和 completedAt 计算
  // 实际项目中这里应该从后端获取或通过更复杂的逻辑计算
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
    grid: {
      top: '10%',
      left: '3%',
      right: '4%',
      bottom: '3%',
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
        fontSize: 12,
      },
    },
    yAxis: {
      type: 'value',
      splitLine: {
        lineStyle: {
          color: isDark.value ? '#334155' : '#f1f5f9',
        },
      },
      axisLabel: {
        color: isDark.value ? '#94a3b8' : '#64748b',
      },
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
        data: completedData,
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        itemStyle: { color: '#fbbf24' },
        lineStyle: { width: 3 },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(251, 191, 36, 0.2)' },
              { offset: 1, color: 'rgba(251, 191, 36, 0)' },
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
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <!-- 总任务 -->
      <Card class="border-none shadow-sm bg-primary/5">
        <CardContent class="p-4 flex items-center space-x-4">
          <div class="p-2.5 bg-primary/10 rounded-xl">
            <ListTodo class="w-5 h-5 text-primary" />
          </div>
          <div>
            <p class="text-xs text-muted-foreground">{{ t('statistics.totalTasks') }}</p>
            <h3 class="text-xl font-bold">{{ totalTasks }}</h3>
          </div>
        </CardContent>
      </Card>

      <!-- 已完成 -->
      <Card class="border-none shadow-sm bg-green-500/5">
        <CardContent class="p-4 flex items-center space-x-4">
          <div class="p-2.5 bg-green-500/10 rounded-xl">
            <CheckCircle2 class="w-5 h-5 text-green-500" />
          </div>
          <div>
            <p class="text-xs text-muted-foreground">{{ t('statistics.completedTasks') }}</p>
            <h3 class="text-xl font-bold">{{ completedTasks }}</h3>
          </div>
        </CardContent>
      </Card>

      <!-- 待完成 -->
      <Card class="border-none shadow-sm bg-blue-500/5">
        <CardContent class="p-4 flex items-center space-x-4">
          <div class="p-2.5 bg-blue-500/10 rounded-xl">
            <Circle class="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <p class="text-xs text-muted-foreground">{{ t('statistics.pendingTasks') }}</p>
            <h3 class="text-xl font-bold">{{ pendingTasks }}</h3>
          </div>
        </CardContent>
      </Card>

      <!-- 番茄数 -->
      <Card class="border-none shadow-sm bg-amber-500/5">
        <CardContent class="p-4 flex items-center space-x-4">
          <div class="p-2.5 bg-amber-500/10 rounded-xl">
            <Timer class="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <p class="text-xs text-muted-foreground">{{ t('statistics.pomodoroSessions') }}</p>
            <h3 class="text-xl font-bold">{{ pomodoroStore.completedSessions }}</h3>
          </div>
        </CardContent>
      </Card>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- 完成率饼图 -->
      <Card class="lg:col-span-1 border-none shadow-sm overflow-hidden bg-card/50 backdrop-blur-sm">
        <CardHeader class="pb-2">
          <CardTitle class="text-sm font-medium flex items-center gap-2">
            <PieChartIcon class="w-4 h-4 text-primary" />
            {{ t('statistics.completionRate') }}
          </CardTitle>
        </CardHeader>
        <CardContent class="h-[240px] relative">
          <VChart :option="completionChartOption" autoresize />
          <div
            class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pt-8"
          >
            <span class="text-3xl font-bold text-primary">{{ completionRate }}%</span>
          </div>
        </CardContent>
      </Card>

      <!-- 趋势图 -->
      <Card class="lg:col-span-2 border-none shadow-sm overflow-hidden bg-card/50 backdrop-blur-sm">
        <CardHeader class="pb-2">
          <CardTitle class="text-sm font-medium flex items-center gap-2">
            <TrendingUp class="w-4 h-4 text-amber-500" />
            {{ t('statistics.completionTrend') }}
          </CardTitle>
        </CardHeader>
        <CardContent class="h-[240px]">
          <VChart :option="trendChartOption" autoresize />
        </CardContent>
      </Card>
    </div>
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
