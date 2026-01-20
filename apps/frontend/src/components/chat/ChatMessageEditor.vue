<script setup lang="ts">
import { ref, onMounted, nextTick, useId } from 'vue'
import { useI18n } from 'vue-i18n'

defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'save'): void
  (e: 'cancel'): void
}>()

const { t } = useI18n()
const editInputRef = ref<HTMLTextAreaElement>()
const textareaId = useId()

function adjustEditHeight() {
  const textarea = editInputRef.value
  if (textarea) {
    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight}px`
  }
}

function handleInput(e: Event) {
  const target = e.target as HTMLTextAreaElement
  emit('update:modelValue', target.value)
  adjustEditHeight()
}

onMounted(() => {
  void nextTick(() => {
    editInputRef.value?.focus()
    adjustEditHeight()
  })
})
</script>

<template>
  <div class="flex flex-col gap-2">
    <label :for="textareaId" class="sr-only">{{ t('ai.editMessage') }}</label>
    <textarea
      :id="textareaId"
      ref="editInputRef"
      name="chat-message-edit"
      :value="modelValue"
      class="w-full min-w-[280px] resize-none bg-transparent text-sm leading-relaxed outline-none"
      rows="1"
      @input="handleInput"
      @keydown.esc="emit('cancel')"
      @keydown.enter.ctrl.exact="emit('save')"
      @keydown.enter.meta.exact="emit('save')"
    />
    <div class="flex justify-end gap-2 border-t border-border pt-2">
      <button
        class="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        @click="emit('cancel')"
      >
        {{ t('ai.cancel') }}
      </button>
      <button
        class="rounded bg-primary px-2 py-1 text-xs text-primary-foreground hover:bg-primary-hover"
        @click="emit('save')"
      >
        {{ t('ai.save') }}
      </button>
    </div>
  </div>
</template>
