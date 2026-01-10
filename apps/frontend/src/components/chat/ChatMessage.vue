<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { User, Bot, ChevronUp, Copy, Check } from 'lucide-vue-next'
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
  <div class="group flex gap-3 py-4" :class="{ 'flex-row-reverse': isUser }">
    <!-- 头像 -->
    <div
      class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
      :class="isUser ? 'bg-[#c9b896]' : 'bg-[#e8e4dd]'"
    >
      <User v-if="isUser" :size="16" class="text-white" />
      <Bot v-else :size="16" class="text-[#6b5c4d]" />
    </div>

    <!-- 消息内容 -->
    <div class="max-w-[80%] space-y-2">
      <!-- 思考过程（AI 消息） -->
      <div
        v-if="hasThinking && !isUser"
        class="group/thinking mb-2 overflow-hidden transition-all duration-300"
      >
        <button
          class="flex items-center gap-2 py-1 text-[13px] text-[#a09c96] transition-colors hover:text-[#8b8680]"
          @click="isThinkingCollapsed = !isThinkingCollapsed"
        >
          <div class="relative flex h-4 w-4 items-center justify-center">
            <span
              v-if="isStreaming && !hasContent"
              class="absolute h-full w-full animate-ping rounded-full bg-[#c9b896] opacity-20"
            />
            <span
              class="relative h-1 w-1 rounded-full transition-colors duration-300"
              :class="isStreaming && !hasContent ? 'bg-[#c9b896]' : 'bg-[#c9b896]/50'"
            />
          </div>
          <span class="font-medium">{{ thinkingStatus }}</span>
          <ChevronUp
            :size="14"
            class="opacity-40 transition-all duration-300"
            :class="{ 'rotate-180': isThinkingCollapsed }"
          />
        </button>
        <div class="transition-all duration-500 ease-in-out" :style="{ maxHeight: thinkingHeight }">
          <div class="py-1">
            <div
              ref="thinkingContentRef"
              class="max-h-80 overflow-y-auto border-l border-[#e8e4dd] pl-4 text-[13px] leading-relaxed text-[#8b8680]"
            >
              <div
                v-if="renderedThinkingHtml"
                class="markdown-content thinking-markdown italic"
                v-html="renderedThinkingHtml"
              />
              <div v-else class="whitespace-pre-wrap italic">
                {{ message.thinkingContent }}
              </div>
              <span
                v-if="isStreaming && !hasContent"
                class="ml-0.5 inline-block w-1 animate-pulse bg-[#c9b896]"
                >|</span
              >
            </div>
          </div>
        </div>
      </div>

      <!-- 主消息气泡 -->
      <div
        v-if="isUser || renderedHtml || (isStreaming && hasContent) || !hasThinking"
        class="rounded-2xl px-4 py-3"
        :class="
          isUser ? 'bg-[#c9b896] text-white' : 'border border-[#e8e4dd] bg-white text-[#3a3a3a]'
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
        <!-- 加载中状态（仅在没有思考过程且没有内容时显示） -->
        <div v-else-if="!hasContent" class="text-sm leading-relaxed">...</div>
        <span v-if="isStreaming && hasContent" class="inline-block animate-pulse">█</span>
      </div>

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
