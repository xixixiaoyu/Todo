<script setup lang="ts">
import { ref, nextTick, computed } from 'vue'
import { useWindowSize } from '@vueuse/core'
import ResizableDrawer from '@/components/ResizableDrawer.vue'
import ChatMessageList from '@/features/ai/components/ChatMessageList.vue'
import AISettingsDialog from '@/features/ai/components/AISettingsDialog.vue'
import AiAssistantHeader from '@/features/ai/components/AiAssistantHeader.vue'
import AiAssistantToolbar from '@/features/ai/components/AiAssistantToolbar.vue'
import AiAssistantInput from '@/features/ai/components/AiAssistantInput.vue'
import AiAssistantHistoryOverlay from '@/features/ai/components/AiAssistantHistoryOverlay.vue'
import { useChat } from '@/features/ai/composables/useChat'
import {
  useAIConfig,
  aiThinkingMode,
  saveAIThinkingMode,
} from '@/features/ai/composables/useAIConfig'
import { useAiAssistantAttachments } from '@/features/ai/composables/useAiAssistantAttachments'
import { useChatHistory } from '@/features/ai/composables/useChatHistory'
import { useTodoStore } from '@/features/todo/stores/todo'
import { useI18n } from 'vue-i18n'
import { useResizable } from '@/composables/useResizable'
import { useEscClose } from '@/composables/useEscClose'

const { t } = useI18n()
const modelValue = defineModel<boolean>({ required: true })

// AI 配置与预设
const { presets, activePreset, switchPreset, config, updateConfig } = useAIConfig()

const assistantInputRef = ref<InstanceType<typeof AiAssistantInput>>()

const triggerFileUpload = () => assistantInputRef.value?.triggerFileUpload()

// 切换思考模式
const toggleThinkingMode = () => {
  const mode = aiThinkingMode.value === 'enabled' ? 'disabled' : 'enabled'
  saveAIThinkingMode(mode)
}

// 思考模式是否开启
const isThinkingEnabled = computed(() => aiThinkingMode.value === 'enabled')

const toggleTeachingMode = () => {
  const isTeaching = config.value.assistantMode === 'teaching'
  updateConfig({
    assistantMode: isTeaching ? 'default' : 'teaching',
    // 互斥：开启教学模式时，关闭其他模式
    ...(!isTeaching
      ? { todoAssistant: false, discussionMode: false, enableImageGeneration: false }
      : {}),
  })
}

const isTeachingEnabled = computed(() => config.value.assistantMode === 'teaching')

// 切换 Todo 助手
const toggleTodoAssistant = () => {
  const newValue = !config.value.todoAssistant
  updateConfig({
    todoAssistant: newValue,
    // 互斥：开启 Todo 助手时，关闭其他模式
    ...(newValue
      ? { discussionMode: false, enableImageGeneration: false, assistantMode: 'default' }
      : {}),
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
    ...(newValue
      ? { todoAssistant: false, enableImageGeneration: false, assistantMode: 'default' }
      : {}),
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
    ...(newValue ? { todoAssistant: false, discussionMode: false, assistantMode: 'default' } : {}),
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
  deleteMessage,
  editAndResendMessage,
  updateTeachingQuizAnswer,
  getTeachingQuizSnapshot,
} = useChat()

const todoStore = useTodoStore()
const isMaximized = computed({
  get: () => todoStore.isMaximized,
  set: (val) => todoStore.setMaximized(val),
})
const chatInput = ref('')

// 设置弹窗状态
const showSettings = ref(false)
const lastActiveTab = ref<'settings' | 'presets' | 'memory' | 'mcp' | 'contextCompression'>(
  'settings',
)

// 历史记录面板状态
const showHistory = ref(false)
const { width: windowWidth } = useWindowSize()
const isMobile = computed(() => windowWidth.value < 640)

const {
  width: historyWidth,
  isResizing: isResizingHistory,
  startResize: startHistoryResize,
} = useResizable({
  initialWidth: 320,
  minWidth: 240,
  maxWidth: () => {
    const containerWidth =
      (assistantInputRef.value?.$el.closest('.drawer') as HTMLElement)?.offsetWidth || 400
    return containerWidth * 0.8
  },
})

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

const {
  selectedImages,
  parsedFiles,
  removeImage,
  removeFile,
  clearAllAttachments,
  handleFileUpload,
  handlePaste,
  triggerUpload,
} = useAiAssistantAttachments({
  isInputDisabled,
  triggerFileUpload,
})

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
  clearAllAttachments()

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

const handleAskSelection = async (prompt: string) => {
  const text = prompt.trim()
  if (!text) return

  chatInput.value = text
  await nextTick()
  assistantInputRef.value?.adjustHeight()
  if (isGenerating.value) return
  await handleSend()
}

const handleTeachingSubmit = async (payload: {
  quizId: string
  kind: string
  answer: string | string[]
}) => {
  if (isGenerating.value) return
  // 更新本地状态
  updateTeachingQuizAnswer(payload.quizId, payload.answer)
  const quiz = getTeachingQuizSnapshot(payload.quizId) || undefined
  // 发送消息
  await sendMessage(`[TEACHING_ANSWER]\n${JSON.stringify({ ...payload, quiz })}`)
}

const handleTeachingSubmitBatch = async (
  payload: Array<{ quizId: string; kind: string; answer: string | string[] }>,
) => {
  if (isGenerating.value) return
  // 批量更新本地状态
  payload.forEach((p) => updateTeachingQuizAnswer(p.quizId, p.answer))
  const enriched = payload.map((p) => ({
    ...p,
    quiz: getTeachingQuizSnapshot(p.quizId) || undefined,
  }))
  // 发送消息
  await sendMessage(`[TEACHING_ANSWERS]\n${JSON.stringify(enriched)}`)
}

// 打开设置
const openSettings = (tab?: 'settings' | 'presets' | 'memory' | 'mcp' | 'contextCompression') => {
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
    <div
      class="relative flex h-full flex-col bg-card/40 backdrop-blur-3xl border-l border-border/20 shadow-[-20px_0_50px_rgba(0,0,0,0.2)]"
    >
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
          @delete="deleteMessage"
          @edit="editAndResendMessage"
          @select-suggestion="handleSelectSuggestion"
          @ask-selection="handleAskSelection"
          @teaching-submit="handleTeachingSubmit"
          @teaching-submit-batch="handleTeachingSubmitBatch"
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
        :is-teaching-enabled="isTeachingEnabled"
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
        @toggle-teaching="toggleTeachingMode"
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
            :is-teaching-enabled="isTeachingEnabled"
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
            @trigger-file-upload="triggerUpload"
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

      <AiAssistantHistoryOverlay
        v-model="showHistory"
        :is-mobile="isMobile"
        :history-width="historyWidth"
        :is-resizing="isResizingHistory"
        :start-resize="startHistoryResize"
        @select="handleSelectSession"
        @new-chat="handleNewChat"
      />
    </div>
  </ResizableDrawer>
</template>

<style scoped>
.thinking-markdown :deep(p) {
  margin: 0.5em 0;
}
</style>
