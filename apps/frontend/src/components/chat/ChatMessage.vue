<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { ChevronUp, Copy, Check, Sparkles } from 'lucide-vue-next'
import type { ChatMessage } from '@/composables/useChat'
import { useMarkdown } from '@/composables/useMarkdown'

const props = defineProps<{
  message: ChatMessage
}>()

const { renderMarkdown, getMermaidSvgMap } = useMarkdown()

// 思考内容折叠状态（流式且没有正文时默认展开，否则折叠）
const isThinkingCollapsed = ref(!props.message.isStreaming || !!props.message.content)

// 复制状态
const isCopied = ref(false)

// 思考内容容器引用
const thinkingContentRef = ref<HTMLDivElement>()

// 渲染后的 HTML 内容
const renderedHtml = ref('')
const renderedThinkingHtml = ref('')

const isUser = computed(() => props.message.role === 'user')
const isStreaming = computed(() => props.message.isStreaming)
const hasThinking = computed(() => !!props.message.thinkingContent)
const hasContent = computed(() => !!props.message.content)

// 思考状态描述
const thinkingStatus = computed(() => {
  if (isStreaming.value && !hasContent.value) return '正在思考...'
  return '思考过程'
})

// 动态计算思考内容高度
const thinkingHeight = computed(() => {
  if (isThinkingCollapsed.value) return '0px'
  // 依赖 props.message.thinkingContent 确保在流式输出时高度能动态更新
  return (props.message.thinkingContent || renderedThinkingHtml.value) && thinkingContentRef.value
    ? `${thinkingContentRef.value.scrollHeight}px`
    : 'auto'
})

// 渲染 Markdown 内容
async function updateRenderedContent() {
  const tasks = []

  if (props.message.content && !isUser.value) {
    tasks.push(
      renderMarkdown(props.message.content).then((html) => {
        renderedHtml.value = html
      }),
    )
  } else {
    renderedHtml.value = ''
  }

  if (props.message.thinkingContent && !isUser.value) {
    tasks.push(
      renderMarkdown(props.message.thinkingContent).then((html) => {
        renderedThinkingHtml.value = html
      }),
    )
  } else {
    renderedThinkingHtml.value = ''
  }

  if (tasks.length > 0) {
    await Promise.all(tasks)
    await nextTick()
    injectMermaidSvgs()
  }
}

// 注入 Mermaid SVG
function injectMermaidSvgs() {
  const svgMap = getMermaidSvgMap()
  if (svgMap.size === 0) return

  svgMap.forEach((fullHtml, placeholderId) => {
    const placeholder = document.getElementById(placeholderId)
    if (placeholder && placeholder.parentNode) {
      const tempWrapper = document.createElement('div')
      tempWrapper.innerHTML = fullHtml
      const containerElement = tempWrapper.querySelector('.mermaid-container')
      if (containerElement) {
        placeholder.parentNode.replaceChild(containerElement, placeholder)
      }
    }
  })

  svgMap.clear()
}

// 监听内容变化，自动收起思考内容并渲染 Markdown
watch(
  [() => props.message.content, () => props.message.thinkingContent],
  async ([content, thinkingContent]) => {
    if (content && props.message.isStreaming && !isThinkingCollapsed.value) {
      // 出现正文时，稍微延迟后收起思考过程，确保平滑
      setTimeout(() => {
        isThinkingCollapsed.value = true
      }, 1000)
    }
    // 更新渲染内容
    await updateRenderedContent()
  },
  { immediate: true },
)

// 监听流式结束，确保收起
watch(
  () => props.message.isStreaming,
  (isStreaming) => {
    if (!isStreaming && hasThinking.value) {
      isThinkingCollapsed.value = true
    }
  },
)

// 流式更新时滚动到底部
watch(
  () => props.message.thinkingContent,
  () => {
    if (!isThinkingCollapsed.value && thinkingContentRef.value) {
      nextTick(() => {
        if (thinkingContentRef.value) {
          thinkingContentRef.value.scrollTop = thinkingContentRef.value.scrollHeight
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
  <div class="group flex py-4" :class="isUser ? 'justify-end' : 'justify-start'">
    <!-- 消息内容 -->
    <div class="max-w-[85%] space-y-2">
      <!-- 思考过程（AI 消息） -->
      <div
        v-if="hasThinking && !isUser"
        class="thinking-content group/thinking mb-2 overflow-hidden rounded-xl border border-[hsl(var(--ai-message-border))] bg-[hsl(var(--ai-message-bg))] transition-all duration-300"
      >
        <div class="thinking-header flex items-center justify-between px-3 py-2">
          <h4 class="flex items-center gap-2">
            <Sparkles :size="14" class="text-[hsl(var(--primary-color))]" />
            <span
              class="font-medium tracking-wide text-sm text-[hsl(var(--text-secondary-color))]"
              >{{ thinkingStatus }}</span
            >
          </h4>
          <button
            class="flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-[hsl(var(--ai-accent-hover))]"
            @click="isThinkingCollapsed = !isThinkingCollapsed"
          >
            <ChevronUp
              :size="14"
              class="text-[hsl(var(--text-secondary-color))] transition-transform duration-300"
              :class="{ 'rotate-180': isThinkingCollapsed }"
            />
          </button>
        </div>
        <div
          class="thinking-body transition-all duration-500 ease-in-out"
          :style="{ maxHeight: thinkingHeight }"
        >
          <div class="px-3 pb-3">
            <div
              ref="thinkingContentRef"
              class="thinking-text max-h-80 overflow-y-auto border-l border-[hsl(var(--ai-message-border))] pl-4"
            >
              <div
                v-if="renderedThinkingHtml"
                class="markdown-content thinking-markdown italic text-[hsl(var(--text-secondary-color))]"
                v-html="renderedThinkingHtml"
              />
              <div
                v-else
                class="whitespace-pre-wrap italic text-[hsl(var(--text-secondary-color))]"
              >
                {{ message.thinkingContent }}
              </div>
              <span
                v-if="isStreaming && !hasContent"
                class="ml-0.5 inline-block h-4 w-1 animate-pulse bg-[hsl(var(--primary-color))] align-middle"
              ></span>
            </div>
          </div>
        </div>
      </div>

      <!-- 主消息气泡 / 加载状态 -->
      <template v-if="isUser || renderedHtml || (isStreaming && hasContent) || !hasThinking">
        <div
          v-if="!isUser && !hasContent && isStreaming"
          class="loading-container flex items-center gap-2 rounded-xl border border-[hsl(var(--ai-message-border))] bg-[hsl(var(--ai-message-bg))] px-3.5 py-2 shadow-sm"
        >
          <div class="ai-icon animate-pulse-custom text-[hsl(var(--primary-color))]">
            <Sparkles :size="18" />
          </div>
          <span class="shimmer-text text-sm font-medium">正在生成响应...</span>
          <div class="flex gap-0.5">
            <span
              class="ai-sparkle h-1 w-1 animate-sparkle rounded-full bg-[hsl(var(--primary-color))] opacity-40"
            />
            <span
              class="ai-sparkle h-1 w-1 animate-sparkle rounded-full bg-[hsl(var(--primary-color))] opacity-40 [animation-delay:0.3s]"
            />
            <span
              class="ai-sparkle h-1 w-1 animate-sparkle rounded-full bg-[hsl(var(--primary-color))] opacity-40 [animation-delay:0.6s]"
            />
          </div>
        </div>

        <div
          v-else
          class="rounded-2xl px-4 py-3 shadow-sm"
          :class="
            isUser
              ? 'bg-[#c9b896] text-white'
              : 'border border-[hsl(var(--ai-message-border))] bg-[hsl(var(--ai-message-bg))] text-[hsl(var(--text-color))]'
          "
        >
          <!-- 用户消息：纯文本显示 -->
          <div v-if="isUser" class="whitespace-pre-wrap text-sm leading-relaxed">
            {{ message.content }}
          </div>
          <!-- AI 消息：Markdown 渲染 -->
          <div
            v-else-if="renderedHtml"
            class="markdown-content text-sm leading-relaxed"
            v-html="renderedHtml"
          />
          <!-- 兜底加载状态 -->
          <div v-else class="text-sm leading-relaxed">...</div>
          <span v-if="isStreaming && hasContent" class="inline-block animate-pulse">█</span>
        </div>
      </template>

      <!-- 操作按钮（AI 消息 hover 时显示） -->
      <div
        v-if="!isUser && !isStreaming"
        class="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100"
      >
        <button
          class="flex h-7 w-7 items-center justify-center rounded-md text-[#8b8680] transition-colors hover:bg-[#f5f3ed] hover:text-[#6b5c4d]"
          :title="isCopied ? '已复制' : '复制'"
          @click="copyContent"
        >
          <Check v-if="isCopied" :size="14" class="text-green-600" />
          <Copy v-else :size="14" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
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
