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
          ? 'bg-primary text-primary-foreground'
          : 'border border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground'
      "
      @click="emit('update:filter', 'pending')"
    >
      {{ t('todo.pending') }}
    </button>
    <button
      class="rounded-full px-5 py-2 text-sm font-medium transition-all"
      :class="
        filter === 'completed'
          ? 'bg-primary text-primary-foreground'
          : 'border border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground'
      "
      @click="emit('update:filter', 'completed')"
    >
      {{ t('todo.completed') }}
    </button>
  </div>
</template>
