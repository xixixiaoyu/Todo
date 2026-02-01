<script setup lang="ts">
import { computed, ref } from 'vue'
import { Clover } from 'lucide-vue-next'
import VChart from 'vue-echarts'
import { useDark } from '@vueuse/core'
import { useTodoStore } from '../stores/todo'
import { useI18n } from 'vue-i18n'

const todoStore = useTodoStore()
const isDark = useDark()
const { t } = useI18n()

const vChartRef = ref<InstanceType<typeof VChart> | null>(null)
const containerRef = ref<HTMLElement | null>(null)

interface TreeData {
  name: string
  id?: string
  completed?: boolean
  isProposed?: boolean
  isProposedDelete?: boolean
  children?: TreeData[]
  itemStyle?: {
    color?: string
    borderColor?: string
    borderWidth?: number
    shadowBlur?: number
    shadowColor?: string
  }
  lineStyle?: {
    color?: string
    width?: number
    type?: 'solid' | 'dashed' | 'dotted'
  }
  label?: {
    formatter?: string
    rich?: Record<string, unknown>
  }
}

/**
 * 将扁平化的待办事项转换为树形结构
 */
const treeData = computed(() => {
  const todoMap = new Map<string, TreeData>()
  const roots: TreeData[] = []

  // 预览模式下展示所有相关的任务
  const displayTodos = todoStore.previewTodos.filter(
    (t) => !t.completed || t.isProposed || t.isProposedDelete,
  )

  // 首先创建所有节点
  displayTodos.forEach((todo) => {
    let color = isDark.value ? '#cbd5e1' : '#64748b'
    let borderColor = isDark.value ? '#94a3b8' : '#475569'
    let borderWidth = 2
    let shadowBlur = 0
    let shadowColor = 'transparent'
    let lineStyle: TreeData['lineStyle'] = {
      color: isDark.value ? '#475569' : '#cbd5e1',
      width: 2,
    }

    let labelType = 'normal'

    if (todo.isProposed) {
      color = isDark.value ? '#059669' : '#10b981'
      borderColor = isDark.value ? '#34d399' : '#059669'
      borderWidth = 3
      shadowBlur = 10
      shadowColor = isDark.value ? 'rgba(16, 185, 129, 0.4)' : 'rgba(16, 185, 129, 0.2)'
      lineStyle = {
        color: isDark.value ? '#059669' : '#10b981',
        width: 3,
        type: 'dashed',
      }
      labelType = 'proposed'
    } else if (todo.isProposedDelete) {
      color = isDark.value ? '#b91c1c' : '#ef4444'
      borderColor = isDark.value ? '#f87171' : '#dc2626'
      borderWidth = 2
      lineStyle = {
        color: isDark.value ? '#b91c1c' : '#ef4444',
        width: 2,
        type: 'dotted',
      }
      labelType = 'delete'
    }

    todoMap.set(todo.id, {
      name: todo.title,
      id: todo.id,
      completed: todo.completed,
      isProposed: todo.isProposed,
      isProposedDelete: todo.isProposedDelete,
      children: [],
      itemStyle: {
        color,
        borderColor,
        borderWidth,
        shadowBlur,
        shadowColor,
      },
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
    const rootName = t('todo.pending')
    return [
      {
        name: rootName,
        children: roots,
        itemStyle: {
          color: isDark.value ? '#fbbf24' : '#d97706',
          borderColor: isDark.value ? '#d97706' : '#b45309',
          borderWidth: 2,
        },
        label: {
          formatter: `{root|${rootName}}`,
        },
      },
    ]
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
      return `<div class="px-2 py-1">
        <div class="font-bold">${data.name}</div>
        <div class="text-xs opacity-70 mt-1">${status}</div>
      </div>`
    },
    backgroundColor: isDark.value ? 'rgba(30, 41, 59, 0.9)' : 'rgba(255, 255, 255, 0.9)',
    borderColor: isDark.value ? '#334155' : '#e2e8f0',
    textStyle: {
      color: isDark.value ? '#f8fafc' : '#1e293b',
    },
    extraCssText:
      'backdrop-filter: blur(4px); border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);',
  },
  series: [
    {
      type: 'tree',
      data: treeData.value,
      initialTreeDepth: -1,
      top: '10%',
      left: '15%',
      bottom: '10%',
      right: '25%',
      symbolSize: (_val: unknown, params: { data: TreeData }) => {
        const data = params.data
        return data.isProposed ? 18 : 14
      },
      symbol: 'circle',
      label: {
        position: 'left',
        verticalAlign: 'middle',
        align: 'right',
        fontSize: 14,
        distance: 10,
        color: isDark.value ? '#f8fafc' : '#1e293b',
        fontFamily: "'LXGW WenKai Screen', 'LXGW WenKai', sans-serif",
        rich: {
          proposed: {
            color: '#10b981',
            fontWeight: 'bold',
            fontSize: 15,
            padding: [4, 8],
            borderRadius: 4,
            backgroundColor: isDark.value ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.1)',
          },
          delete: {
            color: isDark.value ? '#ef4444' : '#dc2626',
            textBorderColor: 'transparent',
            textDecoration: 'line-through',
            opacity: 0.6,
            padding: [2, 4],
          },
          normal: {
            padding: [2, 4],
          },
          root: {
            color: isDark.value ? '#fbbf24' : '#d97706',
            fontWeight: 'bold',
            fontSize: 16,
            padding: [6, 10],
            backgroundColor: isDark.value ? 'rgba(251, 191, 36, 0.1)' : 'rgba(217, 119, 6, 0.05)',
            borderRadius: 6,
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
        },
      },
      expandAndCollapse: true,
      animationDuration: 550,
      animationDurationUpdate: 750,
      lineStyle: {
        color: isDark.value ? '#475569' : '#cbd5e1',
        width: 2,
        curveness: 0.5,
      },
    },
  ],
}))
</script>

<template>
  <div ref="containerRef" class="flex-1 min-h-0 relative w-full h-full overflow-hidden">
    <VChart
      ref="vChartRef"
      class="w-full h-full"
      :option="chartOptions"
      :autoresize="true"
      :theme="isDark ? 'dark' : undefined"
    />
    <div
      v-if="treeData.length === 0"
      class="absolute inset-0 flex flex-col items-center justify-center animate-in fade-in zoom-in-95 duration-1000 ease-out"
    >
      <div
        class="mb-6 flex items-center justify-center w-20 h-20 rounded-full bg-primary/5 border border-primary/10"
      >
        <Clover :size="32" :stroke-width="1.5" class="text-primary/40" />
      </div>
      <div class="text-center space-y-1.5 px-6">
        <h3 class="text-lg font-medium tracking-tight text-foreground/60">
          {{ t('todo.emptyPending') }}
        </h3>
        <p class="text-sm text-muted-foreground/40 max-w-[240px] mx-auto leading-relaxed">
          {{ t('todo.emptyPendingDescription') }}
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
:deep(.echarts) {
  width: 100% !important;
  height: 100% !important;
}
</style>
