<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ArrowDown, Sparkles } from 'lucide-vue-next'
import { useWindowSize } from '@vueuse/core'
import ChatMessage from './ChatMessage.vue'
import ChatSuggestions from './ChatSuggestions.vue'
import type { ChatMessage as ChatMessageType } from '@/composables/useChat'
import { useSmartScroll } from '@/composables/useSmartScroll'
import { useChatHistory } from '@/composables/useChatHistory'

const props = defineProps<{
  messages: ChatMessageType[]
  isMaximized?: boolean
}>()

const emit = defineEmits<{
  (e: 'regenerate', id: string): void
  (e: 'edit', id: string, content: string): void
  (e: 'select-suggestion', text: string, options?: { requireTodo?: boolean }): void
}>()

const { t } = useI18n()
const { currentSessionId } = useChatHistory()

// 是否正在切换会话（用于跳过冗余动画）
const isSwitchingSession = ref(false)

const containerRef = ref<HTMLElement | null>(null)
const { width: windowWidth } = useWindowSize()
const isMobile = computed(() => windowWidth.value < 640)

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

// 监听会话 ID 变化
watch(currentSessionId, () => {
  isSwitchingSession.value = true
  // 切换会话时，立即滚动到底部，不使用平滑滚动以提升响应感
  void nextTick(() => {
    scrollToBottom('instant')
    // 短暂延迟后恢复动画标记
    setTimeout(() => {
      isSwitchingSession.value = false
    }, 100)
  })
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
    } else if (isSwitchingSession.value) {
      // 切换会话中，已经在 currentSessionId 的 watch 中处理了
      return
    } else if (isNewMessage && oldMessages && oldMessages.length > 0) {
      // 仅当新消息到达时（如用户发送消息），执行平滑滚动到底部
      void nextTick(() => {
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
    <div ref="containerRef" :class="['h-full overflow-y-auto', isMobile ? 'px-3' : 'px-4']">
      <div :class="['flex min-h-full w-full flex-col', isMaximized ? 'mx-auto max-w-4xl' : '']">
        <!-- 空状态 -->
        <div
          v-if="messages.length === 0"
          :class="[
            'flex flex-1 flex-col items-center justify-center p-4 text-center',
            isMobile ? 'pb-10' : 'pb-20',
          ]"
        >
          <div :class="['relative', isMobile ? 'mb-4' : 'mb-8']">
            <div class="absolute -inset-4 animate-pulse rounded-full bg-primary/5 blur-2xl"></div>
            <div
              :class="[
                'relative flex items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 shadow-inner',
                isMobile ? 'h-16 w-16' : 'h-20 w-20',
              ]"
            >
              <Sparkles :class="[isMobile ? 'h-8 w-8' : 'h-10 w-10', 'text-primary']" />
            </div>
          </div>

          <h2
            :class="[
              'font-bold tracking-tight text-foreground',
              isMobile ? 'mb-2 text-xl' : 'mb-3 text-2xl',
            ]"
          >
            {{ t('ai.welcomeTitle') }}
          </h2>
          <p :class="['max-w-md text-muted-foreground', isMobile ? 'mb-6 text-sm' : 'mb-10']">
            {{ t('ai.welcomeSubtitle') }}
          </p>

          <ChatSuggestions @select="(text, options) => emit('select-suggestion', text, options)" />
        </div>

        <!-- 消息列表 -->
        <div v-else :class="[isMobile ? 'py-2' : 'py-4']">
          <Transition name="session-fade" mode="out-in">
            <div :key="currentSessionId || 'empty'">
              <TransitionGroup
                name="message-list"
                tag="div"
                :class="[isMobile ? 'space-y-3' : 'space-y-4']"
              >
                <ChatMessage
                  v-for="(msg, index) in messages"
                  :key="msg.id"
                  :message="msg"
                  :is-last="index === messages.length - 1"
                  @regenerate="(id) => emit('regenerate', id)"
                  @edit="(content) => emit('edit', msg.id, content)"
                />
              </TransitionGroup>
            </div>
          </Transition>
        </div>
      </div>
    </div>

    <!-- 返回底部按钮 -->
    <Transition name="fade">
      <button
        v-if="isUserScrolledUp && isScrollable"
        :class="[
          'absolute flex items-center justify-center rounded-full border border-border bg-card/80 text-primary shadow-lg backdrop-blur-sm transition-all hover:bg-card hover:shadow-xl active:scale-95 z-20',
          isMobile ? 'bottom-4 h-9 w-9' : 'bottom-6 h-10 w-10',
          isMaximized ? 'left-1/2 -translate-x-1/2' : isMobile ? 'right-4' : 'right-8',
        ]"
        :title="t('ai.scrollToBottom')"
        @click="enableAutoScroll"
      >
        <ArrowDown :size="isMobile ? 18 : 20" />
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
  transition: all 0.3s cubic-bezier(0.2, 0, 0, 1);
}

.message-list-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.message-list-leave-to {
  opacity: 0;
  transform: scale(0.98);
}

/* 会话切换时的整体淡入淡出 */
.session-fade-enter-active {
  transition: opacity 0.2s ease-out;
}

.session-fade-leave-active {
  transition: opacity 0.1s ease-in;
}

.session-fade-enter-from,
.session-fade-leave-to {
  opacity: 0;
}

.fade-enter-active,
.fade-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
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
