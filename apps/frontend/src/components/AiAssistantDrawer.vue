<script setup lang="ts">
import { ref, nextTick, computed } from 'vue'
import {
  Clover,
  Plus,
  X,
  Maximize2,
  Minimize2,
  Send,
  ToggleLeft,
  Settings2,
  ChevronDown,
  Square,
  RefreshCw,
  Trash2,
  History,
  Check,
} from 'lucide-vue-next'
import ResizableDrawer from '@/components/ResizableDrawer.vue'
import ChatMessageList from '@/components/chat/ChatMessageList.vue'
import AISettingsDialog from '@/components/chat/AISettingsDialog.vue'
import ChatHistoryPanel from '@/components/chat/ChatHistoryPanel.vue'
import { useChat } from '@/composables/useChat'
import { useAIConfig } from '@/composables/useAIConfig'
import { useChatHistory } from '@/composables/useChatHistory'

const modelValue = defineModel<boolean>({ required: true })

// AI 配置与预设
const { presets, activePreset, switchPreset } = useAIConfig()

// 会话历史管理
const { switchSession } = useChatHistory()

// 使用聊天 composable（不传入固定 systemPrompt，使用配置中的值）
const {
  messages,
  isGenerating,
  error,
  sendMessage,
  stopGenerating,
  clearHistory,
  regenerateLastResponse,
} = useChat()

const isMaximized = ref(false)
const chatInput = ref('')
const textareaRef = ref<HTMLTextAreaElement>()
const messageListRef = ref<InstanceType<typeof ChatMessageList>>()

// 设置弹窗状态
const showSettings = ref(false)

// 历史记录面板状态
const showHistory = ref(false)

// 预设下拉框状态
const showPresetDropdown = ref(false)

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

// 打开历史记录面板
const openHistory = () => {
  if (!isGenerating.value) {
    showHistory.value = true
  }
}

// 切换会话
const handleSelectSession = (sessionId: string) => {
  switchSession(sessionId)
  showHistory.value = false
}

// 选择预设
const handleSelectPreset = (presetId: string) => {
  switchPreset(presetId)
  showPresetDropdown.value = false
}

// 打开设置并关闭预设下拉框
const openSettings = () => {
  showSettings.value = true
  showPresetDropdown.value = false
}

// 当前显示的预设名称
const currentPresetName = computed(() => activePreset.value?.name ?? '自定义')
</script>

<template>
  <ResizableDrawer
    v-model="modelValue"
    :default-width="isMaximized ? 800 : 420"
    :min-width="320"
    :max-width="1000"
    :is-fullscreen="isMaximized"
  >
    <div class="relative flex h-full flex-col bg-[#faf8f4]">
      <!-- 顶部标题栏 -->
      <header class="flex h-12 shrink-0 items-center justify-between bg-[#c9b896] px-4">
        <span class="text-sm font-medium text-white">AI 助手</span>
        <div class="flex items-center gap-2">
          <!-- 预设下拉框 -->
          <div class="relative">
            <button
              class="flex items-center gap-1 rounded-md bg-[#b8a785] px-3 py-1.5 text-xs text-white transition-colors hover:bg-[#a99676]"
              @click="showPresetDropdown = !showPresetDropdown"
            >
              <span>{{ currentPresetName }}</span>
              <ChevronDown :size="14" :class="{ 'rotate-180': showPresetDropdown }" />
            </button>
            <!-- 下拉菜单 -->
            <Transition
              enter-active-class="transition-all duration-150 ease-out"
              leave-active-class="transition-all duration-100 ease-in"
              enter-from-class="opacity-0 -translate-y-1"
              enter-to-class="opacity-100 translate-y-0"
              leave-from-class="opacity-100 translate-y-0"
              leave-to-class="opacity-0 -translate-y-1"
            >
              <div
                v-if="showPresetDropdown"
                class="absolute right-0 top-full z-50 mt-1 min-w-[160px] overflow-hidden rounded-lg border border-[#e8e4dd] bg-white py-1 shadow-lg"
              >
                <button
                  v-for="preset in presets"
                  :key="preset.id"
                  class="flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-[#f5f3ed]"
                  :class="{
                    'bg-[#f5f3ed] text-[#6b5c4d]': activePreset?.id === preset.id,
                    'text-[#3a3a3a]': activePreset?.id !== preset.id,
                  }"
                  @click="handleSelectPreset(preset.id)"
                >
                  <Check v-if="activePreset?.id === preset.id" :size="12" class="text-[#c9b896]" />
                  <span :class="{ 'ml-4': activePreset?.id !== preset.id }">{{ preset.name }}</span>
                </button>
                <!-- 分割线 + 设置入口 -->
                <div class="my-1 border-t border-[#e8e4dd]" />
                <button
                  class="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[#8b8680] transition-colors hover:bg-[#f5f3ed] hover:text-[#6b5c4d]"
                  @click="openSettings"
                >
                  <Settings2 :size="12" />
                  <span>管理预设...</span>
                </button>
              </div>
            </Transition>
            <!-- 点击外部关闭 -->
            <div
              v-if="showPresetDropdown"
              class="fixed inset-0 z-40"
              @click="showPresetDropdown = false"
            />
          </div>
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
            title="设置"
            @click="showSettings = true"
          >
            <Settings2 :size="16" />
          </button>
          <button
            class="flex h-8 w-8 items-center justify-center rounded-full border border-[#e8e4dd] bg-white text-[#8b8680] transition-colors hover:bg-[#f5f3ed]"
            title="历史记录"
            :class="{ 'cursor-not-allowed opacity-50': isGenerating }"
            :disabled="isGenerating"
            @click="openHistory"
          >
            <History :size="16" />
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

      <!-- 历史记录面板遮罩 -->
      <Transition
        enter-active-class="transition-opacity duration-200"
        leave-active-class="transition-opacity duration-200"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="showHistory"
          class="absolute inset-0 z-10 bg-black/20"
          @click="showHistory = false"
        />
      </Transition>

      <!-- 历史记录面板 -->
      <Transition
        enter-active-class="transition-transform duration-200 ease-out"
        leave-active-class="transition-transform duration-200 ease-in"
        enter-from-class="-translate-x-full"
        enter-to-class="translate-x-0"
        leave-from-class="translate-x-0"
        leave-to-class="-translate-x-full"
      >
        <div
          v-if="showHistory"
          class="absolute inset-y-0 left-0 z-20 flex w-[280px] flex-col border-r border-[#e8e4dd] bg-[#faf8f4] shadow-lg"
        >
          <!-- 关闭按钮 -->
          <button
            class="absolute right-3 top-3 z-20 flex h-7 w-7 items-center justify-center rounded-md text-[#8b8680] transition-colors hover:bg-[#e8e4dd] hover:text-[#6b5c4d]"
            @click="showHistory = false"
          >
            <X :size="16" />
          </button>
          <ChatHistoryPanel @select="handleSelectSession" @close="showHistory = false" />
        </div>
      </Transition>
    </div>
  </ResizableDrawer>

  <!-- 设置弹窗 -->
  <AISettingsDialog v-model="showSettings" />
</template>
