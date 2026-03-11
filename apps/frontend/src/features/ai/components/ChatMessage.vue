<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useWindowSize } from '@vueuse/core'
import type { ChatMessage } from '@/features/ai/composables/useChat'
import type { TeachingQuizKind } from '@/features/ai/services/aiService'
import ImageLoadingState from './ImageLoadingState.vue'
import ChatMessageDiscussion from './ChatMessageDiscussion.vue'
import ChatMessageThinking from './ChatMessageThinking.vue'
import ChatMessageTool from './ChatMessageTool.vue'
import ChatMessageActions from './ChatMessageActions.vue'
import ChatMessageImagePreview from './ChatMessageImagePreview.vue'
import ChatMessageStructuredBlockWarning from './ChatMessageStructuredBlockWarning.vue'
import ChatVisualizerPreview from '@/features/todo/components/ChatVisualizerPreview.vue'
import ChatMessageLoading from './ChatMessageLoading.vue'
import ChatMessageImages from './ChatMessageImages.vue'
import ChatMessageMarkdown from './ChatMessageMarkdown.vue'
import ChatMessageUser from './ChatMessageUser.vue'
import TeachingQuizPanel from './TeachingQuizPanel.vue'
import { useChatMessageImagePreview } from '@/features/ai/composables/useChatMessageImagePreview'

const props = defineProps<{
  message: ChatMessage
  isLast?: boolean
  isPrevTool?: boolean
  isNextTool?: boolean
}>()

const emit = defineEmits<{
  (e: 'regenerate', id: string): void
  (e: 'delete', id: string): void
  (e: 'edit', content: string): void
  (e: 'ask-selection', prompt: string): void
  (e: 'transfer-selection'): void
  (
    e: 'teaching-submit',
    payload: { quizId: string; kind: TeachingQuizKind; answer: string | string[] },
  ): void
  (
    e: 'teaching-submit-batch',
    payload: Array<{ quizId: string; kind: TeachingQuizKind; answer: string | string[] }>,
  ): void
}>()

const { t } = useI18n()
const { width: windowWidth } = useWindowSize()
const isMobile = computed(() => windowWidth.value < 640)

const { previewImageUrl, openImage, closePreview } = useChatMessageImagePreview()

// 编辑状态
const isEditing = ref(false)

// 开启编辑
function startEdit() {
  if (!isUser.value) return
  isEditing.value = true
}

// 取消编辑
function cancelEdit() {
  isEditing.value = false
}

// 保存编辑
function saveEdit(content: string) {
  const trimmed = content.trim()
  if (trimmed) {
    emit('edit', trimmed)
  }
  isEditing.value = false
}

const isUser = computed(() => props.message.role === 'user')
const isStreaming = computed(() => !!props.message.isStreaming)
const hasThinking = computed(
  () => !!props.message.thinkingContent || !!props.message.reasoning_details,
)
const hasContent = computed(() => !!props.message.content)
const hasDiscussion = computed(
  () => !isUser.value && props.message.discussionSteps && props.message.discussionSteps.length > 0,
)
const auxiliaryPanelStage = computed<'none' | 'loading' | 'thinking'>(() => {
  if (isUser.value) return 'none'
  if (hasThinking.value) return 'thinking'
  if (!hasContent.value && isStreaming.value && !hasDiscussion.value) return 'loading'
  return 'none'
})
const showMessageBubble = computed(() => isUser.value || hasContent.value)

// 是否正在生成图片
const isImageGenerating = computed(() => {
  return props.message.role === 'assistant' && props.message.content === t('ai.generatingImage')
})

const showStructuredBlockWarning = computed(() => {
  return (
    props.message.role === 'assistant' &&
    !isUser.value &&
    !isStreaming.value &&
    !!props.message.structuredBlockErrors &&
    props.message.structuredBlockErrors.length > 0
  )
})
const pendingStructuredBlocks = computed(() => props.message.pendingStructuredBlocks || [])
const isTeachingQuizPending = computed(() => {
  if (!isStreaming.value) return false
  if (props.message.teachingQuizzes && props.message.teachingQuizzes.length > 0) return false
  return pendingStructuredBlocks.value.includes('teaching_quiz')
})
const isTodoActionsPending = computed(() => {
  if (!isStreaming.value) return false
  if (props.message.todoActions && props.message.todoActions.length > 0) return false
  return pendingStructuredBlocks.value.includes('todo_actions')
})

const markdownRef = ref<InstanceType<typeof ChatMessageMarkdown>>()

defineExpose({
  initCodeInteractions: (container: HTMLElement) =>
    markdownRef.value?.initCodeInteractions(container),
  injectInteractions: () => markdownRef.value?.injectInteractions(),
})
</script>

<template>
  <div
    :class="[
      'flex',
      isMobile
        ? message.role === 'tool'
          ? 'py-0'
          : 'py-2'
        : message.role === 'tool'
          ? 'py-0'
          : 'py-3',
      isUser ? 'justify-end' : 'justify-start',
    ]"
  >
    <!-- 消息内容 -->
    <div
      :class="[
        isMobile ? 'max-w-[92%]' : 'max-w-[85%]',
        message.role === 'tool' ? 'space-y-0' : 'space-y-2',
      ]"
    >
      <!-- 多模型讨论过程 -->
      <ChatMessageDiscussion v-if="hasDiscussion" :steps="message.discussionSteps" />

      <Transition
        mode="out-in"
        enter-active-class="transition duration-180 ease-out"
        enter-from-class="transform translate-y-1 opacity-0"
        enter-to-class="transform translate-y-0 opacity-100"
        leave-active-class="transition duration-140 ease-in"
        leave-from-class="transform translate-y-0 opacity-100"
        leave-to-class="transform -translate-y-1 opacity-0"
      >
        <!-- 思考过程（AI 消息） -->
        <ChatMessageThinking
          v-if="auxiliaryPanelStage === 'thinking'"
          :message="message"
          :is-streaming="isStreaming"
          :has-content="hasContent"
        />
        <ChatMessageLoading
          v-else-if="auxiliaryPanelStage === 'loading'"
          :is-image-generating="isImageGenerating"
        />
      </Transition>

      <Transition
        enter-active-class="transition duration-200 cubic-bezier(0.2, 0, 0, 1)"
        enter-from-class="transform translate-y-1.5 opacity-0"
        enter-to-class="transform translate-y-0 opacity-100"
      >
        <!-- 正文气泡：用户消息或已有内容的 AI 消息 -->
        <div
          v-if="showMessageBubble"
          class="selectable relative select-text break-words transition-all duration-300"
          :class="[
            isUser || message.role !== 'tool' ? 'rounded-[1.25rem] px-4 py-3' : 'rounded-none p-0',
            isUser
              ? 'bg-gradient-to-br from-primary/95 via-primary to-primary/90 text-primary-foreground shadow-[0_4px_12px_hsl(var(--primary)_/_0.15)]'
              : message.role === 'tool'
                ? 'border-none bg-transparent shadow-none'
                : 'border border-[hsl(var(--ai-message-border))] bg-[hsl(var(--ai-message-bg))] text-foreground shadow-sm',
            isEditing
              ? 'w-full !bg-card !text-foreground ring-2 ring-primary/20 border-primary'
              : '',
            isImageGenerating ? 'p-0 border-none bg-transparent shadow-none' : '',
          ]"
        >
          <!-- 正在生成图片时显示精致加载状态 -->
          <ImageLoadingState v-if="isImageGenerating" />

          <template v-else>
            <!-- 图片内容 -->
            <ChatMessageImages
              v-if="message.images && message.images.length > 0"
              :images="message.images"
              :is-user="isUser"
              :is-mobile="isMobile"
              @open-image="openImage"
            />

            <!-- 用户消息 -->
            <ChatMessageUser
              v-if="isUser"
              :content="message.content"
              :is-editing="isEditing"
              :is-mobile="isMobile"
              @save="saveEdit"
              @cancel="cancelEdit"
              @start-edit="startEdit"
            />

            <!-- AI 消息内容 -->
            <template v-else>
              <!-- MCP Tool Result -->
              <ChatMessageTool
                v-if="message.role === 'tool'"
                :message="message"
                :is-prev-tool="isPrevTool"
                :is-next-tool="isNextTool"
              />

              <template v-else>
                <ChatMessageStructuredBlockWarning
                  v-if="showStructuredBlockWarning"
                  :message-id="message.id"
                  :errors="message.structuredBlockErrors || []"
                />

                <!-- AI 消息：Markdown 渲染 -->
                <ChatMessageMarkdown
                  ref="markdownRef"
                  :content="message.content"
                  :is-streaming="isStreaming"
                  :is-mobile="isMobile"
                  @ask-selection="(prompt) => emit('ask-selection', prompt)"
                  @transfer-selection="() => emit('transfer-selection')"
                />
              </template>

              <TeachingQuizPanel
                v-if="message.teachingQuizzes && message.teachingQuizzes.length > 0"
                :quizzes="message.teachingQuizzes"
                :disabled="isStreaming"
                @submit="(payload) => emit('teaching-submit', payload)"
                @submit-batch="(payload) => emit('teaching-submit-batch', payload)"
              />
              <div
                v-else-if="isTeachingQuizPending"
                data-test="teaching-quiz-loading"
                class="group relative mt-3 overflow-hidden rounded-2xl border border-ai-message-border/80 bg-gradient-to-br from-background/50 via-ai-message-bg/70 to-ai-message-bg/60 p-3 text-xs text-muted-foreground backdrop-blur-md"
              >
                <div
                  class="structured-skeleton-sheen pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-primary/10 to-transparent [background-size:200%_100%]"
                ></div>
                <div class="relative flex items-center gap-2.5">
                  <span class="relative flex h-2 w-2">
                    <span
                      class="structured-skeleton-dot-halo absolute inline-flex h-full w-full rounded-full bg-primary/35"
                    ></span>
                    <span class="relative inline-flex h-2 w-2 rounded-full bg-primary/80"></span>
                  </span>
                  <span class="font-medium text-foreground/80">{{
                    t('ai.teachingQuizGenerating')
                  }}</span>
                </div>
                <div class="relative mt-2.5 space-y-2">
                  <div
                    class="structured-skeleton-line h-2 w-[82%] rounded-full bg-foreground/10"
                  ></div>
                  <div
                    class="structured-skeleton-line structured-skeleton-line-alt h-2 w-[66%] rounded-full bg-foreground/10"
                  ></div>
                </div>
              </div>

              <!-- AI 建议的思维导图预览 -->
              <ChatVisualizerPreview
                v-if="message.todoActions && message.todoActions.length > 0"
                :actions="message.todoActions"
                :message-id="message.id"
                :processed-status="message.todoActionsProcessed"
              />
              <div
                v-else-if="isTodoActionsPending"
                data-test="todo-actions-loading"
                class="group relative mt-3 overflow-hidden rounded-2xl border border-ai-message-border/80 bg-gradient-to-br from-background/50 via-ai-message-bg/70 to-ai-message-bg/60 p-3 text-xs text-muted-foreground backdrop-blur-md"
              >
                <div
                  class="structured-skeleton-sheen pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-primary/10 to-transparent [background-size:200%_100%]"
                ></div>
                <div class="relative flex items-center gap-2.5">
                  <span class="relative flex h-2 w-2">
                    <span
                      class="structured-skeleton-dot-halo absolute inline-flex h-full w-full rounded-full bg-primary/35"
                    ></span>
                    <span class="relative inline-flex h-2 w-2 rounded-full bg-primary/80"></span>
                  </span>
                  <span class="font-medium text-foreground/80">{{
                    t('ai.todoVisualizationGenerating')
                  }}</span>
                </div>
                <div class="relative mt-2.5 space-y-2">
                  <div
                    class="structured-skeleton-line h-2 w-[84%] rounded-full bg-foreground/10"
                  ></div>
                  <div
                    class="structured-skeleton-line structured-skeleton-line-alt h-2 w-[58%] rounded-full bg-foreground/10"
                  ></div>
                </div>
              </div>
            </template>

            <!-- 操作按钮（AI 消息内部） -->
            <ChatMessageActions
              v-if="!isUser && !isStreaming && hasContent && message.role !== 'tool'"
              :content="message.content"
              @regenerate="emit('regenerate', message.id)"
              @delete="emit('delete', message.id)"
            />
          </template>
        </div>
      </Transition>
    </div>

    <!-- 图片全屏预览 -->
    <ChatMessageImagePreview :url="previewImageUrl" @close="closePreview" />
  </div>
</template>

<style scoped>
.structured-skeleton-sheen {
  animation: structured-skeleton-sheen 2.2s cubic-bezier(0.55, 0.08, 0.92, 0.28) infinite;
}

.structured-skeleton-dot-halo {
  animation: structured-skeleton-dot-halo 1.8s cubic-bezier(0.5, 0.02, 0.88, 0.32) infinite;
}

.structured-skeleton-line {
  animation: structured-skeleton-line 1.9s cubic-bezier(0.5, 0.02, 0.88, 0.32) infinite;
}

.structured-skeleton-line-alt {
  animation-delay: 0.16s;
}

@keyframes structured-skeleton-sheen {
  0% {
    background-position: 120% 0;
    opacity: 0.22;
  }
  100% {
    background-position: -120% 0;
    opacity: 0.06;
  }
}

@keyframes structured-skeleton-dot-halo {
  0% {
    transform: scale(0.72);
    opacity: 0.72;
  }
  100% {
    transform: scale(1.75);
    opacity: 0;
  }
}

@keyframes structured-skeleton-line {
  0% {
    opacity: 0.7;
    transform: scaleX(0.985);
  }
  100% {
    opacity: 0.28;
    transform: scaleX(1);
  }
}
</style>
