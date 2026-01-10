<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { User, Bot, ChevronDown, ChevronUp, Copy, Check } from 'lucide-vue-next'
import type { ChatMessage } from '@/composables/useChat'

const props = defineProps<{
  message: ChatMessage
}>()

// 思考内容折叠状态（流式时默认展开）
const isThinkingCollapsed = ref(!props.message.isStreaming)

// 复制状态
const isCopied = ref(false)

// 思考内容容器引用
const thinkingContentRef = ref<HTMLDivElement>()

const isUser = computed(() => props.message.role === 'user')
const isStreaming = computed(() => props.message.isStreaming)
const hasThinking = computed(() => !!props.message.thinkingContent)
const hasContent = computed(() => !!props.message.content)

// 动态计算思考内容高度
const thinkingHeight = computed(() => {
  if (isThinkingCollapsed.value) return '0px'
  return thinkingContentRef.value ? `${thinkingContentRef.value.scrollHeight}px` : 'auto'
})

// AI 回复开始后自动收起思考内容
watch(
  () => props.message.content,
  (content) => {
    if (content && props.message.isStreaming && hasThinking.value) {
      // 延迟收起，让用户看到一点思考过程
      setTimeout(() => {
        isThinkingCollapsed.value = true
      }, 1500)
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
        class="overflow-hidden rounded-lg border border-[#e8e4dd] bg-[#f5f3ed]"
      >
        <button
          class="flex w-full items-center justify-between px-3 py-2 text-xs text-[#8b8680] transition-colors hover:bg-[#ebe7e0]"
          @click="isThinkingCollapsed = !isThinkingCollapsed"
        >
          <span class="flex items-center gap-1.5">
            <span
              class="inline-block h-1.5 w-1.5 rounded-full"
              :class="isStreaming && !hasContent ? 'animate-pulse bg-[#c9b896]' : 'bg-[#8b8680]'"
            />
            思考过程
          </span>
          <ChevronUp
            :size="14"
            class="transition-transform"
            :class="{ 'rotate-180': isThinkingCollapsed }"
          />
        </button>
        <div class="transition-all duration-300 ease-in-out" :style="{ maxHeight: thinkingHeight }">
          <div
            ref="thinkingContentRef"
            class="max-h-48 overflow-y-auto whitespace-pre-wrap px-3 pb-3 text-xs leading-relaxed text-[#6b5c4d]"
          >
            {{ message.thinkingContent }}
            <span v-if="isStreaming && !hasContent" class="inline-block animate-pulse">▊</span>
          </div>
        </div>
      </div>

      <!-- 主消息气泡 -->
      <div
        class="rounded-2xl px-4 py-3"
        :class="
          isUser ? 'bg-[#c9b896] text-white' : 'border border-[#e8e4dd] bg-white text-[#3a3a3a]'
        "
      >
        <div class="whitespace-pre-wrap text-sm leading-relaxed">
          {{ message.content || (hasThinking && isStreaming ? '' : '...') }}
          <span v-if="isStreaming && hasContent" class="inline-block animate-pulse">▊</span>
        </div>
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
