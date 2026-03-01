<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ArrowDown, Sparkles } from 'lucide-vue-next'
import { useWindowSize } from '@vueuse/core'
import ChatMessage from './ChatMessage.vue'
import ChatSuggestions from './ChatSuggestions.vue'
import ChatMinimap from './ChatMinimap.vue'
import type { ChatMessage as ChatMessageType } from '@/features/ai/composables/useChat'
import { useSmartScroll } from '@/composables/useSmartScroll'
import { useChatHistory } from '@/features/ai/composables/useChatHistory'

const props = defineProps<{
  messages: ChatMessageType[]
  isMaximized?: boolean
}>()

const emit = defineEmits<{
  (e: 'regenerate', id: string): void
  (e: 'delete', id: string): void
  (e: 'edit', id: string, content: string): void
  (e: 'select-suggestion', text: string, options?: { requireTodo?: boolean }): void
  (e: 'ask-selection', prompt: string): void
  (e: 'transfer-selection'): void
  (e: 'teaching-submit', payload: { quizId: string; kind: string; answer: string | string[] }): void
  (
    e: 'teaching-submit-batch',
    payload: Array<{ quizId: string; kind: string; answer: string | string[] }>,
  ): void
}>()

const { t } = useI18n()
const { currentSessionId } = useChatHistory()

// 是否正在切换会话（用于跳过冗余动画）
const isSwitchingSession = ref(false)

const containerRef = ref<HTMLElement | null>(null)
const { width: windowWidth } = useWindowSize()
const isMobile = computed(() => windowWidth.value < 640)

const DEFAULT_WINDOW_SIZE = 200
const WINDOW_STEP = 200
const renderLimit = ref(DEFAULT_WINDOW_SIZE)

const windowStartIndex = computed(() => Math.max(0, props.messages.length - renderLimit.value))
const visibleMessages = computed(() => props.messages.slice(windowStartIndex.value))
const hiddenCount = computed(() =>
  Math.max(0, props.messages.length - visibleMessages.value.length),
)

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
  renderLimit.value = DEFAULT_WINDOW_SIZE
  // 切换会话时，立即滚动到底部，不使用平滑滚动以提升响应感
  void nextTick(() => {
    scrollToBottom('instant')
    // 短暂延迟后恢复动画标记
    setTimeout(() => {
      isSwitchingSession.value = false
    }, 100)
  })
})

async function revealOlderMessages(step = WINDOW_STEP) {
  if (!containerRef.value) {
    renderLimit.value += step
    return
  }
  if (hiddenCount.value <= 0) return

  const container = containerRef.value
  const prevScrollHeight = container.scrollHeight
  const prevScrollTop = container.scrollTop

  renderLimit.value += step
  await nextTick()

  const nextScrollHeight = container.scrollHeight
  const delta = nextScrollHeight - prevScrollHeight
  container.scrollTop = prevScrollTop + (delta > 0 ? delta : 0)
}

function handleScroll() {
  if (!containerRef.value) return
  if (isSwitchingSession.value) return
  if (hiddenCount.value <= 0) return
  if (containerRef.value.scrollTop > 200) return
  void revealOlderMessages()
}

// 监听消息变化
watch(
  () => props.messages.length,
  (newLen, oldLen) => {
    const isNewMessage = newLen > (oldLen || 0)
    if (isNewMessage) {
      const lastMsg = props.messages[newLen - 1]
      setStreamingMode(!!lastMsg?.isStreaming)

      void nextTick(() => {
        scrollToBottom(lastMsg?.isStreaming ? 'instant' : 'smooth')
      })
    }
  },
)

// 专门监听最后一条消息的流式状态
watch(
  () => props.messages[props.messages.length - 1]?.isStreaming,
  (isStreaming) => {
    setStreamingMode(!!isStreaming)
    if (isStreaming) {
      streamingScroll()
    } else if (props.messages.length > 0) {
      // 流式结束，确保最后一次平滑滚动
      setTimeout(() => {
        if (isSticking.value) {
          scrollToBottom('smooth')
        }
      }, 100)
    }
  },
)

// 专门监听流式消息的内容变化以触发滚动
watch(
  () => props.messages[props.messages.length - 1]?.content,
  (newContent, oldContent) => {
    const lastMsg = props.messages[props.messages.length - 1]
    if (lastMsg?.isStreaming && newContent !== oldContent) {
      streamingScroll()
    }
  },
)

// 暴露方法给父组件
defineExpose({
  scrollToBottom: () => scrollToBottom('smooth'),
})
</script>

<template>
  <div class="relative flex-1 overflow-hidden flex flex-row">
    <div
      ref="containerRef"
      :class="[
        'flex-1 h-full overflow-y-auto overscroll-contain scroll-smooth-gpu',
        isMobile ? 'px-3' : 'px-4',
      ]"
      @scroll.passive="handleScroll"
    >
      <div
        :class="['flex min-h-full w-full flex-col', isMaximized ? 'mx-auto max-w-4xl' : '']"
        style="overflow-anchor: none"
      >
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
        <div v-else :class="[isMobile ? 'py-2' : 'pt-6 pb-4']">
          <Transition name="session-fade" mode="out-in">
            <div :key="currentSessionId || 'empty'">
              <div v-if="hiddenCount > 0" class="flex justify-center pb-2">
                <button
                  type="button"
                  data-test="load-older"
                  class="rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-background"
                  @click="revealOlderMessages()"
                >
                  {{ t('common.loadMore') }}
                </button>
              </div>
              <TransitionGroup name="message-list" tag="div" class="flex flex-col">
                <ChatMessage
                  v-for="(msg, index) in visibleMessages"
                  :key="msg.id"
                  :message="msg"
                  :is-last="index + windowStartIndex === messages.length - 1"
                  :is-prev-tool="
                    index + windowStartIndex > 0 &&
                    messages[index + windowStartIndex - 1].role === 'tool'
                  "
                  :is-next-tool="
                    index + windowStartIndex < messages.length - 1 &&
                    messages[index + windowStartIndex + 1].role === 'tool'
                  "
                  @regenerate="(id) => emit('regenerate', id)"
                  @delete="(id) => emit('delete', id)"
                  @edit="(content) => emit('edit', msg.id, content)"
                  @ask-selection="(prompt) => emit('ask-selection', prompt)"
                  @transfer-selection="() => emit('transfer-selection')"
                  @teaching-submit="(payload) => emit('teaching-submit', payload)"
                  @teaching-submit-batch="(payload) => emit('teaching-submit-batch', payload)"
                />
              </TransitionGroup>
            </div>
          </Transition>
        </div>
      </div>
    </div>

    <ChatMinimap :messages="messages" :scroll-container="containerRef" />

    <!-- 返回底部按钮 -->
    <Transition name="fade">
      <button
        v-if="isUserScrolledUp && isScrollable"
        :class="[
          'absolute flex items-center justify-center rounded-full border border-border bg-card text-primary shadow-lg transition-all hover:bg-card hover:shadow-xl active:scale-95 z-20',
          isMobile ? 'bottom-4 h-9 w-9' : 'bottom-6 h-10 w-10',
          isMaximized ? 'left-1/2 -translate-x-1/2' : isMobile ? 'right-4' : 'right-8',
        ]"
        :title="t('ai.scrollToBottom')"
        @click="enableAutoScroll"
      >
        <ArrowDown :size="isMobile ? 18 : 20" />
        <span
          v-if="isSticking === false && messages[messages.length - 1]?.isStreaming"
          class="absolute -top-1 -right-1 flex h-4 w-4"
        >
          <span
            class="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"
          ></span>
          <span class="relative inline-flex h-4 w-4 rounded-full bg-primary"></span>
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
  transition: transform 0.3s cubic-bezier(0.23, 1, 0.32, 1);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

/* 极致纯净滚动条：平时隐形，滚动时极细显现 */
.overflow-y-auto {
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
  transition: scrollbar-color 0.3s;
}

.overflow-y-auto:hover {
  scrollbar-color: hsl(var(--muted-foreground) / 0.1) transparent;
}

.overflow-y-auto::-webkit-scrollbar {
  width: 4px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: transparent;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background: transparent;
  border-radius: 10px;
  transition: background 0.3s;
}

.overflow-y-auto:hover::-webkit-scrollbar-thumb {
  background: hsl(var(--muted-foreground) / 0.15);
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background: hsl(var(--muted-foreground) / 0.3) !important;
}
</style>
