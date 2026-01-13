<script setup lang="ts">
import { computed, ref } from 'vue'
import { Clover } from 'lucide-vue-next'
import type { CallbackDataParams } from 'echarts/types/dist/shared'
import VChart from 'vue-echarts'
import { useTodoStore } from '../stores/todo'
import { useTheme } from '@/composables/useTheme'
import { useI18n } from 'vue-i18n'

const todoStore = useTodoStore()
const { theme } = useTheme()
const isDark = computed(() => theme.value === 'dark')
const { t } = useI18n()

const vChartRef = ref<InstanceType<typeof VChart> | null>(null)
const containerRef = ref<HTMLElement | null>(null)

interface TreeData {
  name: string
  id?: string
  completed?: boolean
  children?: TreeData[]
  itemStyle?: {
    color?: string
    borderColor?: string
  }
}

/**
 * 将扁平化的待办事项转换为树形结构（仅展示待完成）
 */
const treeData = computed(() => {
  const todoMap = new Map<string, TreeData>()
  const roots: TreeData[] = []

  // 仅处理未完成的任务
  const pendingTodos = todoStore.todos.filter((t) => !t.completed)

  // 首先创建所有节点
  pendingTodos.forEach((todo) => {
    todoMap.set(todo.id, {
      name: todo.title,
      id: todo.id,
      completed: todo.completed,
      children: [],
      itemStyle: {
        color: isDark.value ? '#94a3b8' : '#64748b',
        borderColor: isDark.value ? '#64748b' : '#475569',
      },
    })
  })

  // 建立父子关系
  pendingTodos.forEach((todo) => {
    const node = todoMap.get(todo.id)!
    // 只有当父节点也在未完成列表中时，才建立父子关系
    if (todo.parentId && todoMap.has(todo.parentId)) {
      todoMap.get(todo.parentId)!.children?.push(node)
    } else {
      roots.push(node)
    }
  })

  // 如果没有未完成任务，返回空
  if (roots.length === 0) {
    return []
  }

  // 如果有多个根节点，创建一个虚拟根节点
  if (roots.length > 1) {
    return [
      {
        name: t('todo.pending'), // 使用“待完成”作为虚拟根节点名称
        children: roots,
        itemStyle: {
          color: isDark.value ? '#fbbf24' : '#d97706',
          borderColor: isDark.value ? '#d97706' : '#b45309',
        },
      },
    ]
  }

  return roots
})

const chartOptions = computed(() => ({
  tooltip: {
    trigger: 'item',
    triggerOn: 'mousemove',
    formatter: (params: CallbackDataParams) => {
      const data = params.data as TreeData
      if (!data.id) return data.name // 虚拟根节点
      return `${data.name}<br/><span style="color: #64748b">${t('todo.pending')}</span>`
    },
    backgroundColor: isDark.value ? '#1e293b' : '#ffffff',
    borderColor: isDark.value ? '#334155' : '#e2e8f0',
    textStyle: {
      color: isDark.value ? '#f1f5f9' : '#1e293b',
    },
  },
  series: [
    {
      type: 'tree',
      data: treeData.value,
      initialTreeDepth: -1,
      top: '5%',
      left: '10%',
      bottom: '5%',
      right: '20%',
      symbolSize: 12,
      label: {
        position: 'left',
        verticalAlign: 'middle',
        align: 'right',
        fontSize: 14,
        color: isDark.value ? '#e2e8f0' : '#1e293b',
        fontFamily: 'LXGW WenKai, sans-serif',
      },
      leaves: {
        label: {
          position: 'right',
          align: 'left',
        },
      },
      emphasis: {
        focus: 'descendant',
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
      class="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-4"
    >
      <div class="p-4 rounded-full bg-muted/30">
        <Clover :size="48" class="text-muted-foreground/40" />
      </div>
      <p class="text-lg font-medium">{{ t('todo.emptyPending') }}</p>
    </div>
  </div>
</template>

<style scoped>
:deep(.echarts) {
  width: 100% !important;
  height: 100% !important;
}
</style>
