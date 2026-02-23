<script setup lang="ts">
import { computed } from 'vue'
import { useAIPresetManager } from '@/features/ai/composables/useAIPresetManager'
import AIPresetEditorForm from './AIPresetEditorForm.vue'
import AIPresetList from './AIPresetList.vue'

const {
  presets,
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
} = useAIPresetManager()

const isEditing = computed(() => !!editingPreset.value)

defineExpose({
  isCreatingPreset,
  editingPreset,
  startCreatePreset,
  startEditPreset,
  savePreset,
  handleDeletePreset,
  cancelEditPreset,
})
</script>

<template>
  <div class="px-6 py-5">
    <input
      ref="fileInputRef"
      type="file"
      accept=".json"
      class="hidden"
      @change="handleFileChange"
    />

    <AIPresetEditorForm
      v-if="isCreatingPreset || editingPreset"
      v-model="presetForm"
      v-model:show-api-key="showPresetApiKey"
      :is-creating="isCreatingPreset"
      :is-editing="isEditing"
      :name-error="nameError"
      @cancel="cancelEditPreset"
      @save="savePreset"
    />

    <AIPresetList
      v-else
      :presets="presets"
      :active-preset-id="activePresetId"
      @create="startCreatePreset"
      @import="triggerImport"
      @export="handleExport"
      @select="switchPreset"
      @edit="startEditPreset"
      @duplicate="handleDuplicatePreset"
      @delete="handleDeletePreset"
    />
  </div>
</template>
