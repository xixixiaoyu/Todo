<script setup lang="ts">
defineProps<{
  images: string[]
  isUser: boolean
  isMobile: boolean
}>()

defineEmits<{
  (e: 'openImage', url: string): void
}>()
</script>

<template>
  <div class="mb-2 flex flex-wrap gap-2" :class="isUser ? 'justify-end' : 'justify-start'">
    <div
      v-for="(img, index) in images"
      :key="index"
      :class="[
        'group relative overflow-hidden rounded-lg border border-white/20 bg-black/5 shadow-sm transition-all hover:scale-105 cursor-zoom-in',
        isMobile ? 'h-16 w-16' : 'h-20 w-20',
      ]"
      @click="$emit('openImage', img)"
    >
      <img :src="img" class="h-full w-full object-cover" />
      <div
        class="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/10 group-hover:opacity-100"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="15 3 21 3 21 9" />
          <polyline points="9 21 3 21 3 15" />
          <line x1="21" y1="3" x2="14" y2="10" />
          <line x1="3" y1="21" x2="10" y2="14" />
        </svg>
      </div>
    </div>
  </div>
</template>
