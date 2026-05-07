import { computed, type Ref } from 'vue'
import {
  aiThinkingLevel,
  saveAIThinkingLevel,
  type AIConfig,
} from '@/features/ai/composables/useAIConfig'
import type { ThinkingMode } from '@/features/ai/composables/useAIConfig/types'
import type { NovelGenre } from '@/features/ai/services/types'

export function useAiAssistantModes(params: {
  config: Ref<AIConfig>
  updateConfig: (patch: Partial<AIConfig>) => void
}) {
  const isThinkingEnabled = computed(() => aiThinkingLevel.value !== 'off')

  const thinkingLevel = computed(() => aiThinkingLevel.value)

  const setThinkingLevel = (level: ThinkingMode) => {
    saveAIThinkingLevel(level)
  }

  const isTeachingEnabled = computed(() => params.config.value.assistantMode === 'teaching')

  const toggleTeachingMode = () => {
    const isTeaching = params.config.value.assistantMode === 'teaching'
    params.updateConfig({
      assistantMode: isTeaching ? 'default' : 'teaching',
      ...(!isTeaching
        ? { todoAssistant: false, discussionMode: false, enableImageGeneration: false }
        : {}),
    })
  }

  const isNovelEnabled = computed(() => params.config.value.assistantMode === 'novel')

  const toggleNovelMode = () => {
    const isNovel = params.config.value.assistantMode === 'novel'
    params.updateConfig({
      assistantMode: isNovel ? 'default' : 'novel',
      ...(!isNovel
        ? { todoAssistant: false, discussionMode: false, enableImageGeneration: false }
        : {}),
    })
  }

  const isTranslationEnabled = computed(() => params.config.value.assistantMode === 'translation')

  const toggleTranslationMode = () => {
    const isTranslation = isTranslationEnabled.value
    params.updateConfig({
      assistantMode: isTranslation ? 'default' : 'translation',
      ...(isTranslation
        ? {}
        : { todoAssistant: false, discussionMode: false, enableImageGeneration: false }),
    })
  }

  const updateNovelGenre = (genre: NovelGenre | null) => {
    params.updateConfig({ novelGenre: genre })
  }

  const updateNovelTone = (tone: string) => {
    params.updateConfig({ novelTone: tone })
  }

  const updateNovelProtagonistHint = (hint: string) => {
    params.updateConfig({ novelProtagonistHint: hint })
  }

  const isTodoAssistantEnabled = computed(() => params.config.value.todoAssistant)

  const toggleTodoAssistant = () => {
    const newValue = !params.config.value.todoAssistant
    params.updateConfig({
      todoAssistant: newValue,
      ...(newValue
        ? { discussionMode: false, enableImageGeneration: false, assistantMode: 'default' }
        : {}),
    })
  }

  const isDiscussionEnabled = computed(() => params.config.value.discussionMode)

  const toggleDiscussionMode = () => {
    const newValue = !params.config.value.discussionMode
    params.updateConfig({
      discussionMode: newValue,
      ...(newValue
        ? { todoAssistant: false, enableImageGeneration: false, assistantMode: 'default' }
        : {}),
    })
  }

  const isImageGenerationEnabled = computed(() => params.config.value.enableImageGeneration)

  const toggleImageGeneration = () => {
    const newValue = !params.config.value.enableImageGeneration
    params.updateConfig({
      enableImageGeneration: newValue,
      ...(newValue
        ? { todoAssistant: false, discussionMode: false, assistantMode: 'default' }
        : {}),
    })
  }

  const isAgentEnabled = computed(() => params.config.value.agentMode)

  const toggleAgentMode = () => {
    const newValue = !params.config.value.agentMode
    params.updateConfig({
      agentMode: newValue,
      ...(newValue
        ? {
            todoAssistant: false,
            discussionMode: false,
            enableImageGeneration: false,
            assistantMode: 'default',
          }
        : { agentWorkspaceId: null, agentWorkspacePath: null }),
    })
  }

  const updateAgentWorkspace = (workspaceId: string | null, workspacePath: string | null) => {
    params.updateConfig({ agentWorkspaceId: workspaceId, agentWorkspacePath: workspacePath })
  }

  const selectPrimaryModel = (presetId: string) => {
    params.updateConfig({
      discussionPrimaryModelId: presetId,
    })
  }

  const toggleSecondaryModel = (presetId: string) => {
    const currentIds = [...params.config.value.discussionModelIds]
    const index = currentIds.indexOf(presetId)
    if (index > -1) {
      currentIds.splice(index, 1)
    } else {
      currentIds.push(presetId)
    }
    params.updateConfig({
      discussionModelIds: currentIds,
    })
  }

  return {
    isThinkingEnabled,
    thinkingLevel,
    setThinkingLevel,
    isTeachingEnabled,
    toggleTeachingMode,
    isNovelEnabled,
    toggleNovelMode,
    updateNovelGenre,
    updateNovelTone,
    updateNovelProtagonistHint,
    isTranslationEnabled,
    toggleTranslationMode,
    isTodoAssistantEnabled,
    toggleTodoAssistant,
    isDiscussionEnabled,
    toggleDiscussionMode,
    isImageGenerationEnabled,
    toggleImageGeneration,
    isAgentEnabled,
    toggleAgentMode,
    updateAgentWorkspace,
    selectPrimaryModel,
    toggleSecondaryModel,
  }
}
