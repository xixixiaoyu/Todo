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
  <div class="group space-y-2">
    <label
      class="block text-sm font-semibold text-foreground/80 transition-colors group-focus-within:text-primary"
    >
      {{ label }}
    </label>
    <div class="relative">
      <div
        v-if="$slots.icon"
        class="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/60 transition-colors group-focus-within:text-primary"
      >
        <slot name="icon" />
      </div>
      <input
        v-model="inputValue"
        :type="type || 'text'"
        :placeholder="placeholder"
        :disabled="disabled"
        :class="[
          'w-full px-4 py-3.5 rounded-2xl border bg-card/50 transition-all duration-300',
          'placeholder:text-muted-foreground/40',
          'focus:outline-none focus:ring-4 focus:ring-primary/10 focus:bg-card',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          $slots.icon ? 'pl-12' : 'px-5',
          error
            ? 'border-error focus:ring-error/10'
            : 'border-border hover:border-primary/40 focus:border-primary',
        ]"
      />
    </div>
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="transform -translate-y-2 opacity-0"
      enter-to-class="transform translate-y-0 opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="transform translate-y-0 opacity-100"
      leave-to-class="transform -translate-y-2 opacity-0"
    >
      <p v-if="error" class="text-xs font-medium text-error flex items-center gap-1 px-1">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          class="w-3.5 h-3.5"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        {{ error }}
      </p>
    </Transition>
  </div>
</template>
