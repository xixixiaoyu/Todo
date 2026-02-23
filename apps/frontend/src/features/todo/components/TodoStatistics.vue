<script setup lang="ts">
import { computed, ref, onMounted, nextTick, onBeforeUnmount, onActivated } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDark, useResizeObserver } from '@vueuse/core'
import VChart from 'vue-echarts'
import { debounce } from 'lodash-es'
import { useTodoStore } from '../stores/todo'
import { usePomodoroStore } from '../stores/pomodoro'
import { useTodoStatisticsOptions } from '../composables/useTodoStatisticsOptions'
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
const pomodoroHistory = computed(() => pomodoroStore.history)

const {
  totalTasks,
  completedTasks,
  pendingTasks,
  completionRate,
  weeklyActivityOption,
  completionChartOption,
  focusDurationOption,
} = useTodoStatisticsOptions({
  t,
  locale,
  isDark,
  themeColor,
  activeTodos,
  pomodoroHistory,
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
