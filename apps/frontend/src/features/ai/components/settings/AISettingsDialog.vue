<script setup lang="ts">
import { ref, watch, computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  X,
  RotateCcw,
  Palette,
  SlidersHorizontal,
  Layers,
  Brain,
  FileText,
  Zap,
  Globe,
  Terminal,
} from 'lucide-vue-next'
import AiLuminaIcon from '../AiLuminaIcon.vue'
import { isEqual } from 'lodash-es'
import { useAIConfig } from '@/features/ai/composables/useAIConfig'
import type { AIConfig, AIPreset } from '@/features/ai/composables/useAIConfig'
import { useEscClose } from '@/composables/useEscClose'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

import AISettingsBasic from './AISettingsBasic.vue'
import AISettingsAppearance from './AISettingsAppearance.vue'
import AIMemoryManager from '../memory/AIMemoryManager.vue'
import AIPresetManager from '../presets/AIPresetManager.vue'
import AISkillManager from '../skills/AISkillManager.vue'
import McpSettingsManager from '@/features/mcp/components/McpSettingsManager.vue'
import AIWebSearchConfig from '../assistant/AIWebSearchConfig.vue'

type SettingsTab =
  | 'appearance'
  | 'settings'
  | 'presets'
  | 'skills'
  | 'memory'
  | 'mcp'
  | 'contextCompression'
  | 'webSearch'

const navItems: { id: SettingsTab; icon: typeof Palette; labelKey: string }[] = [
  { id: 'appearance', icon: Palette, labelKey: 'ai.appearance' },
  { id: 'settings', icon: SlidersHorizontal, labelKey: 'ai.basicSettings' },
  { id: 'presets', icon: Layers, labelKey: 'ai.presetManagement' },
  { id: 'memory', icon: Brain, labelKey: 'ai.memory' },
  { id: 'contextCompression', icon: FileText, labelKey: 'ai.contextCompression' },
  { id: 'skills', icon: Zap, labelKey: 'ai.skills' },
  { id: 'webSearch', icon: Globe, labelKey: 'ai.webSearch' },
  { id: 'mcp', icon: Terminal, labelKey: 'ai.mcp' },
]

const props = defineProps<{
  initialTab?: SettingsTab
}>()

const emit = defineEmits<{
  (e: 'update:initialTab', tab: SettingsTab): void
}>()

const modelValue = defineModel<boolean>({ required: true })

const { t } = useI18n()
const presetNameInputId = useId()

const {
  config,
  updateConfig,
  DEFAULT_CONFIG,
  presets,
  skills,
  addPreset,
  activePresetId,
  switchPreset,
  syncConfigToPreset,
} = useAIConfig()

const presetManagerRef = ref<InstanceType<typeof AIPresetManager> | null>(null)

const activeTab = ref<SettingsTab>(props.initialTab || 'appearance')

watch(activeTab, (newTab) => {
  emit('update:initialTab', newTab)
})

const formData = ref<AIConfig>({
  ...config.value,
  discussionModelIds: [...config.value.discussionModelIds] as string[],
  discussionPrimaryModelId: config.value.discussionPrimaryModelId,
  memoryModelId: config.value.memoryModelId,
  skillIds: [...config.value.skillIds] as string[],
})

const isDuplicatePreset = computed(() => {
  return presets.value.some((preset) => {
    const presetSkillIds = [...(preset.skillIds || [])].sort()
    const formSkillIds = [...formData.value.skillIds].sort()
    return (
      preset.baseUrl === formData.value.baseUrl &&
      preset.apiKey === formData.value.apiKey &&
      preset.model === formData.value.model &&
      preset.systemPrompt === formData.value.systemPrompt &&
      preset.temperature === formData.value.temperature &&
      preset.todoAssistant === formData.value.todoAssistant &&
      presetSkillIds.length === formSkillIds.length &&
      presetSkillIds.every((id, index) => id === formSkillIds[index])
    )
  })
})

const showSaveAsPresetConfirm = ref(false)
const saveAsPresetName = ref('')
const syncTargetPresetId = ref<string | null>(activePresetId.value)
const canSyncToPreset = computed(() => {
  if (activeTab.value !== 'settings' || formData.value.discussionMode) return false
  if (!syncTargetPresetId.value) return false
  return presets.value.some((preset) => preset.id === syncTargetPresetId.value)
})

watch(
  [() => modelValue.value, () => props.initialTab],
  ([isOpen, tab]) => {
    if (isOpen) {
      if (tab) {
        activeTab.value = tab
      }
      formData.value = {
        ...config.value,
        discussionModelIds: [...config.value.discussionModelIds] as string[],
        discussionPrimaryModelId: config.value.discussionPrimaryModelId,
        memoryModelId: config.value.memoryModelId,
        skillIds: [...config.value.skillIds] as string[],
      }
    }
  },
  { immediate: true },
)

watch(
  () => config.value,
  (newConfig) => {
    const newFormData = {
      ...newConfig,
      discussionModelIds: [...newConfig.discussionModelIds] as string[],
      discussionPrimaryModelId: newConfig.discussionPrimaryModelId,
      memoryModelId: newConfig.memoryModelId,
      skillIds: [...newConfig.skillIds] as string[],
    }
    if (!isEqual(formData.value, newFormData)) {
      formData.value = newFormData
    }
  },
  { immediate: true, deep: true },
)

watch(
  formData,
  (newVal) => {
    if (modelValue.value && !isEqual(newVal, config.value)) {
      updateConfig(newVal)
    }
  },
  { deep: true },
)

function handleSaveAsPreset() {
  saveAsPresetName.value = ''
  showSaveAsPresetConfirm.value = true
}

function confirmSaveAsPreset() {
  if (!saveAsPresetName.value.trim()) return

  const newPreset = addPreset({
    name: saveAsPresetName.value.trim(),
    baseUrl: formData.value.baseUrl,
    apiKey: formData.value.apiKey,
    model: formData.value.model,
    systemPrompt: formData.value.systemPrompt,
    temperature: formData.value.temperature,
    todoAssistant: formData.value.todoAssistant,
    skillIds: formData.value.skillIds,
  })

  syncTargetPresetId.value = newPreset.id
  showSaveAsPresetConfirm.value = false
  activeTab.value = 'presets'
}

function handleSyncToPreset() {
  if (!canSyncToPreset.value) return
  syncConfigToPreset(syncTargetPresetId.value)
}

function handleReset() {
  formData.value = {
    ...DEFAULT_CONFIG,
    discussionModelIds: [...DEFAULT_CONFIG.discussionModelIds] as string[],
    discussionPrimaryModelId: DEFAULT_CONFIG.discussionPrimaryModelId,
    memoryModelId: DEFAULT_CONFIG.memoryModelId,
    skillIds: [...DEFAULT_CONFIG.skillIds] as string[],
  }
}

function handleClose() {
  if (
    activeTab.value === 'presets' &&
    presetManagerRef.value &&
    presetManagerRef.value.editingPreset
  ) {
    presetManagerRef.value.savePreset()
  }
  modelValue.value = false
}

useEscClose(modelValue, handleClose)

watch(activePresetId, () => {
  if (activePresetId.value) {
    syncTargetPresetId.value = activePresetId.value
  }

  if (activeTab.value === 'presets') {
    formData.value = {
      ...config.value,
      discussionModelIds: [...config.value.discussionModelIds] as string[],
      discussionPrimaryModelId: config.value.discussionPrimaryModelId,
      memoryModelId: config.value.memoryModelId,
      skillIds: [...config.value.skillIds] as string[],
    }
  }
})

defineExpose({
  activeTab,
  formData,
  showSaveAsPresetConfirm,
  saveAsPresetName,
  confirmSaveAsPreset,
  handleReset,
  handleClose,
  activePresetId,
  switchPreset,
  startCreatePreset: () => presetManagerRef.value?.startCreatePreset(),
  startEditPreset: (preset: AIPreset) => presetManagerRef.value?.startEditPreset(preset),
  savePreset: () => presetManagerRef.value?.savePreset(),
  handleDeletePreset: (id: string) => presetManagerRef.value?.handleDeletePreset(id),
  cancelEditPreset: () => presetManagerRef.value?.cancelEditPreset(),
})
</script>

<template>
  <Transition name="fade">
    <div
      v-if="modelValue"
      class="absolute inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <Transition name="scale">
        <div
          v-if="modelValue"
          class="flex h-full w-full flex-col overflow-hidden rounded-2xl bg-background shadow-2xl transition-all duration-300 sm:h-auto sm:max-h-[85vh] sm:max-w-2xl sm:border sm:border-border/50"
        >
          <!-- Header -->
          <div
            class="relative flex shrink-0 items-center justify-between border-b border-border/50 bg-gradient-to-r from-primary/5 via-background to-background px-6 py-4 sm:px-8"
          >
            <div class="absolute top-0 right-12 h-16 w-40 bg-primary/10 blur-[44px]" />
            <div class="relative flex items-center gap-3">
              <div
                class="relative flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10"
              >
                <div class="absolute inset-0 rounded-xl border border-primary/10" />
                <AiLuminaIcon :size="15" class="relative text-primary" />
              </div>
              <h2 class="text-[15px] font-bold tracking-tight text-foreground/90">
                {{ t('ai.settings') }}
              </h2>
            </div>
            <button
              class="group relative flex h-8 w-8 items-center justify-center rounded-full transition-all hover:bg-primary/10 active:scale-90"
              @click="handleClose"
            >
              <X
                :size="16"
                stroke-width="2.5"
                class="text-muted-foreground transition-colors group-hover:text-primary"
              />
            </button>
          </div>

          <!-- Body: left nav + right content -->
          <div class="flex min-h-0 flex-1">
            <!-- Left sidebar nav -->
            <nav
              class="no-scrollbar flex w-[164px] shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-border/40 bg-muted/10 px-2 py-3"
            >
              <button
                v-for="item in navItems"
                :key="item.id"
                class="group flex items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] font-medium transition-all"
                :class="
                  activeTab === item.id
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted/30 hover:text-foreground'
                "
                @click="activeTab = item.id"
              >
                <component
                  :is="item.icon"
                  :size="15"
                  :class="activeTab === item.id ? 'text-primary' : ''"
                />
                <span class="truncate">{{ t(item.labelKey) }}</span>
              </button>
            </nav>

            <!-- Right content area -->
            <div class="custom-scrollbar min-w-0 flex-1 overflow-y-auto">
              <AISettingsAppearance v-if="activeTab === 'appearance'" />

              <AISettingsBasic
                v-else-if="activeTab === 'settings'"
                v-model="formData"
                :presets="presets"
                :skills="skills"
              />

              <AIPresetManager v-else-if="activeTab === 'presets'" ref="presetManagerRef" />

              <AISkillManager v-else-if="activeTab === 'skills'" v-model="formData" />

              <AIMemoryManager
                v-else-if="activeTab === 'memory'"
                v-model="formData"
                :presets="presets"
              />

              <AISettingsBasic
                v-else-if="activeTab === 'contextCompression'"
                v-model="formData"
                :presets="presets"
                :skills="skills"
                mode="contextCompression"
              />

              <AIWebSearchConfig v-else-if="activeTab === 'webSearch'" />

              <McpSettingsManager v-else-if="activeTab === 'mcp'" />
            </div>
          </div>

          <!-- Footer -->
          <div
            class="flex shrink-0 flex-col gap-3 border-t border-border bg-muted/5 px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-5"
          >
            <div class="flex w-full items-center sm:w-auto">
              <button
                class="group flex w-full items-center justify-start gap-2 whitespace-nowrap text-xs font-medium text-muted-foreground transition-all hover:text-foreground sm:w-auto"
                @click="handleReset"
              >
                <RotateCcw :size="14" class="transition-transform group-hover:-rotate-45" />
                {{ t('ai.resetToDefault') }}
              </button>
            </div>
            <div class="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
              <button
                v-if="activeTab === 'settings' && !formData.discussionMode"
                class="w-full whitespace-nowrap rounded-xl border border-border bg-muted/30 px-4 py-2 text-sm font-bold tracking-tight text-foreground transition-all hover:border-primary/40 hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                :disabled="!canSyncToPreset"
                @click="handleSyncToPreset"
              >
                {{ t('ai.syncToActivePreset') }}
              </button>
              <button
                v-if="activeTab === 'settings' && !formData.discussionMode"
                class="w-full whitespace-nowrap rounded-xl border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-bold tracking-tight text-primary transition-all hover:border-primary/50 hover:bg-primary/20 disabled:cursor-not-allowed disabled:border-border disabled:bg-muted/50 disabled:text-muted-foreground/50 sm:w-auto"
                :disabled="isDuplicatePreset"
                @click="handleSaveAsPreset"
              >
                {{ t('ai.saveAsPreset') }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>

  <!-- 保存为预设确认弹窗 -->
  <AlertDialog :open="showSaveAsPresetConfirm" @update:open="showSaveAsPresetConfirm = $event">
    <AlertDialogContent class="rounded-2xl">
      <AlertDialogHeader>
        <AlertDialogTitle>{{ t('ai.saveAsPresetTitle') }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ t('ai.saveAsPresetDescription') }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <div class="py-4">
        <label :for="presetNameInputId" class="sr-only">{{
          t('ai.saveAsPresetPlaceholder')
        }}</label>
        <input
          :id="presetNameInputId"
          v-model="saveAsPresetName"
          name="save-as-preset-name"
          type="text"
          :placeholder="t('ai.saveAsPresetPlaceholder')"
          class="w-full rounded-lg border border-border bg-muted/30 px-4 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
          @keyup.enter="confirmSaveAsPreset"
        />
      </div>
      <AlertDialogFooter>
        <AlertDialogCancel>{{ t('common.cancel') }}</AlertDialogCancel>
        <AlertDialogAction
          class="bg-primary text-primary-foreground hover:bg-primary-hover"
          :disabled="!saveAsPresetName.trim()"
          @click="confirmSaveAsPreset"
        >
          {{ t('common.confirm') }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.scale-enter-active,
.scale-leave-active {
  transition:
    transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
    opacity 0.2s ease;
}

.scale-enter-from,
.scale-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.no-scrollbar::-webkit-scrollbar {
  display: none;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
  border-radius: 2px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: var(--scrollbar-thumb-hover);
}
</style>
