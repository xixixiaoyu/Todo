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
import ChatVisualizerPreview from '@/features/todo/components/ChatVisualizerPreview.vue'
import ChatMessageLoading from './ChatMessageLoading.vue'
import ChatMessageImages from './ChatMessageImages.vue'
import ChatMessageMarkdown from './ChatMessageMarkdown.vue'
import ChatMessageUser from './ChatMessageUser.vue'
import TeachingQuizPanel from './TeachingQuizPanel.vue'

import { useEscClose } from '@/composables/useEscClose'

const props = defineProps<{
  message: ChatMessage
  isLast?: boolean
  isPrevTool?: boolean
  isNextTool?: boolean
}>()

const emit = defineEmits<{
  (e: 'regenerate', id: string): void
  (e: 'edit', content: string): void
  (e: 'ask-selection', prompt: string): void
  (
    e: 'teaching-submit',
    payload: { quizId: string; kind: TeachingQuizKind; answer: string | string[] },
  ): void
}>()

const { t } = useI18n()
const { width: windowWidth } = useWindowSize()
const isMobile = computed(() => windowWidth.value < 640)

// 图片预览
const previewImageUrl = ref<string | null>(null)
const isPreviewOpen = computed(() => !!previewImageUrl.value)

const openImage = (url: string) => {
  previewImageUrl.value = url
}
const closePreview = () => {
  previewImageUrl.value = null
}

// 使用公共 Composable 处理图片预览的 ESC 关闭
useEscClose(isPreviewOpen, closePreview)

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

// 是否正在生成图片
const isImageGenerating = computed(() => {
  return props.message.role === 'assistant' && props.message.content === t('ai.generatingImage')
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

      <!-- 思考过程（AI 消息） -->
      <ChatMessageThinking
        v-if="hasThinking && !isUser"
        :message="message"
        :is-streaming="isStreaming"
        :has-content="hasContent"
      />

      <!-- 主消息气泡 / 加载状态 -->
      <Transition
        enter-active-class="transition duration-200 cubic-bezier(0.2, 0, 0, 1)"
        enter-from-class="transform translate-y-1.5 opacity-0"
        enter-to-class="transform translate-y-0 opacity-100"
      >
        <template v-if="isUser || hasContent || (isStreaming && !hasThinking)">
          <!-- 加载状态 -->
          <ChatMessageLoading
            v-if="!isUser && !hasContent && isStreaming && !hasThinking && !hasDiscussion"
            :is-image-generating="isImageGenerating"
          />

          <!-- 正文气泡：用户消息或已有内容的 AI 消息 -->
          <div
            v-else-if="isUser || hasContent"
            class="selectable relative select-text break-words transition-all duration-300"
            :class="[
              isUser || message.role !== 'tool'
                ? 'rounded-[1.25rem] px-4 py-3'
                : 'rounded-none p-0',
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
                  <!-- AI 消息：Markdown 渲染 -->
                  <ChatMessageMarkdown
                    ref="markdownRef"
                    :content="message.content"
                    :is-streaming="isStreaming"
                    :is-mobile="isMobile"
                    @ask-selection="(prompt) => emit('ask-selection', prompt)"
                  />
                </template>

                <TeachingQuizPanel
                  v-if="message.teachingQuizzes && message.teachingQuizzes.length > 0"
                  :quizzes="message.teachingQuizzes"
                  :disabled="isStreaming"
                  @submit="(payload) => emit('teaching-submit', payload)"
                />

                <!-- AI 建议的思维导图预览 -->
                <ChatVisualizerPreview
                  v-if="message.todoActions && message.todoActions.length > 0"
                  :actions="message.todoActions"
                  :message-id="message.id"
                  :processed-status="message.todoActionsProcessed"
                />
              </template>

              <!-- 操作按钮（AI 消息内部） -->
              <ChatMessageActions
                v-if="!isUser && !isStreaming && hasContent && message.role !== 'tool'"
                :content="message.content"
                @regenerate="emit('regenerate', message.id)"
              />
            </template>
          </div>
        </template>
      </Transition>
    </div>

    <!-- 图片全屏预览 -->
    <ChatMessageImagePreview :url="previewImageUrl" @close="closePreview" />
  </div>
</template>
