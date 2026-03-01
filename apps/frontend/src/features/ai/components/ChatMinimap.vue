<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useWindowSize } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import type { ChatMessage } from '@/features/ai/composables/useChat'

const props = defineProps<{
  messages: ChatMessage[]
  scrollContainer: HTMLElement | null
}>()

const { t } = useI18n()
const minimapRef = ref<HTMLElement | null>(null)
const { width: windowWidth } = useWindowSize()
const isMobile = computed(() => windowWidth.value < 640)

// 拖拽状态
const isDragging = ref(false)

// 悬浮状态
const hoveredBlockId = ref<string | null>(null)
const mousePos = ref({ x: 0, y: 0 })

// 获取当前悬浮的消息摘要
const hoveredSummary = computed(() => {
  if (!hoveredBlockId.value || isDragging.value) return null
  const msg = props.messages.find((m) => m.id === hoveredBlockId.value)
  if (!msg) return null

  // 提取摘要
  let summary = msg.content || ''
  if (msg.thinkingContent) {
    summary = `[${t('ai.thinking')}] ${summary}`
  }
  if (msg.tool_calls?.length) {
    summary = `[${t('ai.toolCalls')}] ${summary}`
  }

  return summary.length > 80 ? summary.slice(0, 80) + '...' : summary
})

// 处理鼠标移动以显示摘要或拖拽滚动
const handleMouseMove = (e: MouseEvent) => {
  mousePos.value = { x: e.clientX, y: e.clientY }

  if (isDragging.value && minimapRef.value && props.scrollContainer) {
    const rect = minimapRef.value.getBoundingClientRect()
    const clickY = e.clientY - rect.top
    const percent = Math.max(0, Math.min(1, clickY / rect.height))
    const container = props.scrollContainer
    const targetScrollTop = percent * container.scrollHeight
    container.scrollTop = targetScrollTop - container.clientHeight / 2
  }
}

const handleMouseEnterBlock = (id: string) => {
  if (!isDragging.value) {
    hoveredBlockId.value = id
  }
}

const handleMouseLeaveMinimap = () => {
  hoveredBlockId.value = null
  isDragging.value = false
}

const handleMouseDown = (e: MouseEvent) => {
  isDragging.value = true
  handleMouseMove(e) // 立即触发一次滚动

  // 全局监听 mouseup 以停止拖拽
  const handleGlobalMouseUp = () => {
    isDragging.value = false
    window.removeEventListener('mouseup', handleGlobalMouseUp)
  }
  window.addEventListener('mouseup', handleGlobalMouseUp)
}

// 滚动信息状态
const scrollInfo = ref({
  scrollTop: 0,
  scrollHeight: 0,
  clientHeight: 0,
})

const updateScrollInfo = () => {
  if (!props.scrollContainer) return
  const { scrollTop, scrollHeight, clientHeight } = props.scrollContainer
  scrollInfo.value = { scrollTop, scrollHeight, clientHeight }
}

// 根据消息元数据计算消息块
const messageBlocks = computed(() => {
  if (!props.messages.length) return []

  return props.messages.map((msg) => {
    let colorClass = 'bg-primary/20'
    let icon = null

    if (msg.role === 'user') {
      colorClass = 'bg-primary/60 dark:bg-primary/50 shadow-[0_0_8px_rgba(var(--primary-rgb),0.3)]'
    } else if (msg.role === 'assistant') {
      colorClass = 'bg-muted-foreground/30 dark:bg-white/10'
    } else if (msg.role === 'tool') {
      colorClass = 'bg-amber-500/50'
    }

    // 根据内容长度或特征估算相对高度
    let weight = 1
    if (msg.content) {
      weight = Math.max(1, Math.min(15, Math.ceil(msg.content.length / 250)))
    }
    if (msg.thinkingContent) weight += 1.5
    if (msg.tool_calls?.length) {
      weight += 1
      icon = 'tool'
    }
    if (msg.images?.length) {
      weight += 2.5
      icon = 'image'
    }
    if (msg.todoActions?.length) {
      weight += 1.5
      icon = 'todo'
    }

    return {
      id: msg.id,
      role: msg.role,
      colorClass,
      weight,
      icon,
    }
  })
})

// 视口高亮样式
const viewportStyle = computed(() => {
  const { scrollTop, scrollHeight, clientHeight } = scrollInfo.value
  if (!scrollHeight || !minimapRef.value) return { top: '0%', height: '0%' }

  const top = (scrollTop / scrollHeight) * 100
  const height = (clientHeight / scrollHeight) * 100

  return {
    top: `${top}%`,
    height: `${height}%`,
  }
})

// 监听滚动容器尺寸变化
let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  if (props.scrollContainer) {
    props.scrollContainer.addEventListener('scroll', updateScrollInfo, { passive: true })

    resizeObserver = new ResizeObserver(() => {
      updateScrollInfo()
    })
    resizeObserver.observe(props.scrollContainer)

    // 同时也监听内容的尺寸变化
    const content = props.scrollContainer.firstElementChild
    if (content) resizeObserver.observe(content)

    updateScrollInfo()
  }
})

onUnmounted(() => {
  if (props.scrollContainer) {
    props.scrollContainer.removeEventListener('scroll', updateScrollInfo)
  }
  if (resizeObserver) {
    resizeObserver.disconnect()
  }
})

// 消息变化时更新
watch(
  () => props.messages.length,
  () => {
    void nextTick(() => {
      setTimeout(updateScrollInfo, 100)
    })
  },
)

// 深度监听最后一条消息的内容（流式输出时）
watch(
  () => props.messages[props.messages.length - 1]?.content,
  () => {
    updateScrollInfo()
  },
)
</script>

<template>
  <div
    v-if="!isMobile && messages.length > 1"
    ref="minimapRef"
    class="relative w-2.5 hover:w-4.5 h-full bg-black/[0.03] dark:bg-white/[0.03] border-l border-border/10 select-none group/minimap hover:bg-black/[0.06] dark:hover:bg-white/[0.06] transition-all duration-300 ease-in-out overflow-visible z-20 mr-1.5 rounded-r-xl"
    :class="isDragging ? 'cursor-grabbing' : 'cursor-pointer'"
    @mousedown="handleMouseDown"
    @mousemove="handleMouseMove"
    @mouseleave="handleMouseLeaveMinimap"
  >
    <!-- 轨道背景增强 -->
    <div
      class="absolute inset-y-0 left-0 w-[1px] bg-gradient-to-b from-transparent via-border/30 to-transparent group-hover/minimap:via-border/50 transition-all duration-300"
    ></div>

    <!-- 消息块容器 (常驻但保持优雅的透明度) -->
    <div
      class="absolute inset-0 px-[1.5px] py-[4px] flex flex-col gap-[2px] opacity-40 group-hover/minimap:opacity-100 transition-opacity duration-300"
    >
      <div
        v-for="block in messageBlocks"
        :key="block.id"
        class="relative w-full rounded-[1px] transition-all duration-300"
        :class="[
          block.colorClass,
          hoveredBlockId === block.id
            ? 'opacity-100 scale-x-110 translate-x-[-1px] shadow-lg'
            : 'opacity-80',
        ]"
        :style="{ flex: block.weight }"
        @mouseenter="handleMouseEnterBlock(block.id)"
      >
        <!-- 特殊内容标识 -->
        <div
          v-if="block.icon"
          class="absolute inset-0 flex items-center justify-center opacity-0 group-hover/minimap:opacity-100 transition-opacity duration-300"
        >
          <div class="w-[1.5px] h-[1.5px] rounded-full bg-white/60"></div>
        </div>
      </div>
    </div>

    <!-- 视口高亮 (更明确的位置反馈) -->
    <div
      class="absolute left-[-2.5px] right-[-2.5px] z-10 pointer-events-none transition-[top,height] duration-200 ease-out"
      :style="viewportStyle"
    >
      <div
        class="h-full w-full rounded-md border border-primary/30 group-hover/minimap:border-primary/60 bg-primary/5 group-hover/minimap:bg-primary/15 backdrop-blur-[2px] transition-all duration-300 relative overflow-hidden shadow-[0_2px_8px_rgba(var(--primary-rgb),0.1)]"
      >
        <!-- 侧边光感指示线 (加粗并增强亮度) -->
        <div
          class="absolute inset-y-0 left-0 w-[2px] bg-primary/60 group-hover/minimap:w-[3px] group-hover/minimap:bg-primary rounded-l-md transition-all duration-300 shadow-[0_0_10px_rgba(var(--primary-rgb),0.4)] group-hover/minimap:shadow-[2px_0_12px_rgba(var(--primary-rgb),0.7)]"
        ></div>
        <!-- 中心微光线 -->
        <div
          class="absolute top-1/2 left-0 right-0 h-[0.5px] bg-primary/40 opacity-0 group-hover/minimap:opacity-100 transition-opacity duration-300"
        ></div>
      </div>
    </div>

    <!-- 浮动摘要 (高级悬浮卡片) -->
    <Transition name="fade-fast">
      <div
        v-if="hoveredSummary"
        class="absolute right-full mr-4 z-[300] pointer-events-none px-4 py-3 rounded-[20px] bg-card/98 backdrop-blur-3xl border border-border/40 shadow-[0_12px_40px_rgba(0,0,0,0.2)] text-xs text-foreground w-max max-w-[300px] break-words animate-in fade-in slide-in-from-right-2 duration-300"
        :style="{
          top: `${mousePos.y - (minimapRef?.getBoundingClientRect().top || 0) - 28}px`,
        }"
      >
        <div class="flex flex-col gap-2">
          <!-- 角色标签与状态 -->
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div
                class="w-1.5 h-1.5 rounded-full"
                :class="
                  hoveredBlockId && messages.find((m) => m.id === hoveredBlockId)?.role === 'user'
                    ? 'bg-primary'
                    : 'bg-muted-foreground/40'
                "
              ></div>
              <span class="opacity-40 font-bold uppercase tracking-[0.1em] text-[9px]">
                {{
                  hoveredBlockId && messages.find((m) => m.id === hoveredBlockId)?.role === 'user'
                    ? 'User'
                    : 'Assistant'
                }}
              </span>
            </div>
            <!-- 时间或状态标记 (如果有) -->
          </div>

          <!-- 内容预览 -->
          <div class="line-clamp-6 leading-[1.6] text-[13px] font-medium text-foreground/90">
            {{ hoveredSummary }}
          </div>
        </div>

        <!-- 装饰性小角 -->
        <div
          class="absolute right-[-5px] top-[26px] w-2.5 h-2.5 bg-card/98 border-r border-t border-border/40 rotate-45 rounded-sm"
        ></div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* 确保 flex 布局正常工作 */
.flex-col > * {
  min-height: 2px;
}

.fade-fast-enter-active,
.fade-fast-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}

.fade-fast-enter-from,
.fade-fast-leave-to {
  opacity: 0;
  transform: translateX(10px) scale(0.95);
}
</style>
