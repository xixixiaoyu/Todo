<script setup lang="ts">
defineProps<{
  loading?: boolean
  disabled?: boolean
  fullWidth?: boolean
}>()
</script>

<template>
  <button
    type="submit"
    :disabled="disabled || loading"
    :class="[
      'relative overflow-hidden px-8 py-4 rounded-2xl font-black tracking-wide transition-all duration-500',
      'bg-primary text-primary-foreground',
      'shadow-[0_20px_40px_-12px_rgba(var(--primary-rgb),0.4)]',
      'hover:bg-primary-hover hover:shadow-[0_25px_50px_-12px_rgba(var(--primary-rgb),0.5)]',
      'focus:outline-none focus:ring-4 focus:ring-primary/20 active:scale-[0.96]',
      'disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 disabled:shadow-none',
      'transform hover:-translate-y-1.5',
      fullWidth ? 'w-full' : '',
    ]"
  >
    <div
      v-if="!disabled && !loading"
      class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full hover:animate-[shimmer_1.5s_infinite] pointer-events-none"
    ></div>
    <span v-if="loading" class="flex items-center justify-center gap-2">
      <svg
        class="animate-spin h-5 w-5"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          class="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          stroke-width="4"
        ></circle>
        <path
          class="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        ></path>
      </svg>
      <slot name="loading" />
    </span>
    <slot v-else />
  </button>
</template>

<style scoped>
@keyframes shimmer {
  100% {
    transform: translateX(100%);
  }
}
</style>
