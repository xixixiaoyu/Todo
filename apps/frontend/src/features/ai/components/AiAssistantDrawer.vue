<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useWindowSize, onKeyStroke } from '@vueuse/core'
import { useRouter } from 'vue-router'
import ResizableDrawer from '@/components/ResizableDrawer.vue'
import ChatMessageList from '@/features/ai/components/ChatMessageList.vue'
import AISettingsDialog from '@/features/ai/components/AISettingsDialog.vue'
import AiAssistantHeader from '@/features/ai/components/AiAssistantHeader.vue'
import AiAssistantToolbar from '@/features/ai/components/AiAssistantToolbar.vue'
import AiAssistantInput from '@/features/ai/components/AiAssistantInput.vue'
import AiAssistantHistoryOverlay from '@/features/ai/components/AiAssistantHistoryOverlay.vue'
import MermaidEditorDialog from '@/features/ai/components/MermaidEditorDialog.vue'
import { useMermaidEditor } from '@/features/ai/composables/useMermaidEditor'
import { useChat } from '@/features/ai/composables/useChat'
import { useAIConfig } from '@/features/ai/composables/useAIConfig'
import { useAiAssistantAttachments } from '@/features/ai/composables/useAiAssistantAttachments'
import { useChatHistory } from '@/features/ai/composables/useChatHistory'
import { useAiAssistantModes } from '@/features/ai/composables/useAiAssistantModes'
import { useAiAssistantPanels } from '@/features/ai/composables/useAiAssistantPanels'
import { useAiAssistantComposer } from '@/features/ai/composables/useAiAssistantComposer'
import { useTodoStore } from '@/features/todo/stores/todo'
import { useNovelDraftStore } from '@/features/novel/stores/novelDraftStore'
import { useI18n } from 'vue-i18n'
import { useResizable } from '@/composables/useResizable'
import { useToast } from '@/composables/useToast'
import { AlertCircle, X, Copy, Check, BookOpen, GraduationCap } from 'lucide-vue-next'

const { t } = useI18n()
const router = useRouter()
const { success: showToast } = useToast()
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
  isNovelEnabled,
  toggleNovelMode,
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
  if (isGenerating.value) {
    stopGenerating()
  }
  switchSession(lastActiveSession.value.id)
}

// 使用聊天 composable
const {
  messages,
  isGenerating,
  error,
  clearError,
  sendMessage,
  stopGenerating,
  clearHistory,
  regenerateMessage,
  deleteMessage,
  editAndResendMessage,
  updateTeachingQuizAnswer,
  getTeachingQuizSnapshot,
} = useChat()

const { openEditor: openMermaidEditor } = useMermaidEditor()

const isCopying = ref(false)
const copyError = async () => {
  if (!error.value || isCopying.value) return
  try {
    isCopying.value = true
    await navigator.clipboard.writeText(error.value)
    showToast(t('common.copied'))
    setTimeout(() => {
      isCopying.value = false
    }, 2000)
  } catch (err) {
    console.error('Failed to copy error:', err)
    isCopying.value = false
  }
}

const todoStore = useTodoStore()
const novelDraftStore = useNovelDraftStore()

const isNovelActive = computed(() => isNovelEnabled.value && !!novelDraftStore.activeDraftId)

function navigateToBookshelf() {
  void router.push('/novel')
}

function navigateToDraft() {
  if (novelDraftStore.activeDraftId) {
    void router.push(`/novel/${novelDraftStore.activeDraftId}`)
  }
}

function navigateToTeachingDashboard() {
  void router.push('/teaching')
}
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

const hasOpenedSettings = ref(false)
const hasOpenedHistory = ref(false)

const shouldMountSettings = computed(() => showSettings.value || hasOpenedSettings.value)
const shouldMountHistory = computed(() => showHistory.value || hasOpenedHistory.value)

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
  triggerFileUpload,
})

const handleSelectSession = (sessionId: string) => {
  if (isGenerating.value) {
    stopGenerating()
  }
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
  handleNovelContinue,
} = useAiAssistantComposer({
  assistantInputRef: assistantInputRef as unknown as typeof assistantInputRef,
  config,
  updateConfig,
  isGenerating,
  selectedImages,
  parsedFiles,
  clearAllAttachments,
  clearHistory,
  sendMessage,
  updateTeachingQuizAnswer,
  getTeachingQuizSnapshot,
})

const chatInput = composedInput

// 快捷键监听: Command + J / Ctrl + J 开启新对话
onKeyStroke(['j', 'J'], (e) => {
  if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
    // 如果正在生成中，不处理
    if (isGenerating.value) return

    e.preventDefault()
    // 如果已经有对话内容才重置，或者当前抽屉未打开，则强制打开
    if (hasHistory.value || !modelValue.value) {
      handleNewChat()
    }
    modelValue.value = true
  }
})

watch(showSettings, (isOpen) => {
  if (isOpen) {
    hasOpenedSettings.value = true
  }
})

watch(showHistory, (isOpen) => {
  if (isOpen) {
    hasOpenedHistory.value = true
  }
})

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
      class="relative flex h-full flex-col bg-card/40 backdrop-blur-3xl shadow-[-20px_0_50px_rgba(0,0,0,0.1)]"
    >
      <AiAssistantHeader
        :is-maximized="isMaximized"
        @toggle-maximize="isMaximized = !isMaximized"
        @close="modelValue = false"
      />

      <!-- 主内容区域 -->
      <div class="relative flex-1 min-h-0 flex flex-col">
        <!-- 小说模式：当前作品指示条 -->
        <div
          v-if="isNovelActive"
          class="mx-4 mt-3 flex items-center gap-2 rounded-xl border border-primary/15 bg-primary/5 px-3 py-2"
        >
          <BookOpen :size="13" class="text-primary/60 shrink-0" />
          <button
            type="button"
            class="flex-1 truncate text-left text-xs font-medium text-foreground/80 transition-colors hover:text-primary"
            @click="navigateToDraft"
          >
            {{
              t('ai.novelActiveDraftIndicator', { title: novelDraftStore.activeDraftTitle ?? '' })
            }}
          </button>
          <button
            type="button"
            class="shrink-0 rounded-lg px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            @click="navigateToBookshelf"
          >
            {{ t('ai.novelBookshelf') }}
          </button>
        </div>

        <!-- 教学模式：学习仪表盘入口 -->
        <div
          v-if="isTeachingEnabled"
          class="mx-4 mt-3 flex items-center gap-2 rounded-xl border border-primary/15 bg-primary/5 px-3 py-2"
        >
          <GraduationCap :size="13" class="text-primary/60 shrink-0" />
          <span class="flex-1 truncate text-xs font-medium text-foreground/80">
            {{ t('ai.teachingMode') }}
          </span>
          <button
            type="button"
            class="shrink-0 rounded-lg px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            @click="navigateToTeachingDashboard"
          >
            {{ t('ai.teachingDashboard') }}
          </button>
        </div>
        <ChatMessageList
          :messages="messages"
          :is-maximized="isMaximized"
          :is-novel-mode="isNovelEnabled"
          @regenerate="regenerateMessage"
          @delete="deleteMessage"
          @edit="editAndResendMessage"
          @select-suggestion="handleSelectSuggestion"
          @ask-selection="handleAskSelection"
          @transfer-selection="modelValue = true"
          @teaching-submit="handleTeachingSubmit"
          @teaching-submit-batch="handleTeachingSubmitBatch"
          @continue-novel="handleNovelContinue"
        />
      </div>

      <!-- 错误提示 -->
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="transform -translate-y-2 opacity-0"
        enter-to-class="transform translate-y-0 opacity-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="transform translate-y-0 opacity-100"
        leave-to-class="transform -translate-y-2 opacity-0"
      >
        <div
          v-if="error"
          :class="[
            'mx-4 mb-3 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600 backdrop-blur-md dark:text-red-400 select-text group',
            isMaximized ? 'mx-auto max-w-4xl w-[calc(100%-2rem)]' : '',
          ]"
        >
          <AlertCircle :size="18" class="mt-0.5 shrink-0 opacity-80" />
          <div class="flex-1 leading-relaxed">
            {{ error }}
          </div>
          <div class="flex items-center gap-1 shrink-0 -mr-1">
            <button
              class="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
              :title="t('common.copy')"
              @click="copyError"
            >
              <Check v-if="isCopying" :size="14" class="text-green-500" />
              <Copy v-else :size="14" />
            </button>
            <button
              class="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors opacity-60 hover:opacity-100"
              :title="t('common.close')"
              @click="clearError"
            >
              <X :size="14" />
            </button>
          </div>
        </div>
      </Transition>

      <!-- 底部工具栏与输入框 -->
      <AiAssistantToolbar
        v-model:show-preset-dropdown="showPresetDropdown"
        v-model:show-discussion-popover="showDiscussionPopover"
        :has-history="hasHistory"
        :is-generating="isGenerating"
        :is-thinking-enabled="isThinkingEnabled"
        :is-teaching-enabled="isTeachingEnabled"
        :is-novel-enabled="isNovelEnabled"
        :is-todo-assistant-enabled="isTodoAssistantEnabled"
        :is-discussion-enabled="isDiscussionEnabled"
        :is-image-generation-enabled="isImageGenerationEnabled"
        :current-preset-name="currentPresetName"
        :presets="presets"
        :config="config"
        :active-preset="activePreset"
        :is-maximized="isMaximized"
        :last-active-session="lastActiveSession"
        :total-attachments="selectedImages.length + parsedFiles.length"
        @new-chat="handleNewChat"
        @open-history="openHistory"
        @toggle-thinking="toggleThinkingMode"
        @toggle-teaching="toggleTeachingMode"
        @toggle-todo="toggleTodoAssistant"
        @toggle-discussion="toggleDiscussionMode"
        @toggle-image-gen="toggleImageGeneration"
        @toggle-novel="toggleNovelMode"
        @select-primary-model="selectPrimaryModel"
        @toggle-secondary-model="toggleSecondaryModel"
        @select-preset="handleSelectPreset"
        @open-settings="openSettings"
        @open-mermaid-editor="openMermaidEditor()"
        @trigger-file-upload="triggerUpload"
        @navigate-previous="navigateToPrevious"
        @stop-generating="stopGenerating"
      >
        <template #input>
          <AiAssistantInput
            ref="assistantInputRef"
            v-model="chatInput"
            :is-image-generation-enabled="isImageGenerationEnabled"
            :is-todo-assistant-enabled="isTodoAssistantEnabled"
            :is-thinking-enabled="isThinkingEnabled"
            :is-teaching-enabled="isTeachingEnabled"
            :is-novel-enabled="isNovelEnabled"
            :selected-images="selectedImages"
            :parsed-files="parsedFiles"
            :is-generating="isGenerating"
            :error="error"
            @send="handleSend"
            @remove-image="removeImage"
            @remove-file="removeFile"
            @trigger-file-upload="triggerUpload"
            @handle-file-upload="handleFileUpload"
            @paste="handlePaste"
            @toggle-todo="toggleTodoAssistant"
            @toggle-image-gen="toggleImageGeneration"
            @toggle-thinking="toggleThinkingMode"
            @toggle-teaching="toggleTeachingMode"
            @toggle-novel="toggleNovelMode"
          />
        </template>
      </AiAssistantToolbar>

      <!-- 设置弹窗 -->
      <AISettingsDialog
        v-if="shouldMountSettings"
        v-model="showSettings"
        v-model:initial-tab="lastActiveTab"
      />

      <AiAssistantHistoryOverlay
        v-if="shouldMountHistory"
        v-model="showHistory"
        :is-mobile="isMobile"
        :history-width="historyWidth"
        :is-resizing="isResizingHistory"
        :start-resize="startHistoryResize"
        @select="handleSelectSession"
        @new-chat="handleNewChat"
      />

      <!-- Mermaid 编辑器对话框 -->
      <MermaidEditorDialog />
    </div>
  </ResizableDrawer>
</template>

<style scoped>
.thinking-markdown :deep(p) {
  margin: 0.5em 0;
}
</style>
