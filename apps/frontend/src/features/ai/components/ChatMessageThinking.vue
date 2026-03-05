<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronUp } from 'lucide-vue-next'
import { useWindowSize } from '@vueuse/core'
import type { ChatMessage } from '@/features/ai/composables/useChat'
import { useMarkdown } from '@/composables/useMarkdown'

const props = defineProps<{
  message: ChatMessage
  isStreaming: boolean
  hasContent: boolean
}>()

const { t } = useI18n()
const { renderMarkdown } = useMarkdown()

const { width: windowWidth } = useWindowSize()
const isMobile = computed(() => windowWidth.value < 640)

const isExpanded = ref(props.isStreaming && !props.hasContent)
const contentHeight = ref(0)
const thinkingContentRef = ref<HTMLDivElement>()
const renderedThinkingHtml = ref('')

const thinkingStatus = computed(() => {
  if (props.isStreaming && !props.hasContent) {
    if (props.message.discussionSteps?.length) {
      const currentStep = props.message.discussionSteps.find((s) => s.status === 'thinking')
      if (currentStep) {
        return t('ai.discussionStatus')
      }
      return t('ai.finalSynthesizing')
    }
    return t('ai.isThinking')
  }
  return t('ai.thoughtProcess')
})

const thinkingHeight = computed(() => {
  if (!isExpanded.value) return '0px'
  if (props.isStreaming && !props.hasContent) return 'none'
  return `${contentHeight.value}px`
})

const updateContentHeight = () => {
  if (thinkingContentRef.value) {
    const rawHeight = thinkingContentRef.value.scrollHeight
    contentHeight.value = Math.min(rawHeight, 260) + 16
  }
}

let autoCollapseTimer: ReturnType<typeof setTimeout> | null = null

async function updateRenderedContent() {
  const effectiveThinking = props.message.thinkingContent || props.message.reasoning_details
  if (effectiveThinking) {
    const isThinkingStreaming = props.isStreaming && !props.hasContent
    renderedThinkingHtml.value = await renderMarkdown(effectiveThinking, isThinkingStreaming)
    void nextTick(updateContentHeight)
  }
}

watch(
  [
    () => props.message.thinkingContent,
    () => props.message.reasoning_details,
    () => props.isStreaming,
    () => props.hasContent,
  ],
  async (
    [thinking, reasoning, streaming, hasContent],
    [oldThinking, oldReasoning, oldStreaming, oldHasContent],
  ) => {
    // 自动折叠逻辑
    if (isExpanded.value) {
      // 场景 A: AI 开始输出正文内容 -> 立即折叠
      const hasStartedResponding = hasContent && !oldHasContent
      // 场景 B: 只有思考内容，且流式结束 -> 触发 3s 延迟折叠
      const effectiveThinking = thinking || reasoning
      const oldEffectiveThinking = (oldThinking as string) || (oldReasoning as string)
      const hasFinishedThinkingOnly = !streaming && oldStreaming && effectiveThinking && !hasContent
      // 场景 C: 思考内容稳定（非流式状态下的重复触发）
      const isThinkingStable =
        !streaming && effectiveThinking === oldEffectiveThinking && effectiveThinking && !hasContent

      if (hasStartedResponding) {
        isExpanded.value = false
      } else if (hasFinishedThinkingOnly || isThinkingStable) {
        if (autoCollapseTimer) clearTimeout(autoCollapseTimer)
        autoCollapseTimer = setTimeout(() => {
          isExpanded.value = false
        }, 3000)
      }
    }
    await updateRenderedContent()
  },
  { immediate: true },
)

watch([() => props.message.thinkingContent, () => props.message.reasoning_details], () => {
  if (isExpanded.value && thinkingContentRef.value) {
    void nextTick(() => {
      const el = thinkingContentRef.value
      if (el) {
        el.scrollTop = el.scrollHeight
      }
    })
  }
})
</script>

<template>
  <div
    class="thinking-content group/thinking mb-2 overflow-hidden transition-all duration-300"
    :class="[
      isMobile
        ? 'rounded-[1.25rem] border-none bg-muted/20 backdrop-blur-sm'
        : 'rounded-xl border border-[hsl(var(--ai-message-border))] bg-[hsl(var(--ai-message-bg))] shadow-sm',
      isExpanded
        ? isMobile
          ? 'ring-1 ring-primary/10 bg-muted/30'
          : 'ring-1 ring-primary/10'
        : '',
    ]"
  >
    <div
      class="thinking-header flex items-center justify-between px-4 py-2.5 cursor-pointer select-none transition-colors hover:bg-primary/5 sm:px-3"
      :class="{ 'shimmer-thinking': isStreaming && !hasContent }"
      @click="isExpanded = !isExpanded"
    >
      <h4 class="flex items-center gap-2">
        <div
          class="ai-icon translate-y-[1.5px] text-primary/60 transition-transform duration-500 group-hover/thinking:scale-110"
          :class="{ 'animate-pulse-custom': isStreaming && !hasContent }"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z"
              fill="currentColor"
              class="ai-star"
            />
            <path
              d="M19 15L19.5 17L21.5 17.5L19.5 18L19 20L18.5 18L16.5 17.5L18.5 17L19 15Z"
              fill="currentColor"
              class="ai-sparkle animate-sparkle"
            />
            <path
              d="M5 6L5.5 7.5L7 8L5.5 8.5L5 10L4.5 8.5L3 8L4.5 7.5L5 6Z"
              fill="currentColor"
              class="ai-sparkle animate-sparkle [animation-delay:0.6s]"
            />
          </svg>
        </div>
        <span
          class="font-medium tracking-wide transition-all duration-300"
          :class="[
            isStreaming && !hasContent
              ? 'shimmer-text'
              : 'text-muted-foreground/50 group-hover/thinking:text-primary/70',
            isMobile ? 'text-[13px]' : 'text-[12px]',
          ]"
        >
          {{ thinkingStatus }}
        </span>
      </h4>
      <div class="flex items-center gap-1.5">
        <button
          class="flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-primary/10"
          @click.stop="isExpanded = !isExpanded"
        >
          <ChevronUp
            :size="14"
            class="text-muted-foreground/40 transition-transform duration-300"
            :class="{ 'rotate-180': !isExpanded }"
          />
        </button>
      </div>
    </div>
    <div
      class="thinking-body transition-all duration-500 ease-soft-spring overflow-hidden"
      :style="{ maxHeight: thinkingHeight }"
    >
      <div class="px-4 pb-3 pt-1 sm:px-4 sm:pb-3 sm:pt-1">
        <div
          ref="thinkingContentRef"
          class="thinking-text border-l-2 border-primary/10 pl-3.5"
          :class="{ 'border-primary/20': isMobile }"
        >
          <!-- eslint-disable vue/no-v-html -->
          <div
            v-if="renderedThinkingHtml"
            class="markdown-content thinking-markdown break-words text-muted-foreground/60 leading-relaxed"
            :class="[isMobile ? 'text-[13.5px]' : 'text-[12.5px]']"
            v-html="renderedThinkingHtml"
          />
          <!-- eslint-enable vue/no-v-html -->
          <div
            v-else
            class="selectable select-text break-words whitespace-pre-wrap text-muted-foreground/60 leading-relaxed"
            :class="[isMobile ? 'text-[13.5px]' : 'text-[12.5px]']"
          >
            {{ message.thinkingContent }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.thinking-text {
  max-height: 260px;
  overflow-y: auto;
  color: hsl(var(--text-secondary));
  font-family: var(--font-sans);
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.thinking-text::-webkit-scrollbar {
  display: none;
}

.thinking-body {
  transition: max-height 0.3s ease-in-out;
}

.thinking-markdown :deep(p) {
  margin: 0.5em 0;
}
.thinking-markdown :deep(ul),
.thinking-markdown :deep(ol) {
  margin: 0.5em 0;
  padding-left: 1.5em;
}
.thinking-markdown :deep(li) {
  margin: 0.2em 0;
}
.thinking-markdown :deep(code) {
  font-size: 0.9em;
  background-color: rgba(0, 0, 0, 0.05);
  padding: 0.1em 0.3em;
  border-radius: 3px;
}
</style>
