<script setup lang="ts">
import { Languages } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { useTranslationEditor } from '../composables/useTranslationEditor'
import { useAIConfig } from '@/features/ai/composables/useAIConfig'
import EditorDialog from './EditorDialog.vue'
import TranslationPanel from '@/features/ai/components/TranslationPanel.vue'

const { t } = useI18n()
const { isOpen, closeEditor } = useTranslationEditor()
const { config } = useAIConfig()
</script>

<template>
  <EditorDialog
    :is-open="isOpen"
    :title="t('ai.translationEditorTitle')"
    :icon="Languages"
    size="sm"
    @close="closeEditor"
  >
    <div class="h-full overflow-auto px-6 py-4">
      <TranslationPanel :config="config" />
    </div>
  </EditorDialog>
</template>
