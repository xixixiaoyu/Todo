<script setup lang="ts">
import { computed } from 'vue'
import { User, Bot, ChevronDown, ChevronUp, Copy, Check } from 'lucide-vue-next'
import { ref } from 'vue'
import type { ChatMessage } from '@/composables/useChat'

const props = defineProps<{
  message: ChatMessage
}>()

// 思考内容折叠状态
const isThinkingCollapsed = ref(false)

// 复制状态
const isCopied = ref(false)

const isUser = computed(() => props.message.role === 'user')
const isStreaming = computed(() => props.message.isStreaming)
const hasThinking = computed(() => !!props.message.thinkingContent)

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
        class="rounded-lg border border-[#e8e4dd] bg-[#f5f3ed] p-3"
      >
        <button
          class="flex w-full items-center justify-between text-xs text-[#8b8680]"
          @click="isThinkingCollapsed = !isThinkingCollapsed"
        >
          <span>思考过程</span>
          <ChevronUp v-if="!isThinkingCollapsed" :size="14" />
          <ChevronDown v-else :size="14" />
        </button>
        <div
          v-show="!isThinkingCollapsed"
          class="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-[#6b5c4d]"
        >
          {{ message.thinkingContent }}
          <span v-if="isStreaming && !message.content" class="inline-block animate-pulse">▊</span>
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
          <span v-if="isStreaming && message.content" class="inline-block animate-pulse">▊</span>
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
