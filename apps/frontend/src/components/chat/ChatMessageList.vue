<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ArrowDown, Sparkles, MessageSquare, Lightbulb, Zap } from 'lucide-vue-next'
import ChatMessage from './ChatMessage.vue'
import type { ChatMessage as ChatMessageType } from '@/composables/useChat'
import { useSmartScroll } from '@/composables/useSmartScroll'

const props = defineProps<{
  messages: ChatMessageType[]
  isMaximized?: boolean
}>()

const emit = defineEmits<{
  (e: 'regenerate'): void
  (e: 'edit', id: string, content: string): void
  (e: 'select-suggestion', text: string, options?: { requireTodo?: boolean }): void
}>()

const { t } = useI18n()

// 建议选项
const suggestions = computed(() => [
  {
    icon: Lightbulb,
    text: t('ai.suggestion1'),
    color: 'text-yellow-500',
    bg: 'bg-yellow-500/10',
    requireTodo: true,
  },
  {
    icon: Zap,
    text: t('ai.suggestion2'),
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
    requireTodo: true,
  },
  {
    icon: MessageSquare,
    text: t('ai.suggestion3'),
    color: 'text-green-500',
    bg: 'bg-green-500/10',
    requireTodo: true,
  },
])

const containerRef = ref<HTMLElement | null>(null)

// 使用智能滚动 Composable
const {
  isSticking,
  isUserScrolledUp,
  isScrollable,
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
    } else if (!isStreaming && oldMessages?.[oldMessages.length - 1]?.isStreaming) {
      // 当流式结束时，确保执行最后一次滚动检查
      // 延迟一小段时间以等待 Markdown 最终渲染和布局稳定
      setTimeout(() => {
        if (isSticking.value) {
          scrollToBottom('smooth')
        }
      }, 100)
    }
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
      <div :class="['flex min-h-full w-full flex-col', isMaximized ? 'mx-auto max-w-4xl' : '']">
        <!-- 空状态 -->
        <div
          v-if="messages.length === 0"
          class="flex flex-1 flex-col items-center justify-center p-4 pb-20 text-center"
        >
          <div class="relative mb-8">
            <div class="absolute -inset-4 animate-pulse rounded-full bg-primary/5 blur-2xl"></div>
            <div
              class="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 shadow-inner"
            >
              <Sparkles class="h-10 w-10 text-primary" />
            </div>
          </div>

          <h2 class="mb-3 text-2xl font-bold tracking-tight text-foreground">
            {{ t('ai.welcomeTitle') }}
          </h2>
          <p class="mb-10 max-w-md text-muted-foreground">
            {{ t('ai.welcomeSubtitle') }}
          </p>

          <div class="grid w-full max-w-2xl gap-4 sm:grid-cols-3">
            <button
              v-for="item in suggestions"
              :key="item.text"
              class="group flex flex-col items-start rounded-2xl border border-border bg-card p-5 text-left transition-all hover:border-primary/30 hover:bg-primary/5 hover:shadow-md active:scale-[0.98]"
              @click="emit('select-suggestion', item.text, { requireTodo: item.requireTodo })"
            >
              <div
                :class="[
                  'mb-3 flex h-10 w-10 items-center justify-center rounded-xl transition-colors group-hover:bg-white/50 dark:group-hover:bg-black/20',
                  item.bg,
                ]"
              >
                <component :is="item.icon" :class="['h-5 w-5', item.color]" />
              </div>
              <p class="text-sm font-medium leading-relaxed text-foreground/80">
                {{ item.text }}
              </p>
            </button>
          </div>
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
              @edit="(content) => emit('edit', msg.id, content)"
            />
          </TransitionGroup>
        </div>
      </div>
    </div>

    <!-- 返回底部按钮 -->
    <Transition name="fade">
      <button
        v-if="isUserScrolledUp && isScrollable"
        :class="[
          'absolute bottom-6 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card/80 text-primary shadow-lg backdrop-blur-sm transition-all hover:bg-card hover:shadow-xl active:scale-95 z-20',
          isMaximized ? 'left-1/2 -translate-x-1/2' : 'right-8',
        ]"
        :title="t('ai.scrollToBottom')"
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
  transition: all 0.4s cubic-bezier(0.22, 1, 0.36, 1);
}

.message-list-enter-from {
  opacity: 0;
}

.message-list-leave-to {
  opacity: 0;
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
