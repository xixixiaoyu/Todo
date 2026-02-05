<script setup lang="ts">
import { ref, nextTick, computed } from 'vue'
import { useWindowSize } from '@vueuse/core'
import ResizableDrawer from '@/components/ResizableDrawer.vue'
import ChatMessageList from '@/components/chat/ChatMessageList.vue'
import AISettingsDialog from '@/components/chat/AISettingsDialog.vue'
import ChatHistoryPanel from '@/components/chat/ChatHistoryPanel.vue'
import AiAssistantHeader from '@/components/ai/AiAssistantHeader.vue'
import AiAssistantToolbar from '@/components/ai/AiAssistantToolbar.vue'
import AiAssistantInput from '@/components/ai/AiAssistantInput.vue'
import { useChat } from '@/composables/useChat'
import { useAIConfig, aiThinkingMode, saveAIThinkingMode } from '@/composables/useAIConfig'
import { useFileParsing } from '@/composables/useFileParsing'
import { useChatHistory } from '@/composables/useChatHistory'
import { useTodoStore } from '@/features/todo/stores/todo'
import { useI18n } from 'vue-i18n'
import { useEscClose } from '@/composables/useEscClose'

const { t } = useI18n()
const modelValue = defineModel<boolean>({ required: true })

// AI 配置与预设
const { presets, activePreset, switchPreset, config, updateConfig } = useAIConfig()

// 附件上传状态
const selectedImages = ref<string[]>([])
const { parsedFiles, parseFile, removeFile, clearFiles } = useFileParsing()
const assistantInputRef = ref<InstanceType<typeof AiAssistantInput>>()

const triggerFileUpload = () => {
  assistantInputRef.value?.$el.querySelector('input[type="file"]')?.click()
}

const processFiles = (files: FileList | File[]) => {
  const MAX_TOTAL = 10
  const currentTotal = selectedImages.value.length + parsedFiles.value.length
  const remaining = MAX_TOTAL - currentTotal
  if (remaining <= 0) return

  const filesToProcess = Array.from(files).slice(0, remaining)

  filesToProcess.forEach((file) => {
    // 允许的文件类型
    const isImage = file.type.startsWith('image/')
    const isAllowedDoc =
      file.type === 'application/pdf' ||
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.type === 'application/vnd.ms-excel' ||
      file.type === 'text/plain' ||
      file.type === 'text/markdown' ||
      file.type === 'application/json' ||
      file.type === 'text/csv' ||
      file.name.match(/\.(ts|js|py|go|java|c|cpp|h|hpp|rs)$/i)

    if (isImage) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result as string
        if (result) {
          selectedImages.value.push(result)
        }
      }
      reader.readAsDataURL(file)
    } else if (isAllowedDoc) {
      // 处理文档
      void parseFile(file)
    }
  })
}

const handleFileUpload = (event: Event) => {
  const target = event.target as HTMLInputElement
  const files = target.files
  if (!files) return

  processFiles(files)

  // 重置 input 以允许再次选择相同文件
  target.value = ''
}

const handlePaste = (event: ClipboardEvent) => {
  if (isInputDisabled.value) return

  const items = event.clipboardData?.items
  if (!items) return

  const files: File[] = []
  let hasFiles = false

  for (const item of Array.from(items)) {
    // 如果是文件类型（包括图片和文档）
    if (item.kind === 'file') {
      const file = item.getAsFile()
      if (file) {
        files.push(file)
        hasFiles = true
      }
    }
  }

  if (hasFiles) {
    // 如果包含文件，阻止默认行为，防止文件名被插入到输入框
    event.preventDefault()
    processFiles(files)
  }
}

const removeImage = (index: number) => {
  selectedImages.value.splice(index, 1)
}

// 切换思考模式
const toggleThinkingMode = () => {
  const mode = aiThinkingMode.value === 'enabled' ? 'disabled' : 'enabled'
  saveAIThinkingMode(mode)
}

// 思考模式是否开启
const isThinkingEnabled = computed(() => aiThinkingMode.value === 'enabled')

// 切换 Todo 助手
const toggleTodoAssistant = () => {
  const newValue = !config.value.todoAssistant
  updateConfig({
    todoAssistant: newValue,
    // 互斥：开启 Todo 助手时，关闭其他模式
    ...(newValue ? { discussionMode: false, enableImageGeneration: false } : {}),
  })
}

// Todo 助手是否开启
const isTodoAssistantEnabled = computed(() => config.value.todoAssistant)

// 切换多模型协作
const toggleDiscussionMode = () => {
  const newValue = !config.value.discussionMode
  updateConfig({
    discussionMode: newValue,
    // 互斥：开启多模型协作时，关闭其他模式
    ...(newValue ? { todoAssistant: false, enableImageGeneration: false } : {}),
  })
}

// 多模型协作是否开启
const isDiscussionEnabled = computed(() => config.value.discussionMode)

// 切换生图功能
const toggleImageGeneration = () => {
  const newValue = !config.value.enableImageGeneration
  updateConfig({
    enableImageGeneration: newValue,
    // 互斥：开启生图模式时，关闭其他模式
    ...(newValue ? { todoAssistant: false, discussionMode: false } : {}),
  })
}

// 生图功能是否开启
const isImageGenerationEnabled = computed(() => config.value.enableImageGeneration)

// 会话历史管理
const { lastActiveSession, switchSession } = useChatHistory()

// 切换会话
const navigateToPrevious = () => {
  if (lastActiveSession.value) {
    switchSession(lastActiveSession.value.id)
  }
}

// 使用聊天 composable
const {
  messages,
  isGenerating,
  error,
  sendMessage,
  stopGenerating,
  clearHistory,
  regenerateMessage,
  editAndResendMessage,
} = useChat()

const todoStore = useTodoStore()
const isMaximized = computed({
  get: () => todoStore.isMaximized,
  set: (val) => todoStore.setMaximized(val),
})
const chatInput = ref('')

// 设置弹窗状态
const showSettings = ref(false)
const lastActiveTab = ref<'settings' | 'presets'>('settings')

// 历史记录面板状态
const showHistory = ref(false)
const historyWidth = ref(320)
const isResizingHistory = ref(false)
const startHistoryX = ref(0)
const startHistoryWidth = ref(0)
const { width: windowWidth } = useWindowSize()

const isMobile = computed(() => windowWidth.value < 640)

const onHistoryResize = (e: MouseEvent) => {
  if (!isResizingHistory.value || isMobile.value) return
  const deltaX = e.clientX - startHistoryX.value
  const newWidth = startHistoryWidth.value + deltaX
  // 限制最小宽度 240px，最大宽度不超过 AI 助手抽屉的 80%
  const containerWidth =
    (assistantInputRef.value?.$el.closest('.drawer') as HTMLElement)?.offsetWidth || 400
  historyWidth.value = Math.max(240, Math.min(newWidth, containerWidth * 0.8))
}

const stopHistoryResize = () => {
  isResizingHistory.value = false
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  window.removeEventListener('mousemove', onHistoryResize)
  window.removeEventListener('mouseup', stopHistoryResize)
}

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

// 快捷操作状态
const showPresetDropdown = ref(false)
const showDiscussionPopover = ref(false)

// 选择主模型
const selectPrimaryModel = (presetId: string) => {
  updateConfig({
    discussionPrimaryModelId: presetId,
  })
}

// 切换副模型
const toggleSecondaryModel = (presetId: string) => {
  const currentIds = [...config.value.discussionModelIds]
  const index = currentIds.indexOf(presetId)
  if (index > -1) {
    currentIds.splice(index, 1)
  } else {
    currentIds.push(presetId)
  }
  updateConfig({
    discussionModelIds: currentIds,
  })
}

// 使用公共 Composable 处理 ESC 关闭
useEscClose(showHistory, () => (showHistory.value = false))
useEscClose(showPresetDropdown, () => (showPresetDropdown.value = false))

// 是否有聊天历史
const hasHistory = computed(() => messages.value.length > 0)

// 输入框是否禁用
const isInputDisabled = computed(() => isGenerating.value && !error.value)

const handleSend = async () => {
  const content = chatInput.value.trim()
  const images = [...selectedImages.value]
  const documents = parsedFiles.value
    .filter((f) => f.status === 'completed')
    .map((f) => ({
      name: f.name,
      content: f.content,
    }))

  if ((!content && images.length === 0 && documents.length === 0) || isInputDisabled.value) return

  chatInput.value = ''
  selectedImages.value = []
  clearFiles()

  // 发送后自动调整高度
  void nextTick(() => assistantInputRef.value?.adjustHeight())

  await sendMessage(content, images, documents)
}

const handleNewChat = () => {
  clearHistory()
  chatInput.value = ''
  if (config.value.todoAssistant) {
    updateConfig({ todoAssistant: false })
  }
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

// 处理建议点击
const handleSelectSuggestion = async (text: string, options?: { requireTodo?: boolean }) => {
  if (options?.requireTodo && !config.value.todoAssistant) {
    updateConfig({
      todoAssistant: true,
    })
  }
  chatInput.value = text
  await nextTick()
  assistantInputRef.value?.adjustHeight()
  await handleSend()
}

// 打开设置
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
      <AiAssistantHeader
        :is-maximized="isMaximized"
        @toggle-maximize="isMaximized = !isMaximized"
        @close="modelValue = false"
      />

      <!-- 主内容区域 -->
      <div class="relative flex-1 min-h-0 flex flex-col">
        <ChatMessageList
          :messages="messages"
          :is-maximized="isMaximized"
          @regenerate="regenerateMessage"
          @edit="editAndResendMessage"
          @select-suggestion="handleSelectSuggestion"
        />
      </div>

      <!-- 错误提示 -->
      <div
        v-if="error"
        :class="[
          'mx-4 mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400',
          isMaximized ? 'mx-auto max-w-4xl w-[calc(100%-2rem)]' : '',
        ]"
      >
        {{ error }}
      </div>

      <!-- 底部工具栏与输入框 -->
      <AiAssistantToolbar
        v-model:show-preset-dropdown="showPresetDropdown"
        v-model:show-discussion-popover="showDiscussionPopover"
        :has-history="hasHistory"
        :is-generating="isGenerating"
        :is-thinking-enabled="isThinkingEnabled"
        :is-todo-assistant-enabled="isTodoAssistantEnabled"
        :is-discussion-enabled="isDiscussionEnabled"
        :is-image-generation-enabled="isImageGenerationEnabled"
        :current-preset-name="currentPresetName"
        :presets="presets"
        :config="config"
        :active-preset="activePreset"
        :is-maximized="isMaximized"
        @new-chat="handleNewChat"
        @open-history="openHistory"
        @toggle-thinking="toggleThinkingMode"
        @toggle-todo="toggleTodoAssistant"
        @toggle-discussion="toggleDiscussionMode"
        @toggle-image-gen="toggleImageGeneration"
        @select-primary-model="selectPrimaryModel"
        @toggle-secondary-model="toggleSecondaryModel"
        @select-preset="handleSelectPreset"
        @open-settings="openSettings"
      >
        <template #input>
          <AiAssistantInput
            ref="assistantInputRef"
            v-model="chatInput"
            :is-input-disabled="isInputDisabled"
            :is-image-generation-enabled="isImageGenerationEnabled"
            :is-todo-assistant-enabled="isTodoAssistantEnabled"
            :is-discussion-enabled="isDiscussionEnabled"
            :is-thinking-enabled="isThinkingEnabled"
            :selected-images="selectedImages"
            :parsed-files="parsedFiles"
            :is-generating="isGenerating"
            :error="error"
            :last-active-session="lastActiveSession"
            @send="handleSend"
            @stop="stopGenerating"
            @navigate-previous="navigateToPrevious"
            @remove-image="removeImage"
            @remove-file="removeFile"
            @trigger-file-upload="triggerFileUpload"
            @handle-file-upload="handleFileUpload"
            @paste="handlePaste"
            @toggle-todo="toggleTodoAssistant"
            @toggle-discussion="toggleDiscussionMode"
            @toggle-image-gen="toggleImageGeneration"
            @toggle-thinking="toggleThinkingMode"
          />
        </template>
      </AiAssistantToolbar>

      <!-- 设置弹窗 -->
      <AISettingsDialog v-model="showSettings" v-model:initial-tab="lastActiveTab" />

      <!-- 历史记录面板遮罩 -->
      <Transition
        enter-active-class="transition-opacity duration-150 ease-out"
        leave-active-class="transition-opacity duration-150 ease-in"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div v-if="showHistory" class="absolute inset-0 z-10 bg-black/20 dark:bg-black/40" />
      </Transition>

      <!-- 历史记录面板 -->
      <Transition
        enter-active-class="transition-transform duration-250 cubic-bezier(0.16, 1, 0.3, 1)"
        leave-active-class="transition-transform duration-200 cubic-bezier(0.16, 1, 0.3, 1)"
        enter-from-class="-translate-x-full"
        enter-to-class="translate-x-0"
        leave-from-class="translate-x-0"
        leave-to-class="-translate-x-full"
      >
        <div
          v-if="showHistory"
          class="absolute inset-y-0 left-0 z-20 flex flex-col border-r border-border bg-card shadow-xl"
          :style="{ width: isMobile ? '100%' : `${historyWidth}px` }"
        >
          <ChatHistoryPanel
            @select="handleSelectSession"
            @close="showHistory = false"
            @new-chat="handleNewChat"
          />

          <!-- 拖拽手柄 -->
          <div
            v-if="!isMobile"
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
</template>

<style scoped>
.thinking-markdown :deep(p) {
  margin: 0.5em 0;
}
</style>
