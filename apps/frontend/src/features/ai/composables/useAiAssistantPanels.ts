import { ref, type Ref } from 'vue'
import { useEscClose } from '@/composables/useEscClose'

export type AiAssistantSettingsTab =
  | 'settings'
  | 'presets'
  | 'skills'
  | 'memory'
  | 'mcp'
  | 'contextCompression'

export function useAiAssistantPanels(params: { isGenerating: Ref<boolean> }) {
  const showSettings = ref(false)
  const lastActiveTab = ref<AiAssistantSettingsTab>('settings')

  const showHistory = ref(false)
  const showPresetDropdown = ref(false)
  const showDiscussionPopover = ref(false)

  const openSettings = (tab?: AiAssistantSettingsTab) => {
    if (tab) {
      lastActiveTab.value = tab
    }
    showSettings.value = true
    showPresetDropdown.value = false
  }

  const openHistory = () => {
    if (!params.isGenerating.value) {
      showHistory.value = true
    }
  }

  useEscClose(showHistory, () => (showHistory.value = false))
  useEscClose(showPresetDropdown, () => (showPresetDropdown.value = false))

  return {
    showSettings,
    lastActiveTab,
    openSettings,
    showHistory,
    openHistory,
    showPresetDropdown,
    showDiscussionPopover,
  }
}
