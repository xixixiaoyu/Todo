<script setup lang="ts">
import { computed, ref, watch, onMounted, nextTick, toRef, onBeforeUnmount } from 'vue'
import VChart from 'vue-echarts'
import { useDark, useResizeObserver } from '@vueuse/core'
import { Check, X, Maximize2, Minimize2, Move } from 'lucide-vue-next'
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
  if (props.messageId) {
    todoStore.setProposedChanges(props.messageId, props.actions)
    await todoStore.applyProposedChanges(props.messageId)
  } else {
    await todoStore.applyProposedChanges()
  }
  isApplying.value = false
  isApplied.value = true
  updateMessageStatus('applied')
}

function handleDiscard() {
  isDiscarding.value = true
  if (props.messageId) {
    todoStore.setProposedChanges(props.messageId, props.actions)
    todoStore.discardProposedChanges(props.messageId)
  } else {
    todoStore.discardProposedChanges()
  }
  isDiscarding.value = false
  isDiscarded.value = true
  updateMessageStatus('discarded')
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
