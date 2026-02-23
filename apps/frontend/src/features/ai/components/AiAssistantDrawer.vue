<script setup lang="ts">
import { ref, computed } from 'vue'
import { useWindowSize } from '@vueuse/core'
import ResizableDrawer from '@/components/ResizableDrawer.vue'
import ChatMessageList from '@/features/ai/components/ChatMessageList.vue'
import AISettingsDialog from '@/features/ai/components/AISettingsDialog.vue'
import AiAssistantHeader from '@/features/ai/components/AiAssistantHeader.vue'
import AiAssistantToolbar from '@/features/ai/components/AiAssistantToolbar.vue'
import AiAssistantInput from '@/features/ai/components/AiAssistantInput.vue'
import AiAssistantHistoryOverlay from '@/features/ai/components/AiAssistantHistoryOverlay.vue'
import { useChat } from '@/features/ai/composables/useChat'
import { useAIConfig } from '@/features/ai/composables/useAIConfig'
import { useAiAssistantAttachments } from '@/features/ai/composables/useAiAssistantAttachments'
import { useChatHistory } from '@/features/ai/composables/useChatHistory'
import { useAiAssistantModes } from '@/features/ai/composables/useAiAssistantModes'
import { useAiAssistantPanels } from '@/features/ai/composables/useAiAssistantPanels'
import { useAiAssistantComposer } from '@/features/ai/composables/useAiAssistantComposer'
import { useTodoStore } from '@/features/todo/stores/todo'
import { useI18n } from 'vue-i18n'
import { useResizable } from '@/composables/useResizable'

const { t } = useI18n()
const modelValue = defineModel<boolean>({ required: true })

// AI 配置与预设
const { presets, activePreset, switchPreset, config, updateConfig } = useAIConfig()

const assistantInputRef = ref<InstanceType<typeof AiAssistantInput>>()

const triggerFileUpload = () => assistantInputRef.value?.triggerFileUpload()

const {
  isThinkingEnabled,
  toggleThinkingMode,
  isTeachingEnabled,
  toggleTeachingMode,
  isTodoAssistantEnabled,
  toggleTodoAssistant,
  isDiscussionEnabled,
  toggleDiscussionMode,
  isImageGenerationEnabled,
  toggleImageGeneration,
  selectPrimaryModel,
  toggleSecondaryModel,
} = useAiAssistantModes({
  config,
  updateConfig,
})

// 会话历史管理
const { lastActiveSession, switchSession } = useChatHistory()

const navigateToPrevious = () => {
  if (!lastActiveSession.value) return
  switchSession(lastActiveSession.value.id)
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

const {
  showSettings,
  lastActiveTab,
  openSettings,
  showHistory,
  openHistory,
  showPresetDropdown,
  showDiscussionPopover,
} = useAiAssistantPanels({ isGenerating })

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

const handleSelectSession = (sessionId: string) => {
  switchSession(sessionId)
  showHistory.value = false
}

// 选择预设
const handleSelectPreset = (presetId: string) => {
  switchPreset(presetId)
  showPresetDropdown.value = false
}

const {
  chatInput: composedInput,
  handleSend,
  handleNewChat,
  handleSelectSuggestion,
  handleAskSelection,
  handleTeachingSubmit,
  handleTeachingSubmitBatch,
} = useAiAssistantComposer({
  assistantInputRef: assistantInputRef as unknown as typeof assistantInputRef,
  config,
  updateConfig,
  isGenerating,
  isInputDisabled,
  selectedImages,
  parsedFiles,
  clearAllAttachments,
  clearHistory,
  sendMessage,
  updateTeachingQuizAnswer,
  getTeachingQuizSnapshot,
})

const chatInput = composedInput

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
