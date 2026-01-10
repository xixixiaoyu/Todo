<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  modelValue: string | undefined
  label: string
  placeholder?: string
  type?: 'text' | 'email' | 'password'
  error?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | undefined]
}>()

const inputValue = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})
</script>

<template>
  <div class="space-y-2">
    <label class="block text-sm font-medium text-foreground">
      {{ label }}
    </label>
    <input
      v-model="inputValue"
      :type="type || 'text'"
      :placeholder="placeholder"
      :disabled="disabled"
      :class="[
        'w-full px-4 py-3 rounded-xl border bg-card transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        error ? 'border-error focus:ring-error' : 'border-border hover:border-primary/50',
      ]"
    />
    <p v-if="error" class="text-sm text-error">
      {{ error }}
    </p>
  </div>
</template>
