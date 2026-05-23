<script setup lang="ts">
import { computed, ref, onMounted, nextTick, onBeforeUnmount, onActivated } from 'vue'
import { Snowflake } from 'lucide-vue-next'
import VChart from 'vue-echarts'
import { useDark, useResizeObserver } from '@vueuse/core'
import { useTodoStore } from '../stores/todo'
import type { FilterType } from '../stores/todo'
import type { TreeData } from '../stores/todo.types'
import { applyFilterAndSort } from '../stores/todo.filtering'
import { useI18n } from 'vue-i18n'
import { debounce } from 'lodash-es'
import { useTheme } from '@/composables/useTheme'
import { buildTodoChartOptions, buildTodoTreeData } from './TodoVisualizer.chart'

defineOptions({
  name: 'TodoVisualizer',
})

const props = defineProps<{
  filter: FilterType
}>()

const todoStore = useTodoStore()
const isDark = useDark()
const { t } = useI18n()
const { themeColor } = useTheme()

// ── 动态图表高度 ──
const CHART_MIN_HEIGHT = 400
const NODE_VERTICAL_SPACE = 36

/** 计算树中任何深度层级上的最大兄弟节点数（原地 BFS，O(n)） */
function getMaxSiblingsAtAnyDepth(nodes: TreeData[]): number {
  if (nodes.length === 0) return 0
  let maxCount = nodes.length
  let head = 0
  while (head < nodes.length) {
    const node = nodes[head++]!
    if (node.children && node.children.length > 0) {
      maxCount = Math.max(maxCount, node.children.length)
      nodes.push(...node.children)
    }
  }
  return maxCount
}

const vChartRef = ref<InstanceType<typeof VChart> | null>(null)
const containerRef = ref<HTMLElement | null>(null)
const isReady = ref(false)
const showChart = ref(false)

// 使用 ResizeObserver 确保容器尺寸就绪后再初始化图表，并添加防抖优化性能
const debouncedResize = debounce(() => {
  if (!containerRef.value) return
  if (containerRef.value.clientWidth <= 0 || containerRef.value.clientHeight <= 0) return
  vChartRef.value?.resize()
}, 100)

onBeforeUnmount(() => {
  debouncedResize.cancel()
})

useResizeObserver(containerRef, async (entries) => {
  const entry = entries[0]
  const { width, height } = entry.contentRect
  if (width <= 0 || height <= 0) return

  if (!isReady.value) {
    isReady.value = true
    await nextTick()
    showChart.value = true
  }
  debouncedResize()
})

onMounted(async () => {
  await nextTick()
  const checkSize = async () => {
    if (
      containerRef.value &&
      containerRef.value.clientWidth > 0 &&
      containerRef.value.clientHeight > 0
    ) {
      isReady.value = true
      await nextTick()
      showChart.value = true
    } else {
      let attempts = 0
      const retry = async () => {
        if (attempts > 20) return // 增加尝试次数以应对可能的动画
        if (
          containerRef.value &&
          containerRef.value.clientWidth > 0 &&
          containerRef.value.clientHeight > 0
        ) {
          isReady.value = true
          await nextTick()
          showChart.value = true
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

onActivated(async () => {
  requestAnimationFrame(async () => {
    if (!containerRef.value) return
    if (containerRef.value.clientWidth > 0 && containerRef.value.clientHeight > 0) {
      isReady.value = true
      await nextTick()
      showChart.value = true
      debouncedResize()
    }
  })
})

const displayTodos = computed(() =>
  applyFilterAndSort(
    todoStore.hasProposedChanges ? todoStore.previewTodos : todoStore.todos,
    props.filter,
    todoStore.searchQuery,
    false,
  ),
)

const treeData = computed(() => {
  const _themeColor = themeColor.value
  void _themeColor

  return buildTodoTreeData({
    displayTodos: displayTodos.value,
    filter: props.filter,
    isDark: isDark.value,
    t: (key: string) => String(t(key)),
  })
})

const chartMinHeight = computed(() => {
  if (treeData.value.length === 0) return CHART_MIN_HEIGHT
  const maxSiblings = getMaxSiblingsAtAnyDepth(treeData.value)
  // 水平树图：同层级兄弟节点占用纵向空间
  // top: '10%', bottom: '10%' 意味着内容区占容器 80%
  const contentHeight = maxSiblings * NODE_VERTICAL_SPACE
  const totalHeight = Math.ceil(contentHeight / 0.8)
  return Math.max(CHART_MIN_HEIGHT, totalHeight)
})

const chartOptions = computed(() => {
  const _themeColor = themeColor.value
  void _themeColor

  return buildTodoChartOptions({
    treeData: treeData.value,
    isDark: isDark.value,
    t: (key: string) => String(t(key)),
  })
})

const emptyText = computed(() =>
  props.filter === 'completed' ? t('todo.emptyCompleted') : t('todo.emptyPending'),
)
</script>

<template>
  <div
    ref="containerRef"
    class="flex-1 flex flex-col w-full relative group"
    :style="{ minHeight: chartMinHeight + 'px' }"
  >
    <Transition name="fade" mode="out-in">
      <div
        v-if="treeData.length === 0"
        key="empty"
        class="flex-1 flex flex-col items-center justify-center relative z-10"
      >
        <div class="p-8 rounded-full bg-primary/5 mb-6 animate-pulse">
          <Snowflake :size="48" class="text-primary/20" />
        </div>
        <p class="text-muted-foreground/60 font-medium tracking-wide">
          {{ emptyText }}
        </p>
      </div>

      <VChart
        v-else-if="showChart"
        :key="`chart-${props.filter}`"
        ref="vChartRef"
        class="flex-1 w-full h-full relative z-10"
        :option="chartOptions"
        :autoresize="false"
        :theme="isDark ? 'dark' : undefined"
      />

      <div
        v-else
        key="loading"
        class="flex-1 flex flex-col items-center justify-center relative z-10"
      >
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
        <p class="text-muted-foreground/60 font-medium tracking-wide">
          {{ t('common.loading') }}
        </p>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* 隐藏 ECharts 默认的高亮蓝边 */
:deep(canvas) {
  outline: none;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
