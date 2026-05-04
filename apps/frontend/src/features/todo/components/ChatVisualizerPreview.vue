<script setup lang="ts">
import { computed, ref, watch, onMounted, nextTick, toRef, onBeforeUnmount } from 'vue'
import VChart from 'vue-echarts'
import { useDark, useResizeObserver } from '@vueuse/core'
import { Check, X, Maximize2, Minimize2, Move, AlertCircle } from 'lucide-vue-next'
import AiLuminaIcon from '@/features/ai/components/AiLuminaIcon.vue'
import type { ProposedTodoChange } from '@/features/todo/stores/todo'
import { useTodoStore } from '@/features/todo/stores/todo'
import type { TreeData } from '@/features/todo/stores/todo.types'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useChatHistory } from '@/features/ai/composables/useChatHistory'
import { useProposedTreeData } from '../composables/useProposedTreeData'
import { debounce } from 'lodash-es'

const props = defineProps<{
  actions: ProposedTodoChange[]
  messageId?: string
  processedStatus?: 'applied' | 'discarded'
  parseError?: boolean
}>()

const todoStore = useTodoStore()
const { updateSessionMessages, currentSession } = useChatHistory()
const isDark = useDark()
const { t } = useI18n()

const { treeData } = useProposedTreeData(toRef(props, 'actions'), isDark)

const isExpanded = ref(false)
const isApplying = ref(false)
const isDiscarding = ref(false)
const isApplied = ref(props.processedStatus === 'applied')
const isDiscarded = ref(props.processedStatus === 'discarded')
const isReady = ref(false)
const containerRef = ref<HTMLElement | null>(null)
const vChartRef = ref<InstanceType<typeof VChart> | null>(null)
const showActionList = ref(false)

const selectedActionIds = ref<Set<string>>(new Set())

// 初始化/重置全选
function initSelection() {
  selectedActionIds.value = new Set(props.actions.map((a) => a.id))
}

watch(
  () => props.actions,
  () => {
    initSelection()
  },
  { immediate: true },
)

const allSelected = computed(() => {
  if (props.actions.length === 0) return false
  return props.actions.every((a) => selectedActionIds.value.has(a.id))
})

const selectedCount = computed(() => selectedActionIds.value.size)

function toggleSelectAll() {
  if (allSelected.value) {
    selectedActionIds.value = new Set()
  } else {
    selectedActionIds.value = new Set(props.actions.map((a) => a.id))
  }
}

function toggleAction(id: string) {
  const next = new Set(selectedActionIds.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  selectedActionIds.value = next
}

// 使用 ResizeObserver 确保容器尺寸就绪后再初始化图表，并添加防抖优化性能
const debouncedResize = debounce(() => {
  vChartRef.value?.resize()
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
    if (containerRef.value && containerRef.value.clientWidth > 0) {
      isReady.value = true
    } else {
      let attempts = 0
      const retry = () => {
        if (attempts > 20) return
        if (containerRef.value && containerRef.value.clientWidth > 0) {
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
  const counts: Record<string, number> = { add: 0, update: 0, delete: 0, toggle: 0, pin: 0 }
  props.actions.forEach((a) => {
    if (a.type in counts) {
      counts[a.type]++
    }
  })
  return counts
})

const hasChanges = computed(
  () => props.actions.length > 0 && !isApplied.value && !isDiscarded.value,
)

function actionLabel(type: string): string {
  const key = `todo.actionType.${type}` as const
  return (t(key) as string) || type
}

async function handleApply() {
  if (isApplying.value || isDiscarding.value) return
  isApplying.value = true
  try {
    if (props.messageId) {
      todoStore.setProposedChanges(props.messageId, props.actions)
      await todoStore.applyProposedChanges(props.messageId, selectedActionIds.value)
    } else {
      await todoStore.applyProposedChanges(undefined, selectedActionIds.value)
    }
    isApplied.value = true
    updateMessageStatus('applied')
  } catch (err) {
    console.error('Failed to apply proposed changes:', err)
  } finally {
    isApplying.value = false
  }
}

function handleDiscard() {
  if (isApplying.value || isDiscarding.value) return
  isDiscarding.value = true
  try {
    if (props.messageId) {
      todoStore.setProposedChanges(props.messageId, props.actions)
      todoStore.discardProposedChanges(props.messageId)
    } else {
      todoStore.discardProposedChanges()
    }
    isDiscarded.value = true
    updateMessageStatus('discarded')
  } finally {
    isDiscarding.value = false
  }
}

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
      roam: true,
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
  <!-- 解析错误状态 -->
  <div
    v-if="parseError"
    class="mt-4 mb-2 overflow-hidden rounded-2xl border border-destructive/20 bg-destructive/[0.03] shadow-sm"
  >
    <div class="flex items-center gap-3 px-3 py-3">
      <div
        class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive"
      >
        <AlertCircle :size="16" />
      </div>
      <p class="text-xs text-muted-foreground leading-relaxed">
        {{ t('ai.todoParseError') }}
      </p>
    </div>
  </div>

  <!-- 正常状态 -->
  <div
    v-else
    class="mt-4 mb-2 overflow-hidden rounded-2xl border border-primary/10 bg-primary/[0.03] shadow-sm transition-all duration-300 hover:shadow-md group/preview"
    :class="isExpanded ? 'ring-2 ring-primary/20' : ''"
  >
    <!-- Header Summary -->
    <div
      class="flex items-center justify-between border-b border-primary/5 bg-primary/[0.02] px-3 py-2"
    >
      <div class="flex items-center gap-3">
        <div class="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <AiLuminaIcon :size="14" class="animate-pulse" />
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

      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            class="h-7 w-7 rounded-md text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
            @click="isExpanded = !isExpanded"
          >
            <Minimize2 v-if="isExpanded" :size="14" />
            <Maximize2 v-else :size="14" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">
          {{ isExpanded ? t('common.collapse') : t('common.expand') }}
        </TooltipContent>
      </Tooltip>
    </div>

    <!-- Visualizer Area -->
    <div
      ref="containerRef"
      class="relative w-full transition-all duration-500 ease-in-out"
      :style="{ height: isExpanded ? '480px' : '280px' }"
    >
      <VChart v-if="isReady" ref="vChartRef" :option="chartOptions" autoresize />

      <!-- Interaction Hint -->
      <div
        v-if="hasChanges && !isApplied && !isDiscarded"
        class="absolute top-2 left-1/2 -translate-x-1/2 pointer-events-none opacity-0 group-hover/preview:opacity-100 transition-opacity duration-500"
      >
        <div
          class="flex items-center gap-1.5 px-2 py-1 rounded-full bg-background/80 border border-primary/10 text-[9px] text-muted-foreground shadow-sm"
        >
          <Move :size="10" />
          <span>{{ t('ai.dragToMove') }}</span>
        </div>
      </div>

      <!-- Empty State / Success State -->
      <div
        v-if="!hasChanges"
        class="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/80 text-muted-foreground animate-in fade-in duration-500"
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
          <AiLuminaIcon :size="32" />
          <span class="text-xs">{{ t('ai.noChangesProposed') }}</span>
        </div>
      </div>
    </div>

    <!-- 可折叠勾选列表 -->
    <div v-if="hasChanges" class="border-t border-primary/5 bg-primary/[0.01]">
      <!-- Toggle行动列表 -->
      <button
        type="button"
        class="flex w-full items-center justify-between px-3 py-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        @click="showActionList = !showActionList"
      >
        <span class="font-medium">
          {{ showActionList ? t('todo.hideActionDetails') : t('todo.showActionDetails') }}
          ({{ props.actions.length }})
        </span>
      </button>

      <!-- 勾选列表 -->
      <div v-if="showActionList" class="px-3 pb-2 space-y-1 max-h-48 overflow-y-auto">
        <!-- 全选/取消全选 -->
        <label
          class="flex items-center gap-2 py-0.5 text-[11px] font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
        >
          <input
            type="checkbox"
            :checked="allSelected"
            class="h-3.5 w-3.5 rounded border-primary/30 text-primary focus:ring-primary/30 cursor-pointer"
            @change="toggleSelectAll"
          />
          <span>{{ allSelected ? t('todo.deselectAll') : t('todo.selectAll') }}</span>
        </label>

        <!-- 逐条勾选 -->
        <label
          v-for="action in actions"
          :key="action.id"
          class="flex items-center gap-2 py-0.5 text-[11px] cursor-pointer hover:bg-primary/[0.04] rounded px-1 -mx-1 transition-colors"
        >
          <input
            type="checkbox"
            :checked="selectedActionIds.has(action.id)"
            class="h-3.5 w-3.5 rounded border-primary/30 text-primary focus:ring-primary/30 cursor-pointer"
            @change="toggleAction(action.id)"
          />
          <span
            class="text-[9px] px-1 rounded-sm font-bold shrink-0"
            :class="{
              'bg-success/20 text-success': action.type === 'add',
              'bg-primary/20 text-primary': action.type === 'update' || action.type === 'toggle',
              'bg-destructive/20 text-destructive': action.type === 'delete',
              'bg-yellow-500/20 text-yellow-600': action.type === 'pin',
            }"
          >
            {{ actionLabel(action.type) }}
          </span>
          <span class="truncate text-muted-foreground">
            {{ action.data.title || action.data.id }}
          </span>
        </label>
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
        :disabled="isApplying || isDiscarding || selectedCount === 0"
        @click="handleApply"
      >
        <Check v-if="!isApplying" :size="14" stroke-width="3" />
        <span
          v-else
          class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white"
        ></span>
        {{ t('todo.applySelected', { n: selectedCount }) }}
      </Button>
    </div>
  </div>
</template>
