<script setup lang="ts">
import { ref, nextTick, computed } from 'vue'
import {
  Clover,
  Plus,
  X,
  Maximize2,
  Minimize2,
  Send,
  Lightbulb,
  Settings2,
  ChevronDown,
  ChevronLeft,
  Square,
  History,
  Check,
} from 'lucide-vue-next'
import ResizableDrawer from '@/components/ResizableDrawer.vue'
import ChatMessageList from '@/components/chat/ChatMessageList.vue'
import AISettingsDialog from '@/components/chat/AISettingsDialog.vue'
import ChatHistoryPanel from '@/components/chat/ChatHistoryPanel.vue'
import { useChat } from '@/composables/useChat'
import { useAIConfig, aiThinkingMode, saveAIThinkingMode } from '@/composables/useAIConfig'
import { useChatHistory } from '@/composables/useChatHistory'
import { useI18n } from 'vue-i18n'
import { useEscClose } from '@/composables/useEscClose'

const { t } = useI18n()
const modelValue = defineModel<boolean>({ required: true })

// AI 配置与预设
const { presets, activePreset, switchPreset, config, updateConfig } = useAIConfig()

// 切换思考模式
const toggleThinkingMode = () => {
  const mode = aiThinkingMode.value === 'enabled' ? 'disabled' : 'enabled'
  saveAIThinkingMode(mode)
}

// 思考模式是否开启
const isThinkingEnabled = computed(() => aiThinkingMode.value === 'enabled')

// 切换 Todo 助手
const toggleTodoAssistant = () => {
  updateConfig({
    todoAssistant: !config.value.todoAssistant,
  })
}

// Todo 助手是否开启
const isTodoAssistantEnabled = computed(() => config.value.todoAssistant)

// 会话历史管理
const { sessions, currentSessionId, switchSession } = useChatHistory()

// 寻找当前会话索引
const currentSessionIndex = computed(() =>
  sessions.value.findIndex((s) => s.id === currentSessionId.value),
)

// 上一个会话（时间更早的）
const previousSession = computed(() => {
  const idx = currentSessionIndex.value
  if (idx === -1 || idx === sessions.value.length - 1) return null
  return sessions.value[idx + 1]
})

// 切换会话
const navigateToPrevious = () => {
  if (previousSession.value) {
    switchSession(previousSession.value.id)
  }
}

// 使用聊天 composable（不传入固定 systemPrompt，使用配置中的值）
const {
  messages,
  isGenerating,
  error,
  sendMessage,
  stopGenerating,
  clearHistory,
  regenerateLastResponse,
  editAndResendMessage,
} = useChat()

const isMaximized = ref(false)
const chatInput = ref('')
const textareaRef = ref<HTMLTextAreaElement>()
const messageListRef = ref<InstanceType<typeof ChatMessageList>>()

// 设置弹窗状态
const showSettings = ref(false)
const lastActiveTab = ref<'settings' | 'presets'>('settings')

// 历史记录面板状态
const showHistory = ref(false)

// 预设下拉框状态
const showPresetDropdown = ref(false)

// 使用公共 Composable 处理 ESC 关闭
useEscClose(showHistory, () => (showHistory.value = false))
useEscClose(showPresetDropdown, () => (showPresetDropdown.value = false))

const MIN_HEIGHT = 36
const MAX_HEIGHT = 192

// 是否有聊天历史
const hasHistory = computed(() => messages.value.length > 0)

// 输入框是否禁用（生成中且没有报错时禁用）
const isInputDisabled = computed(() => isGenerating.value && !error.value)

const adjustTextareaHeight = () => {
  const textarea = textareaRef.value
  if (!textarea) return

  textarea.style.height = 'auto'
  const newHeight = Math.min(Math.max(textarea.scrollHeight, MIN_HEIGHT), MAX_HEIGHT)
  textarea.style.height = `${newHeight}px`
}

const handleSend = async () => {
  const content = chatInput.value.trim()
  if (!content || isInputDisabled.value) return

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
const openSettings = (tab?: 'settings' | 'presets') => {
  if (tab) {
    lastActiveTab.value = tab
  }
  showSettings.value = true
  showPresetDropdown.value = false
}

// 当前显示的预设名称
const currentPresetName = computed(() => activePreset.value?.name ?? t('ai.custom'))

defineOptions({
  inheritAttrs: false,
})
</script>

<template>
  <ResizableDrawer
    v-model="modelValue"
    :default-width="isMaximized ? 800 : 420"
    :min-width="320"
    :max-width="1000"
    :is-fullscreen="isMaximized"
    v-bind="$attrs"
  >
    <div class="relative flex h-full flex-col bg-[#faf8f4] dark:bg-[#1a1a1a]">
      <!-- 顶部标题栏 -->
      <header
        class="flex h-12 shrink-0 items-center justify-between bg-[#c9b896] px-4 dark:bg-[#8a7a5a]"
      >
        <span class="text-sm font-medium text-white">{{ t('ai.assistant') }}</span>
        <div class="flex items-center gap-2">
          <!-- 预设下拉框 -->
          <div class="relative">
            <button
              class="flex items-center gap-1 rounded-md bg-[#b8a785] px-3 py-1.5 text-xs text-white transition-colors hover:bg-[#a99676] dark:bg-[#7a6a4a] dark:hover:bg-[#6a5a3a]"
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
                class="absolute right-0 top-full z-50 mt-1 min-w-[160px] overflow-hidden rounded-lg border border-[#e8e4dd] bg-white py-1 shadow-lg dark:border-[#3a3a3a] dark:bg-[#2a2a2a]"
              >
                <button
                  v-for="preset in presets"
                  :key="preset.id"
                  class="flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-[#f5f3ed] dark:hover:bg-[#3a3a3a]"
                  :class="{
                    'bg-[#f5f3ed] text-[#6b5c4d] dark:bg-[#3a3a3a] dark:text-[#c9b896]':
                      activePreset?.id === preset.id,
                    'text-[#3a3a3a] dark:text-[#e0e0e0]': activePreset?.id !== preset.id,
                  }"
                  @click="handleSelectPreset(preset.id)"
                >
                  <Check v-if="activePreset?.id === preset.id" :size="12" class="text-[#c9b896]" />
                  <span :class="{ 'ml-4': activePreset?.id !== preset.id }">{{ preset.name }}</span>
                </button>
                <!-- 分割线 + 设置入口 -->
                <div class="my-1 border-t border-[#e8e4dd] dark:border-[#3a3a3a]" />
                <button
                  class="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[#8b8680] transition-colors hover:bg-[#f5f3ed] hover:text-[#6b5c4d] dark:text-[#808080] dark:hover:bg-[#3a3a3a] dark:hover:text-[#c9b896]"
                  @click="openSettings('presets')"
                >
                  <Settings2 :size="12" />
                  <span>{{ t('ai.managePresets') }}</span>
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
      <ChatMessageList
        ref="messageListRef"
        :messages="messages"
        @regenerate="regenerateLastResponse"
        @edit="editAndResendMessage"
      />

      <!-- 错误提示 -->
      <div
        v-if="error"
        class="mx-4 mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400"
      >
        {{ error }}
      </div>

      <!-- 底部工具栏 -->
      <div
        class="shrink-0 border-t border-[#e8e4dd] bg-[#faf8f4] p-3 dark:border-[#3a3a3a] dark:bg-[#1a1a1a]"
      >
        <!-- 快捷操作按钮 -->
        <div class="mb-3 flex flex-wrap items-center gap-2 text-sm">
          <button
            class="flex items-center gap-1 rounded-full border border-[#e8e4dd] bg-white px-3 py-1.5 text-[#6b5c4d] transition-colors hover:bg-[#f5f3ed] disabled:cursor-not-allowed disabled:opacity-30 dark:border-[#3a3a3a] dark:bg-[#2a2a2a] dark:text-[#a0a0a0] dark:hover:bg-[#3a3a3a]"
            :disabled="!hasHistory || isGenerating"
            @click="handleNewChat"
          >
            <Plus :size="14" />
            <span>{{ t('ai.newChat') }}</span>
          </button>
          <!-- 停止生成按钮 -->
          <button
            v-if="isGenerating && !error"
            class="flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-red-600 transition-colors hover:bg-red-100 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
            @click="stopGenerating"
          >
            <Square :size="12" />
            <span>{{ t('ai.stop') }}</span>
          </button>
          <!-- AI 思考模式开关 -->
          <button
            class="flex h-8 w-8 items-center justify-center rounded-full border transition-colors"
            :class="
              isThinkingEnabled
                ? 'border-[#c9b896] bg-[#c9b896]/10 text-[#c9b896] dark:border-[#b8a785] dark:bg-[#b8a785]/20 dark:text-[#b8a785]'
                : 'border-[#e8e4dd] bg-white text-[#8b8680] hover:bg-[#f5f3ed] dark:border-[#3a3a3a] dark:bg-[#2a2a2a] dark:text-[#6b6b6b] dark:hover:bg-[#3a3a3a]'
            "
            :title="isThinkingEnabled ? t('ai.thinkingEnabled') : t('ai.thinkingDisabled')"
            @click="toggleThinkingMode"
          >
            <Lightbulb :size="16" />
          </button>
          <!-- 返回上一个会话按钮 -->
          <button
            v-if="sessions.length > 1"
            class="flex h-8 w-8 items-center justify-center rounded-full border border-[#e8e4dd] bg-white text-[#8b8680] transition-colors hover:bg-[#f5f3ed] disabled:cursor-not-allowed disabled:opacity-30 dark:border-[#3a3a3a] dark:bg-[#2a2a2a] dark:text-[#6b6b6b] dark:hover:bg-[#3a3a3a]"
            :title="t('ai.previousSession')"
            :disabled="!previousSession || isGenerating"
            @click="navigateToPrevious"
          >
            <ChevronLeft :size="16" />
          </button>
          <button
            class="flex h-8 w-8 items-center justify-center rounded-full border border-[#e8e4dd] bg-white text-[#8b8680] transition-colors hover:bg-[#f5f3ed] dark:border-[#3a3a3a] dark:bg-[#2a2a2a] dark:text-[#6b6b6b] dark:hover:bg-[#3a3a3a]"
            :title="t('ai.history')"
            :class="{ 'cursor-not-allowed opacity-50': isGenerating }"
            :disabled="isGenerating"
            @click="openHistory"
          >
            <History :size="16" />
          </button>
          <button
            class="flex h-8 w-8 items-center justify-center rounded-full border border-[#e8e4dd] bg-white text-[#8b8680] transition-colors hover:bg-[#f5f3ed] dark:border-[#3a3a3a] dark:bg-[#2a2a2a] dark:text-[#6b6b6b] dark:hover:bg-[#3a3a3a]"
            :title="t('ai.settings')"
            @click="openSettings()"
          >
            <Settings2 :size="16" />
          </button>
          <button
            class="flex items-center gap-1 rounded-full border px-3 py-1.5 transition-colors"
            :class="
              isTodoAssistantEnabled
                ? 'border-[#c9b896] bg-[#c9b896]/10 text-[#c9b896] dark:border-[#b8a785] dark:bg-[#b8a785]/20 dark:text-[#b8a785]'
                : 'border-[#e8e4dd] bg-white text-[#6b5c4d] hover:bg-[#f5f3ed] dark:border-[#3a3a3a] dark:bg-[#2a2a2a] dark:text-[#a0a0a0] dark:hover:bg-[#3a3a3a]'
            "
            :title="
              isTodoAssistantEnabled ? t('ai.todoAssistantEnabled') : t('ai.todoAssistantDisabled')
            "
            @click="toggleTodoAssistant"
          >
            <Clover :size="14" />
            <span>{{ t('ai.todoAssistant') }}</span>
          </button>
        </div>

        <!-- 输入框区域 -->
        <div
          class="flex gap-2 rounded-xl border border-[#e8e4dd] bg-white px-4 py-3 dark:border-[#3a3a3a] dark:bg-[#2a2a2a]"
          :class="{ 'opacity-50': isInputDisabled }"
        >
          <textarea
            ref="textareaRef"
            v-model="chatInput"
            rows="1"
            :placeholder="isInputDisabled ? t('ai.generating') : t('ai.placeholder')"
            class="flex-1 resize-none bg-transparent text-sm text-[#3a3a3a] outline-none placeholder:text-[#c4c0b8] dark:text-[#e0e0e0] dark:placeholder:text-[#6b6b6b]"
            :style="{ height: `${MIN_HEIGHT}px` }"
            :disabled="isInputDisabled"
            @input="adjustTextareaHeight"
            @keydown.enter.exact.prevent="handleSend"
            @keydown.enter.shift.exact="handleNewline"
          />
          <button
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition-colors"
            :class="
              isInputDisabled
                ? 'cursor-not-allowed bg-[#d4c9b3] dark:bg-[#5a5a5a]'
                : 'bg-[#c9b896] hover:bg-[#b8a785] dark:bg-[#b8a785] dark:hover:bg-[#a99676]'
            "
            :disabled="isInputDisabled"
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
          class="absolute inset-0 z-10 bg-black/20 dark:bg-black/40"
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
          class="absolute inset-y-0 left-0 z-20 flex w-[280px] flex-col border-r border-[#e8e4dd] bg-[#faf8f4] shadow-lg dark:border-[#3a3a3a] dark:bg-[#1a1a1a]"
        >
          <!-- 关闭按钮 -->
          <button
            class="absolute right-3 top-3 z-20 flex h-7 w-7 items-center justify-center rounded-md text-[#8b8680] transition-colors hover:bg-[#e8e4dd] hover:text-[#6b5c4d] dark:text-[#6b6b6b] dark:hover:bg-[#3a3a3a] dark:hover:text-[#a0a0a0]"
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
  <AISettingsDialog v-model="showSettings" v-model:initial-tab="lastActiveTab" />
</template>

<style scoped>
.thinking-markdown :deep(p) {
  margin: 0.5em 0;
}
</style>
