<script setup lang="ts">
import { computed, ref, watch, nextTick, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Pencil } from 'lucide-vue-next'
import { useWindowSize } from '@vueuse/core'
import type { ChatMessage } from '@/features/ai/composables/useChat'
import { useMarkdown } from '@/composables/useMarkdown'
import ImageLoadingState from './ImageLoadingState.vue'
import ChatMessageDiscussion from './ChatMessageDiscussion.vue'
import ChatMessageThinking from './ChatMessageThinking.vue'
import ChatMessageTool from './ChatMessageTool.vue'
import ChatMessageEditor from './ChatMessageEditor.vue'
import ChatMessageActions from './ChatMessageActions.vue'
import ChatMessageImagePreview from './ChatMessageImagePreview.vue'
import ChatVisualizerPreview from '@/features/todo/components/ChatVisualizerPreview.vue'

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
}>()

const { t } = useI18n()
const { renderMarkdown, getMermaidSvgMap } = useMarkdown()

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
const editContent = ref(props.message.content)

// 开启编辑
function startEdit() {
  if (!isUser.value) return
  editContent.value = props.message.content
  isEditing.value = true
}

// 取消编辑
function cancelEdit() {
  isEditing.value = false
  editContent.value = props.message.content
}

// 保存编辑
function saveEdit() {
  const content = editContent.value.trim()
  if (content) {
    emit('edit', content)
  }
  isEditing.value = false
}

// 消息容器引用
const messageRef = ref<HTMLDivElement>()

// 渲染后的 HTML 内容
const renderedHtml = ref('')

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

// 注入交互逻辑（Mermaid 和 代码块）
function injectInteractions() {
  const container = messageRef.value
  if (!container) return

  // 1. 处理 Mermaid SVG 注入与交互
  const svgMap = getMermaidSvgMap()
  if (svgMap.size > 0) {
    svgMap.forEach((fullHtml, placeholderId) => {
      const placeholder = container.querySelector(`#${placeholderId}`)
      if (placeholder) {
        if (placeholder.getAttribute('data-processed') !== 'true') {
          const tempWrapper = document.createElement('div')
          tempWrapper.innerHTML = fullHtml
          const containerElement = tempWrapper.querySelector('.mermaid-container')
          if (containerElement && placeholder.parentNode) {
            containerElement.setAttribute('data-processed', 'true')
            placeholder.parentNode.replaceChild(containerElement, placeholder)
            initMermaidInteractions(containerElement as HTMLElement)
          }
        } else {
          initMermaidInteractions(placeholder as HTMLElement)
        }
      }
    })
  }

  // 2. 处理代码块复制按钮
  initCodeInteractions(container)
}

// 初始化代码块交互
function initCodeInteractions(container: HTMLElement) {
  const copyButtons = container.querySelectorAll('.code-copy-button')
  copyButtons.forEach((btn) => {
    const htmlBtn = btn as HTMLButtonElement
    if (htmlBtn.dataset.interacted === 'true') return
    htmlBtn.dataset.interacted = 'true'

    htmlBtn.addEventListener('click', () => {
      void (async () => {
        const code = htmlBtn.dataset.code
        if (!code) return

        try {
          await navigator.clipboard.writeText(decodeURIComponent(code))
          htmlBtn.classList.add('copied')
          const span = htmlBtn.querySelector('span')
          if (span) span.textContent = t('ai.copied')

          setTimeout(() => {
            htmlBtn.classList.remove('copied')
            if (span) span.textContent = t('ai.copy')
          }, 2000)
        } catch (err) {
          console.error('Failed to copy code:', err)
        }
      })()
    })
  })
}

// 初始化 Mermaid 图表交互（缩放与拖拽）
function initMermaidInteractions(container: HTMLElement) {
  if (container.dataset.interacted === 'true') return
  container.dataset.interacted = 'true'

  const diagram = container.querySelector('.mermaid-diagram') as HTMLElement
  const svg = diagram?.querySelector('svg') as SVGElement
  if (!diagram || !svg) return

  let scale = 1
  let translateX = 0
  let translateY = 0
  let isDragging = false
  let startX = 0
  let startY = 0

  const updateTransform = () => {
    diagram.style.setProperty('--mermaid-scale', scale.toString())
    diagram.style.setProperty('--mermaid-translate-x', `${translateX}px`)
    diagram.style.setProperty('--mermaid-translate-y', `${translateY}px`)
  }

  // 缩放按钮处理
  container.addEventListener('click', (e) => {
    void (async () => {
      const btn = (e.target as HTMLElement).closest('.mermaid-zoom-btn') as HTMLButtonElement
      if (!btn) return

      const action = btn.dataset.action
      if (action === 'copy') {
        const rawCode = container.dataset.raw
        if (rawCode) {
          try {
            await navigator.clipboard.writeText(decodeURIComponent(rawCode))
            const originalInner = btn.innerHTML
            btn.innerHTML =
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-green-500"><polyline points="20 6 9 17 4 12"></polyline></svg>'
            setTimeout(() => {
              btn.innerHTML = originalInner
            }, 2000)
          } catch (err) {
            console.error('Failed to copy mermaid code:', err)
          }
        }
        return
      }

      if (action === 'in') scale = Math.min(scale + 0.2, 5)
      else if (action === 'out') scale = Math.max(scale - 0.2, 0.5)
      else if (action === 'reset') {
        scale = 1
        translateX = 0
        translateY = 0
      }
      updateTransform()
    })()
  })

  // 鼠标滚轮缩放
  diagram.addEventListener(
    'wheel',
    (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const delta = e.deltaY > 0 ? -0.1 : 0.1
        scale = Math.min(Math.max(scale + delta, 0.5), 5)
        updateTransform()
      }
    },
    { passive: false },
  )

  // 拖拽平移
  svg.addEventListener('mousedown', (e) => {
    if (scale <= 1 && translateX === 0 && translateY === 0) return
    isDragging = true
    startX = e.clientX - translateX
    startY = e.clientY - translateY
    svg.style.cursor = 'grabbing'

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDragging) return
      translateX = moveEvent.clientX - startX
      translateY = moveEvent.clientY - startY
      updateTransform()
    }

    const handleMouseUp = () => {
      isDragging = false
      svg.style.cursor = 'grab'
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  })
}

// 渲染 Markdown 内容
let renderTimer: ReturnType<typeof setTimeout> | null = null

// 组件卸载时清理定时器
onUnmounted(() => {
  if (renderTimer) {
    clearTimeout(renderTimer)
    renderTimer = null
  }
})

async function updateRenderedContent(immediate = false) {
  const content = props.message.content
  const streaming = isStreaming.value

  if (!content || isUser.value) return

  // 如果是流式输出，且非立即执行，则进行节流处理
  if (streaming && !immediate) {
    if (renderTimer) return
    renderTimer = setTimeout(() => {
      renderTimer = null
      void (async () => {
        renderedHtml.value = await renderMarkdown(props.message.content, true)
        void nextTick(injectInteractions)
      })()
    }, 60) // 约 16fps，平衡流畅度与渲染开销
    return
  }

  // 非流式或强制立即执行
  if (renderTimer) {
    clearTimeout(renderTimer)
    renderTimer = null
  }
  renderedHtml.value = await renderMarkdown(content, streaming)
  void nextTick(injectInteractions)
}

// 监听内容与状态变化
watch(
  [() => props.message.content, isStreaming],
  async (newValues, oldValues) => {
    const [newContent] = newValues
    const oldContent = oldValues ? oldValues[0] : undefined

    // 只有内容真正变化时才更新
    if (newContent !== oldContent) {
      await updateRenderedContent()
    }
  },
  { immediate: true },
)

// 当流式结束时，强制进行最后一次完整渲染
watch(isStreaming, async (streaming) => {
  if (!streaming) {
    await updateRenderedContent(true)
  }
})
</script>

<template>
  <div
    ref="messageRef"
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
          <!-- 加载状态：仅在既没有思考内容也没有正文内容，且没有多模型讨论时显示 -->
          <div
            v-if="!isUser && !hasContent && isStreaming && !hasThinking && !hasDiscussion"
            class="loading-container flex flex-col gap-3 rounded-2xl border border-ai-message-border bg-ai-message-bg p-4 shadow-sm"
          >
            <!-- 场景 A: 正在生成图片 -->
            <ImageLoadingState v-if="isImageGenerating" />

            <!-- 场景 B: 正在思考文字 -->
            <template v-else>
              <div class="flex items-center gap-2">
                <div class="ai-icon translate-y-[2px] animate-ai-float text-primary">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z"
                      fill="currentColor"
                      class="ai-star"
                    />
                  </svg>
                </div>
                <span class="shimmer-text font-medium">{{ t('ai.isThinking') }}</span>
              </div>
              <div class="flex flex-col gap-2">
                <div class="h-2.5 w-[90%] animate-pulse rounded-full bg-ai-message-border"></div>
                <div
                  class="h-2.5 w-[75%] animate-pulse rounded-full bg-ai-message-border delay-75"
                ></div>
                <div
                  class="h-2.5 w-[85%] animate-pulse rounded-full bg-ai-message-border delay-150"
                ></div>
              </div>
            </template>
          </div>

          <!-- 正文气泡：用户消息或已有内容的 AI 消息 -->
          <div
            v-else-if="isUser || hasContent"
            class="selectable relative select-text break-words transition-all duration-300"
            :class="[
              isUser || message.role !== 'tool'
                ? 'rounded-[1.25rem] px-4 py-3'
                : 'rounded-none p-0',
              isUser
                ? 'bg-gradient-to-br from-primary/95 via-primary to-primary/90 text-primary-foreground shadow-[0_4px_12px_rgba(var(--primary),0.15)] hover:shadow-[0_6px_16px_rgba(var(--primary),0.2)]'
                : message.role === 'tool'
                  ? 'border-none bg-transparent shadow-none'
                  : 'border border-[hsl(var(--ai-message-border))] bg-[hsl(var(--ai-message-bg))] text-foreground shadow-sm hover:border-primary/30 hover:shadow-md',
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
              <div
                v-if="message.images && message.images.length > 0"
                class="mb-2 flex flex-wrap gap-2"
                :class="isUser ? 'justify-end' : 'justify-start'"
              >
                <div
                  v-for="(img, index) in message.images"
                  :key="index"
                  :class="[
                    'group relative overflow-hidden rounded-lg border border-white/20 bg-black/5 shadow-sm transition-all hover:scale-105 cursor-zoom-in',
                    isMobile ? 'h-16 w-16' : 'h-20 w-20',
                  ]"
                  @click="openImage(img)"
                >
                  <img :src="img" class="h-full w-full object-cover" />
                  <div
                    class="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/10 group-hover:opacity-100"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <polyline points="15 3 21 3 21 9"></polyline>
                      <polyline points="9 21 3 21 3 15"></polyline>
                      <line x1="21" y1="3" x2="14" y2="10"></line>
                      <line x1="3" y1="21" x2="10" y2="14"></line>
                    </svg>
                  </div>
                </div>
              </div>

              <!-- 用户消息：编辑模式 -->
              <ChatMessageEditor
                v-if="isUser && isEditing"
                v-model="editContent"
                @save="saveEdit"
                @cancel="cancelEdit"
              />

              <!-- 用户消息：展示模式 -->
              <div v-else-if="isUser" class="group/user relative selectable select-text">
                <div
                  :class="[
                    'break-words whitespace-pre-wrap leading-relaxed',
                    isMobile ? 'text-[14px]' : 'text-[15px]',
                  ]"
                >
                  {{ message.content }}
                </div>
                <!-- 编辑按钮 -->
                <button
                  v-if="!isEditing"
                  :class="[
                    'flex h-7 w-7 items-center justify-center rounded-md bg-card/80 text-muted-foreground shadow-sm transition-all hover:bg-card hover:text-primary',
                    isMobile
                      ? 'mt-1 opacity-60 ml-auto'
                      : 'absolute -left-12 top-0 opacity-0 group-hover/user:opacity-100',
                  ]"
                  :title="t('ai.edit')"
                  @click="startEdit"
                >
                  <Pencil :size="14" />
                </button>
              </div>

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
                  <div
                    v-if="renderedHtml"
                    class="markdown-content selectable relative break-words leading-relaxed select-text"
                  >
                    <!-- eslint-disable-next-line vue/no-v-html -->
                    <div v-html="renderedHtml" />
                  </div>

                  <!-- AI 消息：兜底显示（渲染完成前或渲染失败时） -->
                  <div
                    v-else-if="hasContent"
                    :class="[
                      'relative selectable select-text break-words leading-relaxed',
                      isMobile ? 'text-[14px]' : 'text-[15px]',
                    ]"
                  >
                    {{ message.content }}
                  </div>
                </template>

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

<style scoped>
.markdown-content :deep(.hljs) {
  background: transparent;
  padding: 0;
}
</style>
