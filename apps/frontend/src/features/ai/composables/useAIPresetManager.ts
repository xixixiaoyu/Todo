import { ref, watch, computed, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { debounce } from 'lodash-es'
import { useAIConfig, type AIPreset } from '@/features/ai/composables/useAIConfig'
import { useToast } from '@/composables/useToast'
import type { AISkill } from '@/features/ai/services/types'

type PresetForm = Omit<AIPreset, 'id'>

export function useAIPresetManager(): {
  presets: Ref<AIPreset[]>
  skills: Ref<AISkill[]>
  activePresetId: Ref<string | null>
  isCreatingPreset: Ref<boolean>
  editingPreset: Ref<AIPreset | null>
  presetForm: Ref<PresetForm>
  showPresetApiKey: Ref<boolean>
  fileInputRef: Ref<HTMLInputElement | null>
  nameError: Ref<string>
  startCreatePreset: () => void
  startEditPreset: (preset: AIPreset) => void
  savePreset: () => void
  cancelEditPreset: () => void
  handleDeletePreset: (presetId: string) => void
  handleDuplicatePreset: (presetId: string) => void
  switchPreset: (presetId: string) => void
  triggerImport: () => void
  handleFileChange: (event: Event) => Promise<void>
  handleExport: () => void
} {
  const { t } = useI18n()
  const toast = useToast()

  const {
    presets,
    addPreset,
    updatePreset,
    deletePreset,
    duplicatePreset,
    getPresetDefaults,
    activePresetId,
    switchPreset,
    exportPresets,
    importPresets,
    skills,
  } = useAIConfig()

  const editingPreset = ref<AIPreset | null>(null)
  const isCreatingPreset = ref(false)
  const showPresetApiKey = ref(false)
  const fileInputRef = ref<HTMLInputElement | null>(null)
  const presetForm = ref<PresetForm>({
    name: '',
    baseUrl: '',
    apiKey: '',
    model: '',
    systemPrompt: '',
    temperature: 0.6,
    thinkingEffort: 'max',
    todoAssistant: false,
    skillIds: [],
  })

  const nameError = computed(() => {
    const name = presetForm.value.name.trim()
    if (!name && (isCreatingPreset.value || editingPreset.value)) {
      return t('validation.REQUIRED', { property: t('ai.presetNameLabel') })
    }

    const isDuplicate = presets.value.some((p) => {
      if (isCreatingPreset.value) return p.name === name
      if (editingPreset.value) return p.name === name && p.id !== editingPreset.value.id
      return false
    })

    if (isDuplicate) return t('ai.presetNameDuplicate')
    return ''
  })

  function startCreatePreset() {
    isCreatingPreset.value = true
    editingPreset.value = null
    showPresetApiKey.value = false
    const defaults = getPresetDefaults()
    presetForm.value = {
      name: '',
      ...defaults,
      skillIds: defaults.skillIds ? [...defaults.skillIds] : [],
    }
  }

  function startEditPreset(preset: AIPreset) {
    editingPreset.value = preset
    isCreatingPreset.value = false
    showPresetApiKey.value = false
    presetForm.value = {
      name: preset.name,
      baseUrl: preset.baseUrl,
      apiKey: preset.apiKey,
      model: preset.model,
      systemPrompt: preset.systemPrompt,
      temperature: preset.temperature,
      thinkingEffort: preset.thinkingEffort || 'max',
      todoAssistant: preset.todoAssistant,
      skillIds: preset.skillIds ? [...preset.skillIds] : [],
    }
  }

  function savePreset() {
    if (nameError.value) {
      if (presetForm.value.name.trim()) toast.error(nameError.value)
      return
    }

    if (isCreatingPreset.value) {
      addPreset(presetForm.value)
    } else if (editingPreset.value) {
      updatePreset(editingPreset.value.id, presetForm.value)
    }

    isCreatingPreset.value = false
    editingPreset.value = null
  }

  function cancelEditPreset() {
    isCreatingPreset.value = false
    editingPreset.value = null
  }

  const debouncedUpdate = debounce((id: string, form: PresetForm) => {
    if (nameError.value) return
    updatePreset(id, { ...form })
  }, 500)

  watch(
    () => presetForm.value,
    (newForm) => {
      if (editingPreset.value) {
        debouncedUpdate(editingPreset.value.id, newForm)
      }
    },
    { deep: true },
  )

  function handleDeletePreset(presetId: string) {
    deletePreset(presetId)
    if (editingPreset.value?.id === presetId) {
      cancelEditPreset()
    }
  }

  function handleDuplicatePreset(presetId: string) {
    duplicatePreset(presetId)
  }

  function handleExport() {
    if (presets.value.length === 0) return

    const data = exportPresets()
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `lumina-ai-presets-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast.success(t('ai.exportSuccess'))
  }

  function triggerImport() {
    fileInputRef.value?.click()
  }

  async function handleFileChange(event: Event) {
    const target = event.target as HTMLInputElement
    const file = target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const countBefore = presets.value.length
      importPresets(text)
      const countAfter = presets.value.length
      const importedCount = countAfter - countBefore
      if (importedCount > 0) {
        toast.success(t('ai.importSuccess', { count: importedCount }))
      }
    } catch (error) {
      console.error('Import presets error:', error)
      toast.error(t('ai.importError'))
    } finally {
      target.value = ''
    }
  }

  return {
    presets,
    skills,
    activePresetId,
    isCreatingPreset,
    editingPreset,
    presetForm,
    showPresetApiKey,
    fileInputRef,
    nameError,
    startCreatePreset,
    startEditPreset,
    savePreset,
    cancelEditPreset,
    handleDeletePreset,
    handleDuplicatePreset,
    switchPreset,
    triggerImport,
    handleFileChange,
    handleExport,
  }
}
