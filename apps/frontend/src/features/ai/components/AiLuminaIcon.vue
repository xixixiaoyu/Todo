<script setup lang="ts">
/**
 * Lumina AI Icon Component
 * A custom, elegant 4-pointed star icon representing the "Lumina" AI.
 */
interface Props {
  size?: number | string
  class?: string | object | (string | object)[]
}

const props = withDefaults(defineProps<Props>(), {
  size: 24,
  class: '',
})
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    :class="props.class"
  >
    <!-- 1. 核心能量场：具有流动感的四叶草形态 -->
    <path
      d="M12 12C12 12 12 8 15 5C18 2 22 6 19 9C16 12 12 12 12 12Z"
      fill="currentColor"
      class="opacity-90"
    />
    <path
      d="M12 12C12 12 16 12 19 15C22 18 18 22 15 19C12 16 12 12 12 12Z"
      fill="currentColor"
      class="opacity-70"
    />
    <path
      d="M12 12C12 12 12 16 9 19C6 22 2 18 5 15C8 12 12 12 12 12Z"
      fill="currentColor"
      class="opacity-50"
    />
    <path
      d="M12 12C12 12 8 12 5 9C2 6 6 2 9 5C12 8 12 12 12 12Z"
      fill="currentColor"
      class="opacity-30"
    />

    <!-- 2. 智慧核心：中心汇聚点 -->
    <circle cx="12" cy="12" r="1.5" fill="white" />
    <circle cx="12" cy="12" r="3" stroke="white" stroke-width="0.5" opacity="0.4" />
  </svg>
</template>
