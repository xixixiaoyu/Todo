<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import VChart from 'vue-echarts'
import { useDark } from '@vueuse/core'
import { Sparkles, Check, X, Maximize2, Minimize2, Move } from 'lucide-vue-next'
import type { ProposedTodoChange } from '@/features/todo/stores/todo'
import { useTodoStore } from '@/features/todo/stores/todo'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { useChatHistory } from '@/composables/useChatHistory'

const props = defineProps<{
  actions: ProposedTodoChange[]
  messageId?: string
  processedStatus?: 'applied' | 'discarded'
}>()

const todoStore = useTodoStore()
const { updateSessionMessages, currentSession } = useChatHistory()
const isDark = useDark()
const { t } = useI18n()

const isExpanded = ref(false)
const isApplying = ref(false)
const isDiscarding = ref(false)
const isApplied = ref(props.processedStatus === 'applied')
const isDiscarded = ref(props.processedStatus === 'discarded')

// 响应式更新本地状态
watch(
  () => props.processedStatus,
  (newStatus) => {
    isApplied.value = newStatus === 'applied'
    isDiscarded.value = newStatus === 'discarded'
  },
)

/**
 * 更新聊天记录中的操作状态，确保持久化
 */
function updateMessageStatus(status: 'applied' | 'discarded') {
  if (!props.messageId || !currentSession.value) return

  const updatedMessages = currentSession.value.messages.map((msg) => {
    if (msg.id === props.messageId) {
      return { ...msg, todoActionsProcessed: status }
    }
    return msg
  })

  updateSessionMessages(currentSession.value.id, updatedMessages)
}

const stats = computed(() => {
  const counts = { add: 0, update: 0, delete: 0, toggle: 0, pin: 0 }
  props.actions.forEach((a) => {
    if (a.type in counts) {
      counts[a.type as keyof typeof counts]++
    }
  })
  return counts
})

const hasChanges = computed(
  () => props.actions.length > 0 && !isApplied.value && !isDiscarded.value,
)

async function handleApply() {
  isApplying.value = true
  await todoStore.applyProposedChanges()
  isApplying.value = false
  isApplied.value = true
  updateMessageStatus('applied')
}

function handleDiscard() {
  isDiscarding.value = true
  todoStore.discardProposedChanges()
  isDiscarding.value = false
  isDiscarded.value = true
  updateMessageStatus('discarded')
}

interface TreeData {
  name: string
  id?: string
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
 * 专门为 AI 建议生成的轻量级树形数据
 */
const treeData = computed(() => {
  const todoMap = new Map<string, TreeData>()
  const roots: TreeData[] = []

  // 1. 获取涉及到的所有原始任务 ID
  const involvedTodoIds = new Set<string>()
  props.actions.forEach((action) => {
    if (action.data.id) involvedTodoIds.add(action.data.id)
    if (action.data.parentId) involvedTodoIds.add(action.data.parentId)
  })

  // 2. 准备基础节点（从现有 todos 中提取相关的）
  const baseTodos = todoStore.todos.filter((t) => involvedTodoIds.has(t.id))

  baseTodos.forEach((todo) => {
    todoMap.set(todo.id, {
      name: todo.title,
      id: todo.id,
      children: [],
      itemStyle: {
        color: isDark.value ? '#cbd5e1' : '#64748b',
        borderColor: isDark.value ? '#94a3b8' : '#475569',
        borderWidth: 1,
      },
      label: {
        formatter: `{normal|${todo.title}}`,
      },
    })
  })

  // 3. 应用 AI 建议的变更
  props.actions.forEach((action) => {
    if (action.type === 'add') {
      const id = action.id || `new-${Math.random()}`
      const node: TreeData = {
        name: action.data.title || '',
        id,
        children: [],
        itemStyle: {
          color: isDark.value ? '#059669' : '#10b981',
          borderColor: isDark.value ? '#34d399' : '#059669',
          borderWidth: 2,
          shadowBlur: 8,
          shadowColor: 'rgba(16, 185, 129, 0.3)',
        },
        lineStyle: {
          color: isDark.value ? '#059669' : '#10b981',
          width: 2,
          type: 'dashed',
        },
        label: {
          formatter: `{proposed|✨ ${action.data.title}}`,
        },
      }
      todoMap.set(id, node)

      if (action.data.parentId && todoMap.has(action.data.parentId)) {
        todoMap.get(action.data.parentId)!.children?.push(node)
      } else {
        roots.push(node)
      }
    } else if (action.type === 'update' || action.type === 'toggle') {
      const node = todoMap.get(action.data.id!)
      if (node) {
        node.itemStyle = {
          ...node.itemStyle,
          color: isDark.value ? '#059669' : '#10b981',
          borderWidth: 2,
        }
        if (action.data.title) {
          node.name = action.data.title
          node.label = { formatter: `{proposed|✨ ${action.data.title}}` }
        }
      }
    } else if (action.type === 'pin') {
      const node = todoMap.get(action.data.id!)
      if (node) {
        node.itemStyle = {
          ...node.itemStyle,
          color: '#fbbf24',
          borderWidth: 2,
        }
        node.label = {
          formatter: `{pin|📌 ${node.name}}`,
        }
      }
    } else if (action.type === 'delete') {
      const node = todoMap.get(action.data.id!)
      if (node) {
        node.itemStyle = {
          ...node.itemStyle,
          color: isDark.value ? '#b91c1c' : '#ef4444',
          borderColor: isDark.value ? '#f87171' : '#dc2626',
          borderWidth: 1,
        }
        node.label = {
          formatter: `{delete|🗑️ ${node.name}}`,
        }
        node.lineStyle = {
          type: 'dotted',
          color: isDark.value ? '#b91c1c' : '#ef4444',
        }
      }
    }
  })

  // 4. 建立父子关系（对于非新增节点）
  baseTodos.forEach((todo) => {
    const node = todoMap.get(todo.id)!
    if (todo.parentId && todoMap.has(todo.parentId)) {
      // 避免重复添加
      if (!todoMap.get(todo.parentId)!.children?.includes(node)) {
        todoMap.get(todo.parentId)!.children?.push(node)
      }
    } else if (!roots.includes(node)) {
      // 只有当它确实是根节点且没被作为新增节点处理过时才加入 roots
      const isChildOfAny = Array.from(todoMap.values()).some((parent) =>
        parent.children?.includes(node),
      )
      if (!isChildOfAny) {
        roots.push(node)
      }
    }
  })

  if (roots.length === 0) return []

  // 虚拟根节点
  if (roots.length > 1) {
    return [
      {
        name: 'Changes Preview',
        children: roots,
        itemStyle: { color: '#fbbf24', borderWidth: 2 },
        label: { formatter: '{root|Changes Preview}' },
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
    formatter: (params: unknown) => {
      const p = params as { data: TreeData }
      return `<div class="px-2 py-1 text-xs font-sans">${p.data.name}</div>`
    },
    backgroundColor: isDark.value ? '#1e293b' : '#ffffff',
    borderColor: isDark.value ? '#334155' : '#e2e8f0',
    textStyle: { color: isDark.value ? '#f8fafc' : '#1e293b' },
  },
  series: [
    {
      type: 'tree',
      data: treeData.value,
      top: '5%',
      left: '10%',
      bottom: '5%',
      right: '25%',
      symbolSize: 8,
      initialTreeDepth: -1,
      roam: true, // 开启缩放和平移
      label: {
        position: 'left',
        verticalAlign: 'middle',
        align: 'right',
        fontSize: 11,
        fontFamily: "'LXGW WenKai Screen', 'LXGW WenKai', sans-serif",
        color: isDark.value ? '#f8fafc' : '#1e293b',
        rich: {
          proposed: { color: '#10b981', fontWeight: 'bold', padding: [2, 4] },
          delete: {
            color: '#ef4444',
            textDecoration: 'line-through',
            opacity: 0.6,
            padding: [2, 4],
          },
          pin: { color: '#fbbf24', fontWeight: 'bold', padding: [2, 4] },
          root: { color: '#fbbf24', fontWeight: 'bold', padding: [2, 4] },
          normal: { padding: [2, 4] },
        },
      },
      leaves: {
        label: {
          position: 'right',
          align: 'left',
          // 增加叶子节点的内边距，防止文字溢出
          padding: [0, 10, 0, 0],
        },
      },
      lineStyle: { curveness: 0.5, width: 1.5 },
      expandAndCollapse: false,
      animationDuration: 400,
    },
  ],
}))
</script>

<template>
  <div
    class="mt-4 mb-2 overflow-hidden rounded-2xl border border-primary/10 bg-primary/[0.03] backdrop-blur-md shadow-sm transition-all duration-300 hover:shadow-md group/preview"
    :class="isExpanded ? 'ring-2 ring-primary/20' : ''"
  >
    <!-- Header Summary -->
    <div
      class="flex items-center justify-between border-b border-primary/5 bg-primary/[0.02] px-3 py-2"
    >
      <div class="flex items-center gap-3">
        <div class="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Sparkles :size="14" class="animate-pulse" />
        </div>
        <div class="flex flex-col">
          <span class="text-[10px] font-bold uppercase tracking-wider text-primary/70">{{
            t('todo.proposedChangesTitle')
          }}</span>
          <div class="flex items-center gap-1.5 mt-0.5">
            <span
              v-if="stats.add > 0"
              class="text-[9px] px-1 rounded-sm bg-success/20 text-success font-bold"
              >+{{ stats.add }}</span
            >
            <span
              v-if="stats.update > 0 || stats.toggle > 0 || stats.pin > 0"
              class="text-[9px] px-1 rounded-sm bg-primary/20 text-primary font-bold"
              >~{{ stats.update + stats.toggle + stats.pin }}</span
            >
            <span
              v-if="stats.delete > 0"
              class="text-[9px] px-1 rounded-sm bg-destructive/20 text-destructive font-bold"
              >-{{ stats.delete }}</span
            >
          </div>
        </div>
      </div>

      <button
        class="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
        @click="isExpanded = !isExpanded"
      >
        <Minimize2 v-if="isExpanded" :size="14" />
        <Maximize2 v-else :size="14" />
      </button>
    </div>

    <!-- Visualizer Area -->
    <div
      class="relative w-full transition-all duration-500 ease-in-out"
      :style="{ height: isExpanded ? '480px' : '280px' }"
    >
      <VChart :option="chartOptions" autoresize />

      <!-- Interaction Hint -->
      <div
        v-if="hasChanges && !isApplied && !isDiscarded"
        class="absolute top-2 left-1/2 -translate-x-1/2 pointer-events-none opacity-0 group-hover/preview:opacity-100 transition-opacity duration-500"
      >
        <div
          class="flex items-center gap-1.5 px-2 py-1 rounded-full bg-background/50 backdrop-blur-md border border-primary/10 text-[9px] text-muted-foreground shadow-sm"
        >
          <Move :size="10" />
          <span>{{ t('ai.dragToMove') }}</span>
        </div>
      </div>

      <!-- Empty State / Success State -->
      <div
        v-if="!hasChanges"
        class="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/60 backdrop-blur-[2px] text-muted-foreground animate-in fade-in duration-500"
      >
        <div v-if="isApplied" class="flex flex-col items-center gap-3">
          <div
            class="flex h-12 w-12 items-center justify-center rounded-full bg-success/20 text-success shadow-lg shadow-success/10 scale-in duration-300"
          >
            <Check :size="24" stroke-width="3" />
          </div>
          <span class="text-sm font-bold text-success">{{
            t('todo.changesApplied', { count: props.actions.length })
          }}</span>
        </div>
        <div v-else-if="isDiscarded" class="flex flex-col items-center gap-3">
          <div
            class="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground/60 scale-in duration-300"
          >
            <X :size="24" stroke-width="2" />
          </div>
          <span class="text-sm font-medium">{{
            t('todo.changesDiscarded', { count: props.actions.length })
          }}</span>
        </div>
        <div v-else class="flex flex-col items-center gap-2 text-muted-foreground/40">
          <Sparkles :size="32" stroke-width="1" />
          <span class="text-xs">{{ t('ai.noChangesProposed') }}</span>
        </div>
      </div>
    </div>

    <!-- Quick Actions (Only if has changes) -->
    <div
      v-if="hasChanges"
      class="flex items-center justify-end gap-2 border-t border-primary/5 bg-primary/[0.01] px-3 py-2"
    >
      <Button
        variant="ghost"
        size="sm"
        class="h-9 gap-2 rounded-xl px-3 text-[12px] font-bold hover:bg-destructive/10 hover:text-destructive transition-all active:scale-95"
        :disabled="isApplying || isDiscarding"
        @click="handleDiscard"
      >
        <X v-if="!isDiscarding" :size="14" />
        <span
          v-else
          class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-destructive/30 border-t-destructive"
        ></span>
        {{ t('common.discard') }}
      </Button>
      <Button
        size="sm"
        class="h-9 gap-2 rounded-xl px-4 text-[12px] font-bold shadow-md shadow-primary/10 transition-all active:scale-95"
        :disabled="isApplying || isDiscarding"
        @click="handleApply"
      >
        <Check v-if="!isApplying" :size="14" stroke-width="3" />
        <span
          v-else
          class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white"
        ></span>
        {{ t('common.apply') }}
      </Button>
    </div>
  </div>
</template>
