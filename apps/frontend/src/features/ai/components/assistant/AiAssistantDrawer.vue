<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useWindowSize, onKeyStroke } from '@vueuse/core'
import ResizableDrawer from '@/components/ResizableDrawer.vue'
import ChatMessageList from '@/features/ai/components/chat/ChatMessageList.vue'
import AISettingsDialog from '@/features/ai/components/settings/AISettingsDialog.vue'
import AiAssistantHeader from '@/features/ai/components/assistant/AiAssistantHeader.vue'
import AiAssistantToolbar from '@/features/ai/components/assistant/AiAssistantToolbar.vue'
import AiAssistantInput from '@/features/ai/components/assistant/AiAssistantInput.vue'
import MermaidEditorDialog from '@/features/ai/components/mermaid/MermaidEditorDialog.vue'
import ScratchpadEditorDialog from '@/features/ai/components/ScratchpadEditorDialog.vue'
import TranslationEditorDialog from '@/features/ai/components/translation/TranslationEditorDialog.vue'
import AgentWorkspaceSelector from '@/features/ai/components/workspace/AgentWorkspaceSelector.vue'
import RightWorkspacePanel from '@/features/ai/components/workspace/RightWorkspacePanel.vue'
import LeftSessionSidebar from '@/features/ai/components/LeftSessionSidebar.vue'
import TodoPanelDialog from '@/features/todo/components/TodoPanelDialog.vue'
import { useTodoSidebarIntegration } from '@/features/ai/composables/useTodoSidebarIntegration'
import { useMermaidEditor } from '@/features/ai/composables/useMermaidEditor'
import { useScratchpadEditor } from '@/features/ai/composables/useScratchpadEditor'
import { useKeyboardShortcuts } from '@/features/ai/composables/useKeyboardShortcut'
import { useRightPanelCollapsed } from '@/features/ai/composables/useRightPanelCollapsed'
import { useToolPermission } from '@/features/ai/composables/useToolPermission'
import type { PermissionMode } from '@/features/ai/composables/useToolPermission'
import { discoverWorkspaceSkills } from '@/features/ai/services/skills.workspace'
import { useChat } from '@/features/ai/composables/useChat'
import { useAIConfig } from '@/features/ai/composables/useAIConfig'
import { useAiAssistantAttachments } from '@/features/ai/composables/useAiAssistantAttachments'
import { useChatHistory } from '@/features/ai/composables/useChatHistory'
import { useAiAssistantModes } from '@/features/ai/composables/useAiAssistantModes'
import { useAiAssistantPanels } from '@/features/ai/composables/useAiAssistantPanels'
import { useAiAssistantComposer } from '@/features/ai/composables/useAiAssistantComposer'
import { useTodoStore } from '@/features/todo/stores/todo'
import { useSidecar } from '@/composables/useSidecar'
import { useI18n } from 'vue-i18n'
import { useToast } from '@/composables/useToast'
import { AlertCircle, X, Copy, Check } from 'lucide-vue-next'

const { t } = useI18n()
const { success: showToast } = useToast()
const modelValue = defineModel<boolean>({ required: true })

// AI 配置与预设
const { presets, activePreset, switchPreset, config, updateConfig } = useAIConfig()

const assistantInputRef = ref<InstanceType<typeof AiAssistantInput>>()

const triggerFileUpload = () => assistantInputRef.value?.triggerFileUpload()

const {
  thinkingLevel,
  setThinkingLevel,
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
  isTranslationEnabled,
  toggleTranslationMode,
  openTranslationEditor,
  isAgentEnabled,
  toggleAgentMode,
  updateAgentWorkspace,
  selectPrimaryModel,
  toggleSecondaryModel,
} = useAiAssistantModes({
  config,
  updateConfig,
})

const { sidecarPort, sidecarToken } = useSidecar()
const { mode: permissionMode, setMode } = useToolPermission()

async function handleWorkspaceSelect(id: string | null, path: string | null) {
  updateAgentWorkspace(id, path)
  // 发现工作区技能
  if (path && sidecarPort.value && sidecarToken.value) {
    try {
      const discovered = await discoverWorkspaceSkills(path, sidecarPort.value, sidecarToken.value)
      if (discovered.length > 0) {
        const { addDiscoveredWorkspaceSkills } = useAIConfig()
        addDiscoveredWorkspaceSkills(discovered)
      }
    } catch {
      /* Sidecar unavailable */
    }
  }
}

const selectedWorkspacePath = computed(() => config.value.agentWorkspacePath)

const workspacePanelCollapsed = useRightPanelCollapsed()
const sessionSidebarCollapsed = ref(false)

function cyclePermissionMode() {
  const modes: PermissionMode[] = ['operate', 'ask', 'read_only']
  const idx = modes.indexOf(permissionMode.value)
  setMode(modes[(idx + 1) % modes.length])
}

// 会话历史管理
const { lastActiveSession, switchSession, currentSessionId } = useChatHistory()

// 切换会话后自动聚焦输入框
watch(currentSessionId, () => {
  void nextTick(() => assistantInputRef.value?.focus())
})

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
const { openEditor: openScratchpad } = useScratchpadEditor()

const { rightPanelRef, focusTodoInSidebar } = useTodoSidebarIntegration({
  isAgentEnabled,
  selectedWorkspacePath,
  workspacePanelCollapsed,
})

// 全局键盘快捷键
useKeyboardShortcuts([
  { key: 's', mod: true, shift: true, handler: () => openScratchpad() },
  { key: 't', mod: true, shift: true, handler: () => openTranslationEditor() },
  { key: 'm', mod: true, shift: true, handler: () => openMermaidEditor() },
  { key: 'd', mod: true, shift: true, handler: () => focusTodoInSidebar() },
])

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

const isMaximized = computed({
  get: () => todoStore.isMaximized,
  set: (val) => todoStore.setMaximized(val),
})

const { showSettings, lastActiveTab, openSettings, showPresetDropdown, showDiscussionPopover } =
  useAiAssistantPanels({ isGenerating })

const hasOpenedSettings = ref(false)

const shouldMountSettings = computed(() => showSettings.value || hasOpenedSettings.value)

const { width: windowWidth } = useWindowSize()
const isMobile = computed(() => windowWidth.value < 640)

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
        :workspace-collapsed="
          isAgentEnabled && selectedWorkspacePath ? workspacePanelCollapsed : undefined
        "
        @toggle-maximize="isMaximized = !isMaximized"
        @close="modelValue = false"
        @toggle-workspace="workspacePanelCollapsed = !workspacePanelCollapsed"
      />

      <!-- 主内容区域 -->
      <div class="relative flex-1 min-h-0 flex flex-row">
        <!-- 左侧会话列表 -->
        <LeftSessionSidebar
          :collapsed="sessionSidebarCollapsed"
          @new-chat="handleNewChat"
          @switch-session="switchSession"
          @open-settings="openSettings()"
          @toggle-collapse="sessionSidebarCollapsed = !sessionSidebarCollapsed"
        />
        <!-- 聊天列 -->
        <div class="relative flex-1 min-h-0 flex flex-col min-w-0">
          <!-- Agent 工作区（有消息时显示精简条） -->
          <AgentWorkspaceSelector
            v-if="isAgentEnabled && messages.length > 0"
            :visible="true"
            :sidecar-port="sidecarPort"
            :sidecar-token="sidecarToken"
            :selected-id="config.agentWorkspaceId"
            :permission-mode="permissionMode"
            @select="(id, path) => handleWorkspaceSelect(id, path)"
            @cycle-permission-mode="cyclePermissionMode"
          />

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
          >
            <template v-if="isAgentEnabled" #empty-actions>
              <AgentWorkspaceSelector
                :visible="true"
                :sidecar-port="sidecarPort"
                :sidecar-token="sidecarToken"
                :selected-id="config.agentWorkspaceId"
                :permission-mode="permissionMode"
                @select="(id, path) => handleWorkspaceSelect(id, path)"
                @cycle-permission-mode="cyclePermissionMode"
              />
            </template>
          </ChatMessageList>

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
            :is-generating="isGenerating"
            :thinking-level="thinkingLevel"
            :is-teaching-enabled="isTeachingEnabled"
            :is-novel-enabled="isNovelEnabled"
            :is-todo-assistant-enabled="isTodoAssistantEnabled"
            :is-discussion-enabled="isDiscussionEnabled"
            :is-image-generation-enabled="isImageGenerationEnabled"
            :is-translation-enabled="isTranslationEnabled"
            :is-agent-enabled="isAgentEnabled"
            :current-preset-name="currentPresetName"
            :presets="presets"
            :config="config"
            :active-preset="activePreset"
            :is-maximized="isMaximized"
            :last-active-session="lastActiveSession"
            :total-attachments="selectedImages.length + parsedFiles.length"
            @new-chat="handleNewChat"
            @update:thinking-level="setThinkingLevel"
            @toggle-teaching="toggleTeachingMode"
            @toggle-todo="toggleTodoAssistant"
            @toggle-discussion="toggleDiscussionMode"
            @toggle-image-gen="toggleImageGeneration"
            @toggle-novel="toggleNovelMode"
            @toggle-translation="toggleTranslationMode"
            @toggle-agent="toggleAgentMode"
            @select-primary-model="selectPrimaryModel"
            @toggle-secondary-model="toggleSecondaryModel"
            @select-preset="handleSelectPreset"
            @open-settings="openSettings"
            @open-mermaid-editor="openMermaidEditor()"
            @open-scratchpad="openScratchpad()"
            @open-translation="openTranslationEditor()"
            @open-todo-panel="focusTodoInSidebar()"
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
                :thinking-level="thinkingLevel"
                :is-teaching-enabled="isTeachingEnabled"
                :is-novel-enabled="isNovelEnabled"
                :is-translation-enabled="isTranslationEnabled"
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
                @update:thinking-level="setThinkingLevel"
                @toggle-teaching="toggleTeachingMode"
                @toggle-novel="toggleNovelMode"
                @toggle-translation="toggleTranslationMode"
              />
            </template>
          </AiAssistantToolbar>
        </div>
        <!-- 右侧面板（Todo + 工作区） -->
        <RightWorkspacePanel
          ref="rightPanelRef"
          :show-agent-tabs="isAgentEnabled && !!selectedWorkspacePath"
          :workspace-path="selectedWorkspacePath"
          :sidecar-port="sidecarPort"
          :sidecar-token="sidecarToken"
          :collapsed="workspacePanelCollapsed"
          @toggle-collapse="workspacePanelCollapsed = !workspacePanelCollapsed"
        />
      </div>

      <!-- 设置弹窗 -->
      <AISettingsDialog
        v-if="shouldMountSettings"
        v-model="showSettings"
        v-model:initial-tab="lastActiveTab"
      />

      <MermaidEditorDialog />
      <ScratchpadEditorDialog />
      <TranslationEditorDialog />
      <TodoPanelDialog />
    </div>
  </ResizableDrawer>
</template>

<style scoped>
.thinking-markdown :deep(p) {
  margin: 0.5em 0;
}
</style>
