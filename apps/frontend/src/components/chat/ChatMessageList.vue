<script setup lang="ts">
import { ref, watch, nextTick, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ArrowDown } from 'lucide-vue-next'
import ChatMessage from './ChatMessage.vue'
import type { ChatMessage as ChatMessageType } from '@/composables/useChat'
import { useSmartScroll } from '@/composables/useSmartScroll'

const props = defineProps<{
  messages: ChatMessageType[]
}>()

const emit = defineEmits<{
  (e: 'regenerate'): void
}>()

const { t } = useI18n()

const containerRef = ref<HTMLElement | null>(null)

// 使用智能滚动 Composable
const {
  isSticking,
  isUserScrolledUp,
  scrollToBottom,
  streamingScroll,
  setStreamingMode,
  enableAutoScroll,
} = useSmartScroll({
  scrollContainer: containerRef,
  atBottomThreshold: 50,
  streamingInstant: true,
})

// 监听消息变化
watch(
  () => props.messages,
  (newMessages, oldMessages) => {
    const lastMsg = newMessages[newMessages.length - 1]
    const isStreaming = lastMsg?.isStreaming
    const isNewMessage = newMessages.length > (oldMessages?.length || 0)

    // 更新流式模式状态
    setStreamingMode(!!isStreaming)

    if (isStreaming) {
      // 正在流式输出时，使用专门的高频滚动处理
      streamingScroll()
    } else if (isNewMessage && oldMessages && oldMessages.length > 0) {
      // 仅当新消息到达时（如用户发送消息），执行平滑滚动到底部
      nextTick(() => {
        scrollToBottom('smooth')
      })
    }
    // 注意：当 isStreaming 从 true 变为 false 时，不再触发额外的滚动
    // 因为 streamingScroll 已经保证了在输出过程中始终贴合底部
  },
  { deep: true },
)

// 暴露方法给父组件
defineExpose({
  scrollToBottom: () => scrollToBottom('smooth'),
})
</script>

<template>
  <div class="relative flex-1 overflow-hidden">
    <div ref="containerRef" class="h-full overflow-y-auto px-4">
      <!-- 空状态 -->
      <div
        v-if="messages.length === 0"
        class="flex h-full items-center justify-center text-[#c4c0b8]"
      >
        <p class="text-sm">{{ t('ai.startChat') }}</p>
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

    <!-- 返回底部按钮 -->
    <Transition name="fade">
      <button
        v-if="isUserScrolledUp"
        class="absolute bottom-6 right-8 flex h-10 w-10 items-center justify-center rounded-full border border-[hsl(var(--ai-message-border))] bg-white/80 text-[hsl(var(--primary-color))] shadow-lg backdrop-blur-sm transition-all hover:bg-white hover:shadow-xl active:scale-95 dark:bg-zinc-800/80 dark:hover:bg-zinc-800"
        title="返回底部"
        @click="enableAutoScroll"
      >
        <ArrowDown :size="20" />
        <span
          v-if="isSticking === false && messages[messages.length - 1]?.isStreaming"
          class="absolute -right-1 -top-1 flex h-3 w-3"
        >
          <span
            class="absolute inline-flex h-full w-full animate-ping rounded-full bg-[hsl(var(--primary-color))] opacity-75"
          ></span>
          <span
            class="relative inline-flex h-3 w-3 rounded-full bg-[hsl(var(--primary-color))]"
          ></span>
        </span>
      </button>
    </Transition>
  </div>
</template>

<style scoped>
.message-list-enter-active,
.message-list-leave-active,
.message-list-move {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.message-list-enter-from,
.message-list-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

.fade-enter-active,
.fade-leave-active {
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
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
