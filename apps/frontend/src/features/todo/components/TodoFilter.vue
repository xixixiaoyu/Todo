<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { FilterType } from '../stores/todo'

const { t } = useI18n()

defineProps<{
  filter: FilterType
}>()

const emit = defineEmits<{
  'update:filter': [value: FilterType]
}>()
</script>

<template>
  <div class="mb-6 flex justify-center gap-2">
    <button
      class="rounded-full px-5 py-2 text-sm font-medium transition-all"
      :class="
        filter === 'pending'
          ? 'bg-[#c9b896] text-white dark:bg-[#b8a785]'
          : 'border border-[#e8e4dd] bg-white text-[#8b8680] hover:bg-[#f5f3ed] dark:border-[#3a3a3a] dark:bg-[#2a2a2a] dark:text-[#a0a0a0] dark:hover:bg-[#3a3a3a]'
      "
      @click="emit('update:filter', 'pending')"
    >
      {{ t('todo.pending') }}
    </button>
    <button
      class="rounded-full px-5 py-2 text-sm font-medium transition-all"
      :class="
        filter === 'completed'
          ? 'bg-[#c9b896] text-white dark:bg-[#b8a785]'
          : 'border border-[#e8e4dd] bg-white text-[#8b8680] hover:bg-[#f5f3ed] dark:border-[#3a3a3a] dark:bg-[#2a2a2a] dark:text-[#a0a0a0] dark:hover:bg-[#3a3a3a]'
      "
      @click="emit('update:filter', 'completed')"
    >
      {{ t('todo.completed') }}
    </button>
  </div>
</template>
