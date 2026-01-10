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
  <div
    class="mb-4 flex items-center gap-3 rounded-xl border border-[#e8e4dd] bg-white px-4 py-3 dark:border-[#3a3a3a] dark:bg-[#2a2a2a]"
  >
    <Search :size="18" class="text-[#8b8680] dark:text-[#6b6b6b]" />
    <input
      :value="modelValue"
      type="text"
      :placeholder="t('todo.searchPlaceholder')"
      class="flex-1 bg-transparent text-[#3a3a3a] outline-none placeholder:text-[#c4c0b8] dark:text-[#e0e0e0] dark:placeholder:text-[#6b6b6b]"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <button
      v-if="modelValue"
      class="text-[#8b8680] hover:text-[#3a3a3a] dark:text-[#6b6b6b] dark:hover:text-[#e0e0e0]"
      @click="emit('clear')"
    >
      <X :size="18" />
    </button>
  </div>
</template>
