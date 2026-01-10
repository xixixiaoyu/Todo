<script setup lang="ts">
import { ref, watch, nextTick, onMounted } from 'vue'
import ChatMessage from './ChatMessage.vue'
import type { ChatMessage as ChatMessageType } from '@/composables/useChat'

const props = defineProps<{
  messages: ChatMessageType[]
}>()

const emit = defineEmits<{
  (e: 'regenerate'): void
}>()

const containerRef = ref<HTMLElement>()

// 是否用户正在手动滚动
const isUserScrolling = ref(false)
let scrollTimeout: ReturnType<typeof setTimeout> | null = null

/**
 * 滚动到底部
 */
function scrollToBottom(instant = false) {
  if (!containerRef.value || isUserScrolling.value) return

  nextTick(() => {
    if (containerRef.value) {
      containerRef.value.scrollTo({
        top: containerRef.value.scrollHeight,
        behavior: instant ? 'auto' : 'smooth',
      })
    }
  })
}

/**
 * 检测是否在底部
 */
function isAtBottom(): boolean {
  if (!containerRef.value) return true
  const { scrollTop, scrollHeight, clientHeight } = containerRef.value
  return scrollHeight - scrollTop - clientHeight < 48
}

/**
 * 处理滚动事件
 */
function handleScroll() {
  // 如果用户向上滚动，标记为手动滚动
  if (!isAtBottom()) {
    isUserScrolling.value = true
  } else {
    isUserScrolling.value = false
  }

  // 重置滚动超时
  if (scrollTimeout) clearTimeout(scrollTimeout)
  scrollTimeout = setTimeout(() => {
    if (isAtBottom()) {
      isUserScrolling.value = false
    }
  }, 150)
}

// 监听消息变化，自动滚动到底部
watch(
  () => props.messages,
  () => {
    // 流式更新时使用瞬时滚动
    const lastMsg = props.messages[props.messages.length - 1]
    const isStreaming = lastMsg?.isStreaming
    scrollToBottom(isStreaming)
  },
  { deep: true },
)

// 初始化时滚动到底部
onMounted(() => {
  scrollToBottom(true)
})

// 暴露方法给父组件
defineExpose({
  scrollToBottom,
})
</script>

<template>
  <div ref="containerRef" class="flex-1 overflow-y-auto px-4" @scroll="handleScroll">
    <!-- 空状态 -->
    <div
      v-if="messages.length === 0"
      class="flex h-full items-center justify-center text-[#c4c0b8]"
    >
      <p class="text-sm">开始与 AI 助手对话...</p>
    </div>

    <!-- 消息列表 -->
    <div v-else class="py-4">
      <TransitionGroup name="message-list" tag="div" class="space-y-4">
        <ChatMessage
          v-for="(msg, index) in messages"
          :key="msg.id"
          :message="msg"
          :is-last="index === messages.length - 1"
          @regenerate="emit('regenerate')"
        />
      </TransitionGroup>
    </div>
  </div>
</template>

<style scoped>
.message-list-enter-active,
.message-list-leave-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.message-list-enter-from {
  opacity: 0;
  transform: translateY(20px) scale(0.95);
}

.message-list-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

/* 隐藏滚动条但保留功能 */
.overflow-y-auto {
  scrollbar-width: thin;
  scrollbar-color: hsl(var(--ai-message-border)) transparent;
}

.overflow-y-auto::-webkit-scrollbar {
  width: 5px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: transparent;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background-color: hsl(var(--ai-message-border));
  border-radius: 20px;
}
</style>
