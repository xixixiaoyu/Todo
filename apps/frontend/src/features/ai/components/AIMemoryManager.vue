<script setup lang="ts">
import type { AIConfig, AIPreset } from '@/features/ai/composables/useAIConfig'
import AIMemorySettingsPanel from '@/features/ai/components/AIMemorySettingsPanel.vue'
import AIMemoryListPanel from '@/features/ai/components/AIMemoryListPanel.vue'

defineProps<{
  presets: AIPreset[]
}>()

const formData = defineModel<AIConfig>({ required: true })
</script>

<template>
  <div class="space-y-5 px-6 py-5">
    <AIMemorySettingsPanel
      v-model:memory-model-id="formData.memoryModelId"
      :presets="presets"
      :current-main-model="formData.model"
    />
    <AIMemoryListPanel />
  </div>
</template>
