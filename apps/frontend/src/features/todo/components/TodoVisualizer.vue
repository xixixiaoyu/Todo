<script setup lang="ts">
import { computed, ref, onMounted, nextTick, onBeforeUnmount, onActivated } from 'vue'
import { Clover } from 'lucide-vue-next'
import VChart from 'vue-echarts'
import { useDark, useResizeObserver } from '@vueuse/core'
import { useTodoStore } from '../stores/todo'
import type { TreeData } from '../stores/todo.types'
import { useI18n } from 'vue-i18n'
import { debounce } from 'lodash-es'

defineOptions({
  name: 'TodoVisualizer',
})

const todoStore = useTodoStore()
const isDark = useDark()
const { t } = useI18n()

const vChartRef = ref<InstanceType<typeof VChart> | null>(null)
const containerRef = ref<HTMLElement | null>(null)
const isReady = ref(false)

// 使用 ResizeObserver 确保容器尺寸就绪后再初始化图表，并添加防抖优化性能
const debouncedResize = debounce(() => {
  if (!containerRef.value) return
  if (containerRef.value.clientWidth <= 0 || containerRef.value.clientHeight <= 0) return
  vChartRef.value?.resize()
}, 100)

onBeforeUnmount(() => {
  debouncedResize.cancel()
})

useResizeObserver(containerRef, (entries) => {
  const entry = entries[0]
  const { width, height } = entry.contentRect
  if (width <= 0 || height <= 0) {
    isReady.value = false
    return
  }

  if (!isReady.value) {
    isReady.value = true
  }
  debouncedResize()
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
        if (attempts > 20) return // 增加尝试次数以应对可能的动画
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

/**
 * 将扁平化的待办事项转换为树形结构
 */
const treeData = computed(() => {
  const todoMap = new Map<string, TreeData>()
  const roots: TreeData[] = []

  // 使用 Store 中已经根据 Tab 和搜索过滤好的任务
  const displayTodos = todoStore.visualTodos

  // 首先创建所有节点
  displayTodos.forEach((todo) => {
    const isPending = todoStore.filter === 'pending'
    const isCompleted = todoStore.filter === 'completed'

    // 基础颜色系统
    let baseColor = isDark.value ? '#94a3b8' : '#64748b'
    let accentColor = isDark.value ? '#cbd5e1' : '#475569'

    if (todo.isProposed) {
      baseColor = isDark.value ? '#10b981' : '#059669'
      accentColor = isDark.value ? '#34d399' : '#10b981'
    } else if (todo.isProposedDelete) {
      baseColor = isDark.value ? '#ef4444' : '#dc2626'
      accentColor = isDark.value ? '#f87171' : '#ef4444'
    } else if (isCompleted) {
      baseColor = isDark.value ? '#10b981' : '#059669'
      accentColor = isDark.value ? '#34d399' : '#10b981'
    } else if (isPending) {
      baseColor = isDark.value ? '#f59e0b' : '#d97706'
      accentColor = isDark.value ? '#fbbf24' : '#f59e0b'
    }

    const itemStyle: TreeData['itemStyle'] = {
      color: isDark.value ? baseColor : accentColor,
      borderColor: isDark.value ? accentColor : baseColor,
      borderWidth: todo.isProposed ? 2 : 1.5,
      shadowBlur: todo.isProposed ? 8 : 6,
      shadowColor: isDark.value ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.05)',
      shadowOffsetX: 0,
      shadowOffsetY: 2,
    }

    const lineStyle: TreeData['lineStyle'] = {
      color: isDark.value ? 'rgba(148, 163, 184, 0.15)' : 'rgba(100, 116, 139, 0.1)',
      width: todo.isProposed ? 2 : 1.5,
      curveness: 0.5,
    }

    if (todo.isProposed) {
      lineStyle.color = isDark.value ? 'rgba(16, 185, 129, 0.4)' : 'rgba(16, 185, 129, 0.3)'
      lineStyle.type = 'dashed'
    } else if (todo.isProposedDelete) {
      lineStyle.color = isDark.value ? 'rgba(239, 68, 68, 0.4)' : 'rgba(239, 68, 68, 0.3)'
      lineStyle.type = 'dotted'
    }

    let labelType = 'normal'
    if (todo.isProposed) labelType = 'proposed'
    else if (todo.isProposedDelete) labelType = 'delete'
    else if (isCompleted) labelType = 'completed'

    todoMap.set(todo.id, {
      name: todo.title,
      id: todo.id,
      completed: todo.completed,
      isProposed: todo.isProposed,
      isProposedDelete: todo.isProposedDelete,
      children: [],
      itemStyle,
      lineStyle,
      label: {
        formatter: `{${labelType}|${todo.title}}`,
      },
    })
  })

  // 建立父子关系
  displayTodos.forEach((todo) => {
    const node = todoMap.get(todo.id)!
    if (todo.parentId && todoMap.has(todo.parentId)) {
      todoMap.get(todo.parentId)!.children?.push(node)
    } else {
      roots.push(node)
    }
  })

  if (roots.length === 0) return []

  // 如果有多个根节点，创建一个虚拟根节点
  if (roots.length > 1) {
    const rootName =
      todoStore.filter === 'pending'
        ? t('todo.pending')
        : todoStore.filter === 'completed'
          ? t('todo.completed')
          : t('todo.trash')

    const rootColor =
      todoStore.filter === 'pending'
        ? isDark.value
          ? '#fbbf24'
          : '#d97706'
        : todoStore.filter === 'completed'
          ? isDark.value
            ? '#10b981'
            : '#059669'
          : isDark.value
            ? '#ef4444'
            : '#dc2626'

    return [
      {
        name: rootName,
        children: roots,
        itemStyle: {
          color: rootColor,
          borderColor: isDark.value ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.8)',
          borderWidth: 1.5,
          shadowBlur: 8,
          shadowColor: rootColor + '33', // 20% opacity
        },
        label: {
          formatter: `{root|${rootName}}`,
        },
      },
    ]
  }

  // 如果只有一个根节点，直接返回
  if (roots.length === 1) {
    const singleRoot = roots[0]
    singleRoot.label = {
      formatter: `{root|${singleRoot.name}}`,
    }
    // 强制给唯一的根节点应用 root 样式
    singleRoot.itemStyle = {
      ...singleRoot.itemStyle,
      borderWidth: 1.5,
      shadowBlur: 8,
    }
    return [singleRoot]
  }

  return roots
})

const chartOptions = computed(() => ({
  backgroundColor: 'transparent',
  tooltip: {
    trigger: 'item',
    triggerOn: 'mousemove',
    formatter: (params: { data: TreeData }) => {
      const data = params.data
      if (!data.id) return data.name
      let status = t('todo.pending')
      if (data.isProposed) status = `✨ ${t('common.confirm')}`
      if (data.isProposedDelete) status = `🗑️ ${t('common.delete')}`
      if (data.completed) status = `✅ ${t('todo.completed')}`
      return `<div class="px-3 py-2">
        <div class="font-bold text-sm">${data.name}</div>
        <div class="text-[10px] opacity-60 mt-1 flex items-center gap-1">
          <span class="w-1.5 h-1.5 rounded-full" style="background-color: ${data.itemStyle?.color}"></span>
          ${status}
        </div>
      </div>`
    },
    backgroundColor: isDark.value ? 'rgba(15, 23, 42, 0.8)' : 'rgba(255, 255, 255, 0.8)',
    borderColor: isDark.value ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
    borderWidth: 1,
    textStyle: {
      color: isDark.value ? '#f8fafc' : '#1e293b',
      fontSize: 12,
    },
    extraCssText:
      'backdrop-filter: blur(12px); border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.12);',
  },
  series: [
    {
      type: 'tree',
      data: treeData.value,
      initialTreeDepth: -1,
      top: '10%',
      left: '18%', // 略微收紧，因为容器去掉了
      bottom: '10%',
      right: '22%',
      symbolSize: (_: unknown, params: { data: TreeData }) => {
        const data = params.data
        if (!data.id) return 14 // 根节点大幅缩小
        return data.children && data.children.length > 0 ? 10 : 6 // 普通节点更精致
      },
      symbol: 'circle',
      label: {
        position: 'left',
        verticalAlign: 'middle',
        align: 'right',
        fontSize: 12,
        distance: 10,
        color: isDark.value ? '#94a3b8' : '#64748b',
        fontFamily: "'JetBrains Mono', 'LXGW WenKai Screen', sans-serif",
        // 确保标签不会超出容器
        overflow: 'break',
        rich: {
          proposed: {
            color: '#10b981',
            fontWeight: '600',
            fontSize: 13,
            padding: [4, 10],
            borderRadius: 8,
            backgroundColor: isDark.value ? 'rgba(16, 185, 129, 0.12)' : 'rgba(16, 185, 129, 0.08)',
          },
          delete: {
            color: isDark.value ? '#ef4444' : '#dc2626',
            textDecoration: 'line-through',
            opacity: 0.4,
            padding: [2, 6],
          },
          completed: {
            color: '#10b981',
            opacity: 0.8,
            fontSize: 12,
            padding: [2, 6],
          },
          normal: {
            padding: [2, 6],
            color: isDark.value ? '#cbd5e1' : '#475569',
          },
          root: {
            color: isDark.value ? '#fbbf24' : '#d97706',
            fontWeight: '700',
            fontSize: 14,
            padding: [6, 12],
            backgroundColor: isDark.value ? 'rgba(251, 191, 36, 0.12)' : 'rgba(217, 119, 6, 0.06)',
            borderRadius: 8,
            borderWidth: 1,
            borderColor: isDark.value ? 'rgba(251, 191, 36, 0.2)' : 'rgba(217, 119, 6, 0.1)',
          },
        },
      },
      leaves: {
        label: {
          position: 'right',
          align: 'left',
        },
      },
      emphasis: {
        focus: 'descendant',
        itemStyle: {
          borderWidth: 4,
          shadowBlur: 15,
          shadowColor: 'rgba(0,0,0,0.2)',
        },
        label: {
          color: isDark.value ? '#f8fafc' : '#1e293b',
          fontWeight: 'bold',
        },
      },
      expandAndCollapse: true,
      animationDuration: 400,
      animationEasing: 'cubicOut',
    },
  ],
}))

const emptyText = computed(() =>
  todoStore.filter === 'completed' ? t('todo.emptyCompleted') : t('todo.emptyPending'),
)
</script>

<template>
  <div ref="containerRef" class="flex-1 flex flex-col min-h-0 w-full relative group">
    <Transition name="fade" mode="out-in">
      <div
        v-if="treeData.length === 0"
        key="empty"
        class="flex-1 flex flex-col items-center justify-center relative z-10"
      >
        <div class="p-8 rounded-full bg-primary/5 mb-6 animate-pulse">
          <Clover :size="48" class="text-primary/20" />
        </div>
        <p class="text-muted-foreground/60 font-medium tracking-wide">
          {{ emptyText }}
        </p>
      </div>

      <VChart
        v-else-if="isReady"
        key="chart"
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
        <div class="p-8 rounded-full bg-primary/5 mb-6 animate-pulse">
          <Clover :size="48" class="text-primary/20" />
        </div>
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
