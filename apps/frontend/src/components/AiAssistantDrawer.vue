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
const { lastActiveSession, switchSession } = useChatHistory()

// 切换会话
const navigateToPrevious = () => {
  if (lastActiveSession.value) {
    switchSession(lastActiveSession.value.id)
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
const historyWidth = ref(320)
const isResizingHistory = ref(false)
const startHistoryX = ref(0)
const startHistoryWidth = ref(0)

const startHistoryResize = (e: MouseEvent) => {
  e.preventDefault()
  isResizingHistory.value = true
  startHistoryX.value = e.clientX
  startHistoryWidth.value = historyWidth.value
  document.body.style.cursor = 'ew-resize'
  document.body.style.userSelect = 'none'
  window.addEventListener('mousemove', onHistoryResize)
  window.addEventListener('mouseup', stopHistoryResize)
}

const onHistoryResize = (e: MouseEvent) => {
  if (!isResizingHistory.value) return
  const deltaX = e.clientX - startHistoryX.value
  const newWidth = startHistoryWidth.value + deltaX
  // 限制最小宽度 240px，最大宽度不超过 AI 助手抽屉的 80%
  const containerWidth = (textareaRef.value?.closest('.drawer') as HTMLElement)?.offsetWidth || 400
  historyWidth.value = Math.max(240, Math.min(newWidth, containerWidth * 0.8))
}

const stopHistoryResize = () => {
  isResizingHistory.value = false
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  window.removeEventListener('mousemove', onHistoryResize)
  window.removeEventListener('mouseup', stopHistoryResize)
}

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
    :default-width="isMaximized ? 800 : 480"
    :min-width="360"
    :max-width="1200"
    :is-fullscreen="isMaximized"
    v-bind="$attrs"
  >
    <div class="relative flex h-full flex-col bg-background">
      <!-- 顶部标题栏 -->
      <header class="flex h-12 shrink-0 items-center justify-between bg-primary px-4">
        <span class="text-sm font-medium text-primary-foreground">{{ t('ai.assistant') }}</span>
        <div class="flex items-center gap-2">
          <!-- 预设下拉框 -->
          <div class="relative">
            <button
              class="flex items-center gap-1 rounded-md bg-white/20 px-3 py-1.5 text-xs text-white transition-colors hover:bg-white/30"
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
                class="absolute right-0 top-full z-50 mt-1 min-w-[160px] overflow-hidden rounded-lg border border-border bg-card py-1 shadow-lg"
              >
                <button
                  v-for="preset in presets"
                  :key="preset.id"
                  class="flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-accent"
                  :class="{
                    'bg-accent text-primary': activePreset?.id === preset.id,
                    'text-foreground': activePreset?.id !== preset.id,
                  }"
                  @click="handleSelectPreset(preset.id)"
                >
                  <Check v-if="activePreset?.id === preset.id" :size="12" class="text-primary" />
                  <span :class="{ 'ml-4': activePreset?.id !== preset.id }">{{ preset.name }}</span>
                </button>
                <!-- 分割线 + 设置入口 -->
                <div class="my-1 border-t border-border" />
                <button
                  class="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
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
      <div class="shrink-0 border-t border-border bg-muted/30 p-3">
        <!-- 快捷操作按钮 -->
        <div class="mb-3 flex flex-wrap items-center gap-2 text-sm">
          <button
            class="flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-30"
            :disabled="!hasHistory || isGenerating"
            @click="handleNewChat"
          >
            <Plus :size="14" />
            <span>{{ t('ai.newChat') }}</span>
          </button>
          <!-- 停止生成按钮 -->
          <button
            v-if="isGenerating && !error"
            class="flex items-center gap-1 rounded-full border border-error/20 bg-error/10 px-3 py-1.5 text-error transition-colors hover:bg-error/20"
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
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            "
            :title="isThinkingEnabled ? t('ai.thinkingEnabled') : t('ai.thinkingDisabled')"
            @click="toggleThinkingMode"
          >
            <Lightbulb :size="16" />
          </button>
          <!-- 返回上一个会话按钮 -->
          <button
            class="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-30"
            :title="t('ai.previousSession')"
            :disabled="!lastActiveSession || isGenerating"
            @click="navigateToPrevious"
          >
            <ChevronLeft :size="16" />
          </button>
          <button
            class="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            :title="t('ai.history')"
            :class="{ 'cursor-not-allowed opacity-50': isGenerating }"
            :disabled="isGenerating"
            @click="openHistory"
          >
            <History :size="16" />
          </button>
          <button
            class="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-all hover:bg-accent hover:text-accent-foreground"
            :title="t('ai.settings')"
            @click="openSettings()"
          >
            <Settings2 :size="16" />
          </button>
          <button
            class="flex items-center gap-1 rounded-full border px-3 py-1.5 transition-colors"
            :class="
              isTodoAssistantEnabled
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground'
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
          class="flex gap-2 rounded-xl border border-border bg-card px-4 py-3"
          :class="{ 'opacity-50': isInputDisabled }"
        >
          <textarea
            ref="textareaRef"
            v-model="chatInput"
            rows="1"
            :placeholder="isInputDisabled ? t('ai.generating') : t('ai.placeholder')"
            class="flex-1 resize-none bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground/50"
            :style="{ height: `${MIN_HEIGHT}px` }"
            :disabled="isInputDisabled"
            @input="adjustTextareaHeight"
            @keydown.enter.exact.prevent="handleSend"
            @keydown.enter.shift.exact="handleNewline"
          />
          <button
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-primary-foreground transition-colors"
            :class="
              isInputDisabled
                ? 'cursor-not-allowed bg-primary/30'
                : 'bg-primary hover:bg-primary-hover'
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
          class="absolute inset-y-0 left-0 z-20 flex flex-col border-r border-border bg-card shadow-xl"
          :style="{ width: `${historyWidth}px` }"
        >
          <!-- 关闭按钮 -->
          <button
            class="absolute right-3 top-3 z-20 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            @click="showHistory = false"
          >
            <X :size="16" />
          </button>
          <ChatHistoryPanel
            @select="handleSelectSession"
            @close="showHistory = false"
            @new-chat="handleNewChat"
          />

          <!-- 拖拽手柄 -->
          <div
            class="absolute -right-1.5 top-0 z-30 flex h-full w-3 cursor-ew-resize items-center justify-center transition-colors hover:bg-primary/10"
            :class="{ 'bg-primary/20': isResizingHistory }"
            @mousedown="startHistoryResize"
          >
            <div
              class="h-12 w-1 rounded-full bg-border transition-colors group-hover:bg-primary/30"
              :class="{ 'bg-primary/50': isResizingHistory }"
            />
          </div>
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
