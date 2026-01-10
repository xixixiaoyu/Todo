<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  ChevronUp,
  Copy,
  Check,
  RefreshCw,
  Pencil,
  Users,
  CircleDashed,
  CheckCircle2,
  AlertCircle,
} from 'lucide-vue-next'
import type { ChatMessage } from '@/composables/useChat'
import { useMarkdown } from '@/composables/useMarkdown'

const props = defineProps<{
  message: ChatMessage
  isLast?: boolean
}>()

const emit = defineEmits<{
  (e: 'regenerate'): void
  (e: 'edit', content: string): void
}>()

const { t } = useI18n()

const { renderMarkdown, getMermaidSvgMap } = useMarkdown()

// 编辑状态
const isEditing = ref(false)
const editContent = ref(props.message.content)
const editInputRef = ref<HTMLTextAreaElement>()

// 开启编辑
function startEdit() {
  if (!isUser.value) return
  editContent.value = props.message.content
  isEditing.value = true
  nextTick(() => {
    editInputRef.value?.focus()
    adjustEditHeight()
  })
}

// 取消编辑
function cancelEdit() {
  isEditing.value = false
  editContent.value = props.message.content
}

// 保存编辑
function saveEdit() {
  const content = editContent.value.trim()
  if (content && content !== props.message.content) {
    emit('edit', content)
  }
  isEditing.value = false
}

// 自动调整编辑框高度
function adjustEditHeight() {
  const textarea = editInputRef.value
  if (textarea) {
    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight}px`
  }
}

// 思考内容展开状态（流式且没有正文时默认展开）
const isExpanded = ref(props.message.isStreaming && !props.message.content)

// 记录内容实际高度
const contentHeight = ref(0)

// 自动折叠定时器
let autoCollapseTimer: ReturnType<typeof setTimeout> | null = null

// 复制状态
const isCopied = ref(false)

// 思考内容容器引用
const thinkingContentRef = ref<HTMLDivElement>()
const messageRef = ref<HTMLDivElement>()

// 渲染后的 HTML 内容
const renderedHtml = ref('')
const renderedThinkingHtml = ref('')

const isUser = computed(() => props.message.role === 'user')
const isStreaming = computed(() => props.message.isStreaming)
const hasThinking = computed(() => !!props.message.thinkingContent)
const hasContent = computed(() => !!props.message.content)

// 思考状态描述
const thinkingStatus = computed(() => {
  if (isStreaming.value && !hasContent.value) {
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

// 动态计算思考内容高度
const thinkingHeight = computed(() => {
  if (!isExpanded.value) return '0px'
  // 流式输出思考过程且无正文时，保持内容自然流出
  if (isStreaming.value && !hasContent.value) return 'none'
  return `${contentHeight.value}px`
})

// 更新内容高度
const updateContentHeight = () => {
  if (thinkingContentRef.value) {
    contentHeight.value = thinkingContentRef.value.scrollHeight + 12
  }
}

// 注入 Mermaid SVG 并初始化交互
function injectMermaidSvgs() {
  const svgMap = getMermaidSvgMap()
  if (svgMap.size === 0) return

  nextTick(() => {
    const container = messageRef.value
    if (!container) return

    svgMap.forEach((fullHtml, placeholderId) => {
      const placeholder = container.querySelector(`#${placeholderId}`)

      if (placeholder) {
        // 如果占位符还在（说明是新渲染的），则进行替换
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
          // 如果已经处理过，确保交互逻辑仍然有效（应对 Vue 重新渲染 DOM 的情况）
          initMermaidInteractions(placeholder as HTMLElement)
        }
      }
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
  container.addEventListener('click', async (e) => {
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
async function updateRenderedContent() {
  const { content, thinkingContent, isStreaming } = props.message

  if (content && !isUser.value) {
    renderedHtml.value = await renderMarkdown(content, isStreaming)
  }

  if (thinkingContent && !isUser.value) {
    // 只有在正在思考且没有正文时，才给思考内容应用流式渲染效果
    const isThinkingStreaming = isStreaming && !content
    renderedThinkingHtml.value = await renderMarkdown(thinkingContent, isThinkingStreaming)
    nextTick(updateContentHeight)
  }

  injectMermaidSvgs()
}

// 监听内容与状态变化
watch(
  [() => props.message.content, () => props.message.thinkingContent, isStreaming],
  async ([content, thinking, streaming], [oldContent, oldThinking, oldStreaming]) => {
    // 1. 自动折叠逻辑
    if (isExpanded.value) {
      // 场景 A: AI 开始输出正文内容 -> 立即折叠
      const hasStartedResponding = content && !oldContent
      // 场景 B: 只有思考内容，且流式结束 -> 触发 3s 延迟折叠
      const hasFinishedThinkingOnly = !streaming && oldStreaming && thinking && !content
      // 场景 C: 思考内容稳定（非流式状态下的重复触发）
      const isThinkingStable = !streaming && thinking === oldThinking && thinking && !content

      if (hasStartedResponding) {
        isExpanded.value = false
      } else if (hasFinishedThinkingOnly || isThinkingStable) {
        if (autoCollapseTimer) clearTimeout(autoCollapseTimer)
        autoCollapseTimer = setTimeout(() => {
          isExpanded.value = false
        }, 3000)
      }
    }

    // 2. 渲染更新
    await updateRenderedContent()
  },
  { immediate: true },
)

// 思考过程滚动跟随
watch(
  () => props.message.thinkingContent,
  () => {
    if (isExpanded.value && thinkingContentRef.value) {
      nextTick(() => {
        const el = thinkingContentRef.value
        if (el) {
          el.scrollTop = el.scrollHeight
          updateContentHeight()
        }
      })
    }
  },
)

/**
 * 复制消息内容
 */
async function copyContent() {
  try {
    await navigator.clipboard.writeText(props.message.content)
    isCopied.value = true
    setTimeout(() => {
      isCopied.value = false
    }, 2000)
  } catch {
    console.warn('复制失败')
  }
}
</script>

<template>
  <div ref="messageRef" class="group flex py-4" :class="isUser ? 'justify-end' : 'justify-start'">
    <!-- 消息内容 -->
    <div class="max-w-[85%] space-y-2">
      <!-- 思考过程（AI 消息） -->
      <div
        v-if="hasThinking && !isUser"
        class="thinking-content group/thinking mb-2 overflow-hidden rounded-xl border border-ai-message-border bg-ai-message-bg transition-all duration-300 shadow-sm hover:shadow-md"
        :class="{ 'is-collapsed': !isExpanded }"
      >
        <div
          class="thinking-header flex items-center justify-between px-3 py-2 cursor-pointer select-none"
          @click="isExpanded = !isExpanded"
        >
          <h4 class="flex items-center gap-2">
            <div
              class="ai-icon text-primary"
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
              class="font-medium tracking-wide text-[15px] transition-all duration-300"
              :class="isStreaming && !hasContent ? 'shimmer-text' : 'text-muted-foreground'"
            >
              {{ thinkingStatus }}
            </span>
          </h4>
          <button
            class="flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-ai-accent-hover"
            @click.stop="isExpanded = !isExpanded"
          >
            <ChevronUp
              :size="14"
              class="text-muted-foreground transition-transform duration-300"
              :class="{ 'rotate-180': !isExpanded }"
            />
          </button>
        </div>
        <div
          class="thinking-body transition-all duration-300 ease-in-out overflow-hidden"
          :style="{ maxHeight: thinkingHeight }"
        >
          <div class="px-3 pb-3">
            <div ref="thinkingContentRef" class="thinking-text">
              <!-- eslint-disable-next-line vue/no-v-html -->
              <div
                v-if="renderedThinkingHtml"
                class="markdown-content thinking-markdown italic text-muted-foreground"
                v-html="renderedThinkingHtml"
              />
              <div v-else class="whitespace-pre-wrap italic text-muted-foreground">
                {{ message.thinkingContent }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 多模型讨论过程 -->
      <div
        v-if="message.discussionSteps && message.discussionSteps.length > 0 && !isUser"
        class="mb-2 space-y-2 rounded-xl border border-border bg-muted/30 p-3 shadow-sm"
      >
        <div class="flex items-center gap-2 border-b border-border pb-2">
          <Users :size="14" class="text-primary" />
          <span class="text-xs font-medium text-muted-foreground">{{
            t('ai.discussionStatus')
          }}</span>
        </div>
        <div class="space-y-2 pt-1">
          <div
            v-for="step in message.discussionSteps"
            :key="step.modelId"
            class="flex items-start gap-2 text-xs"
          >
            <div class="mt-0.5 shrink-0">
              <CircleDashed
                v-if="step.status === 'thinking'"
                :size="12"
                class="animate-spin text-primary"
              />
              <template v-else-if="step.status === 'done'">
                <CheckCircle2
                  v-if="step.modelId === 'primary-draft'"
                  :size="12"
                  class="text-blue-500"
                />
                <CheckCircle2 v-else :size="12" class="text-green-500" />
              </template>
              <AlertCircle v-else :size="12" class="text-red-500" />
            </div>
            <div class="flex-1">
              <span class="font-medium text-foreground">{{ step.modelName }}: </span>
              <span class="text-muted-foreground">
                {{
                  step.status === 'thinking'
                    ? t('ai.isThinking')
                    : step.status === 'error'
                      ? step.content
                      : t('ai.contributionReady')
                }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- 主消息气泡 / 加载状态 -->
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="transform translate-y-2 opacity-0"
        enter-to-class="transform translate-y-0 opacity-100"
      >
        <template v-if="isUser || hasContent || (isStreaming && !hasThinking)">
          <!-- 加载状态：仅在既没有思考内容也没有正文内容时显示 -->
          <div
            v-if="!isUser && !hasContent && isStreaming && !hasThinking"
            class="loading-container flex flex-col gap-3 rounded-2xl border border-ai-message-border bg-ai-message-bg p-4 shadow-sm"
          >
            <div class="flex items-center gap-2">
              <div class="ai-icon animate-bounce text-primary">
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
          </div>

          <!-- 正文气泡：用户消息或已有内容的 AI 消息 -->
          <div
            v-else-if="isUser || hasContent"
            class="relative rounded-2xl px-4 py-3 shadow-sm transition-all duration-300"
            :class="[
              isUser
                ? 'bg-primary text-primary-foreground hover:bg-primary-hover'
                : 'border border-border bg-card text-foreground',
              isEditing ? 'w-full !bg-card !text-foreground ring-1 ring-primary' : '',
            ]"
          >
            <!-- 用户消息：编辑模式 -->
            <div v-if="isUser && isEditing" class="flex flex-col gap-2">
              <textarea
                ref="editInputRef"
                v-model="editContent"
                class="w-full min-w-[280px] resize-none bg-transparent text-sm leading-relaxed outline-none"
                rows="1"
                @input="adjustEditHeight"
                @keydown.esc="cancelEdit"
                @keydown.enter.ctrl.exact="saveEdit"
                @keydown.enter.meta.exact="saveEdit"
              />
              <div class="flex justify-end gap-2 border-t border-border pt-2">
                <button
                  class="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  @click="cancelEdit"
                >
                  {{ t('ai.cancel') }}
                </button>
                <button
                  class="rounded bg-primary px-2 py-1 text-xs text-primary-foreground hover:bg-primary-hover"
                  @click="saveEdit"
                >
                  {{ t('ai.save') }}
                </button>
              </div>
            </div>

            <!-- 用户消息：展示模式 -->
            <div v-else-if="isUser" class="group/user relative">
              <div class="whitespace-pre-wrap text-[15px] leading-relaxed">
                {{ message.content }}
              </div>
              <!-- 编辑按钮 -->
              <button
                v-if="!isEditing"
                class="absolute -left-10 top-0 flex h-7 w-7 items-center justify-center rounded-md bg-card/80 text-muted-foreground opacity-0 shadow-sm transition-all hover:bg-card hover:text-primary group-hover/user:opacity-100"
                :title="t('ai.edit')"
                @click="startEdit"
              >
                <Pencil :size="14" />
              </button>
            </div>
            <!-- AI 消息：Markdown 渲染 -->
            <!-- eslint-disable-next-line vue/no-v-html -->
            <div
              v-else-if="renderedHtml"
              class="markdown-content leading-relaxed"
              v-html="renderedHtml"
            />
            <!-- 兜底显示 -->
            <div v-else-if="hasContent" class="text-[15px] leading-relaxed">
              {{ message.content }}
            </div>

            <!-- 操作按钮（AI 消息内部） -->
            <div
              v-if="!isUser && !isStreaming && hasContent"
              class="mt-2 flex items-center gap-2 border-t border-ai-message-border pt-2"
            >
              <button
                class="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-all hover:bg-ai-accent-hover hover:text-foreground"
                :title="isCopied ? t('ai.copied') : t('ai.copy')"
                @click="copyContent"
              >
                <Check v-if="isCopied" :size="12" class="text-green-600" />
                <Copy v-else :size="12" />
                <span>{{ isCopied ? t('ai.copied') : t('ai.copy') }}</span>
              </button>
              <button
                v-if="isLast"
                class="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-all hover:bg-ai-accent-hover hover:text-foreground"
                :title="t('ai.regenerate')"
                @click="emit('regenerate')"
              >
                <RefreshCw :size="12" />
                <span>{{ t('ai.regenerate') }}</span>
              </button>
            </div>
          </div>
        </template>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.thinking-text {
  max-height: 20rem;
  overflow-y: auto;
  border-left: 1px solid hsl(var(--ai-message-border));
  padding-left: 1rem;
  color: hsl(var(--text-secondary));
  font-family: var(--font-sans);
  font-size: 15px;
}

.thinking-body {
  transition: max-height 0.3s ease-in-out;
  mask-image: linear-gradient(to bottom, black calc(100% - 20px), transparent 100%);
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

.markdown-content :deep(.hljs) {
  background: transparent;
  padding: 0;
}

/* 思考过程中的波纹效果 */
.thinking-header:hover .ai-icon {
  transform: scale(1.1);
  transition: transform 0.2s ease;
}

.is-collapsed .thinking-body {
  mask-image: none;
}
</style>
