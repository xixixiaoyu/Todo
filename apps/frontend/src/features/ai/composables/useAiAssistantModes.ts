import { computed, type Ref } from 'vue'
import {
  aiThinkingMode,
  saveAIThinkingMode,
  type AIConfig,
} from '@/features/ai/composables/useAIConfig'

export function useAiAssistantModes(params: {
  config: Ref<AIConfig>
  updateConfig: (patch: Partial<AIConfig>) => void
}) {
  const isThinkingEnabled = computed(() => aiThinkingMode.value === 'enabled')

  const toggleThinkingMode = () => {
    const mode = aiThinkingMode.value === 'enabled' ? 'disabled' : 'enabled'
    saveAIThinkingMode(mode)
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
  }
}
