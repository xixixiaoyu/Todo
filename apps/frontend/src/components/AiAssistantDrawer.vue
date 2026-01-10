<script setup lang="ts">
import { ref, nextTick, computed } from 'vue'
import {
  Search,
  Clover,
  Plus,
  X,
  ChevronLeft,
  Maximize2,
  Minimize2,
  Send,
  ToggleLeft,
  Settings2,
  ChevronDown,
  Square,
  RefreshCw,
  Trash2,
} from 'lucide-vue-next'
import ResizableDrawer from '@/components/ResizableDrawer.vue'
import ChatMessageList from '@/components/chat/ChatMessageList.vue'
import { useChat } from '@/composables/useChat'

const modelValue = defineModel<boolean>({ required: true })

// 使用聊天 composable
const {
  messages,
  isGenerating,
  error,
  sendMessage,
  stopGenerating,
  clearHistory,
  regenerateLastResponse,
} = useChat({
  systemPrompt: '你是一个友好的 AI 助手，请用简洁明了的中文回答用户的问题。',
})

const isMaximized = ref(false)
const chatInput = ref('')
const textareaRef = ref<HTMLTextAreaElement>()
const messageListRef = ref<InstanceType<typeof ChatMessageList>>()

const MIN_HEIGHT = 36
const MAX_HEIGHT = 192

// 是否有聊天历史
const hasHistory = computed(() => messages.value.length > 0)

// 可以重新生成（有 AI 消息且不在生成中）
const canRegenerate = computed(() => {
  if (isGenerating.value) return false
  return messages.value.some((msg) => msg.role === 'assistant')
})

const adjustTextareaHeight = () => {
  const textarea = textareaRef.value
  if (!textarea) return

  textarea.style.height = 'auto'
  const newHeight = Math.min(Math.max(textarea.scrollHeight, MIN_HEIGHT), MAX_HEIGHT)
  textarea.style.height = `${newHeight}px`
}

const handleSend = async () => {
  const content = chatInput.value.trim()
  if (!content || isGenerating.value) return

  chatInput.value = ''
  nextTick(() => adjustTextareaHeight())

  await sendMessage(content)
}

const handleNewline = (event: KeyboardEvent) => {
  event.preventDefault()
  const textarea = event.target as HTMLTextAreaElement
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const value = textarea.value
  const newValue = value.substring(0, start) + '\n' + value.substring(end)
  chatInput.value = newValue
  nextTick(() => {
    textarea.selectionStart = textarea.selectionEnd = start + 1
    textarea.scrollTop = textarea.scrollHeight
    adjustTextareaHeight()
  })
}

const handleNewChat = () => {
  clearHistory()
  chatInput.value = ''
}
</script>

<template>
  <ResizableDrawer
    v-model="modelValue"
    :default-width="isMaximized ? 800 : 420"
    :min-width="320"
    :max-width="1000"
    :is-fullscreen="isMaximized"
  >
    <div class="flex h-full flex-col bg-[#faf8f4]">
      <!-- 顶部标题栏 -->
      <header class="flex h-12 shrink-0 items-center justify-between bg-[#c9b896] px-4">
        <span class="text-sm font-medium text-white">AI 助手</span>
        <div class="flex items-center gap-2">
          <!-- 模型选择下拉 -->
          <button
            class="flex items-center gap-1 rounded-md bg-[#b8a785] px-3 py-1.5 text-xs text-white transition-colors hover:bg-[#a99676]"
          >
            <span>teach</span>
            <ChevronDown :size="14" />
          </button>
          <button
            class="flex items-center gap-1 rounded-md bg-[#b8a785] px-3 py-1.5 text-xs text-white transition-colors hover:bg-[#a99676]"
          >
            <span>glm4.7 (自定义)</span>
            <ChevronDown :size="14" />
          </button>
          <!-- 最大化/最小化 -->
          <button
            class="flex h-7 w-7 items-center justify-center rounded-md text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            @click="isMaximized = !isMaximized"
          >
            <Maximize2 v-if="!isMaximized" :size="16" />
            <Minimize2 v-else :size="16" />
          </button>
          <!-- 关闭按钮 -->
          <button
            class="flex h-7 w-7 items-center justify-center rounded-md text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            @click="modelValue = false"
          >
            <X :size="16" />
          </button>
        </div>
      </header>

      <!-- 主内容区域 -->
      <ChatMessageList ref="messageListRef" :messages="messages" />

      <!-- 错误提示 -->
      <div v-if="error" class="mx-4 mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
        {{ error }}
      </div>

      <!-- 底部工具栏 -->
      <div class="shrink-0 border-t border-[#e8e4dd] bg-[#faf8f4] p-3">
        <!-- 快捷操作按钮 -->
        <div class="mb-3 flex flex-wrap items-center gap-2 text-sm">
          <button
            class="flex items-center gap-1 rounded-full border border-[#e8e4dd] bg-white px-3 py-1.5 text-[#6b5c4d] transition-colors hover:bg-[#f5f3ed]"
            @click="handleNewChat"
          >
            <Plus :size="14" />
            <span>新对话</span>
          </button>
          <!-- 停止生成按钮 -->
          <button
            v-if="isGenerating"
            class="flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-red-600 transition-colors hover:bg-red-100"
            @click="stopGenerating"
          >
            <Square :size="12" />
            <span>停止</span>
          </button>
          <!-- 重新生成按钮 -->
          <button
            v-if="canRegenerate"
            class="flex items-center gap-1 rounded-full border border-[#e8e4dd] bg-white px-3 py-1.5 text-[#6b5c4d] transition-colors hover:bg-[#f5f3ed]"
            @click="regenerateLastResponse"
          >
            <RefreshCw :size="14" />
            <span>重新生成</span>
          </button>
          <!-- 清空历史按钮 -->
          <button
            v-if="hasHistory && !isGenerating"
            class="flex h-8 w-8 items-center justify-center rounded-full border border-[#e8e4dd] bg-white text-[#8b8680] transition-colors hover:bg-red-50 hover:text-red-500"
            title="清空历史"
            @click="clearHistory"
          >
            <Trash2 :size="16" />
          </button>
          <button
            class="flex h-8 w-8 items-center justify-center rounded-full border border-[#e8e4dd] bg-white text-[#8b8680] transition-colors hover:bg-[#f5f3ed]"
          >
            <ToggleLeft :size="16" />
          </button>
          <button
            class="flex h-8 w-8 items-center justify-center rounded-full border border-[#e8e4dd] bg-white text-[#8b8680] transition-colors hover:bg-[#f5f3ed]"
          >
            <Settings2 :size="16" />
          </button>
          <button
            class="flex h-8 w-8 items-center justify-center rounded-full border border-[#e8e4dd] bg-white text-[#8b8680] transition-colors hover:bg-[#f5f3ed]"
          >
            <Search :size="16" />
          </button>
          <button
            class="flex items-center gap-1 rounded-full border border-[#e8e4dd] bg-white px-3 py-1.5 text-[#6b5c4d] transition-colors hover:bg-[#f5f3ed]"
          >
            <ChevronLeft :size="14" />
            <span>上一个对话</span>
          </button>
          <button
            class="flex items-center gap-1 rounded-full border border-[#e8e4dd] bg-white px-3 py-1.5 text-[#6b5c4d] transition-colors hover:bg-[#f5f3ed]"
          >
            <Clover :size="14" />
            <span>Todo 助手</span>
          </button>
        </div>

        <!-- 输入框区域 -->
        <div
          class="flex gap-2 rounded-xl border border-[#e8e4dd] bg-white px-4 py-3"
          :class="{ 'opacity-50': isGenerating }"
        >
          <textarea
            ref="textareaRef"
            v-model="chatInput"
            rows="1"
            :placeholder="
              isGenerating
                ? 'AI 正在回复...'
                : '询问 AI 助手... (按 Shift + Enter 换行，Enter 发送)'
            "
            class="flex-1 resize-none bg-transparent text-sm text-[#3a3a3a] outline-none placeholder:text-[#c4c0b8]"
            :style="{ height: `${MIN_HEIGHT}px` }"
            :disabled="isGenerating"
            @input="adjustTextareaHeight"
            @keydown.enter.exact.prevent="handleSend"
            @keydown.enter.shift.exact="handleNewline"
          />
          <button
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition-colors"
            :class="
              isGenerating ? 'cursor-not-allowed bg-[#d4c9b3]' : 'bg-[#c9b896] hover:bg-[#b8a785]'
            "
            :disabled="isGenerating"
            @click="handleSend"
          >
            <Send :size="16" />
          </button>
        </div>
      </div>
    </div>
  </ResizableDrawer>
</template>
