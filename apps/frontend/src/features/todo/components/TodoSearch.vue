<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Search, X } from 'lucide-vue-next'

const { t } = useI18n()

defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  clear: []
}>()
</script>

<template>
  <div class="mb-4 flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
    <Search :size="18" class="text-muted-foreground" />
    <input
      :value="modelValue"
      type="text"
      :placeholder="t('todo.searchPlaceholder')"
      class="flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground/60"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <button
      v-if="modelValue"
      class="text-muted-foreground hover:text-foreground"
      @click="emit('clear')"
    >
      <X :size="18" />
    </button>
  </div>
</template>
