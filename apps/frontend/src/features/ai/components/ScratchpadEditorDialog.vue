<script setup lang="ts">
import { ClipboardPaste } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { useScratchpadEditor } from '../composables/useScratchpadEditor'
import EditorDialog from './EditorDialog.vue'
import TodoScratchpad from '@/features/todo/components/TodoScratchpad.vue'

const { t } = useI18n()
const { isOpen, closeEditor } = useScratchpadEditor()
</script>

<template>
  <EditorDialog
    :is-open="isOpen"
    :title="t('ai.scratchpadEditorTitle')"
    :icon="ClipboardPaste"
    size="md"
    @close="closeEditor"
  >
    <div class="h-full overflow-auto px-6 py-4">
      <TodoScratchpad />
    </div>
  </EditorDialog>
</template>
