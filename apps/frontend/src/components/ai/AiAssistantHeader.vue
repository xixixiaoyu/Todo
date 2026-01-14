<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Clover, Maximize2, Minimize2, X } from 'lucide-vue-next'

defineProps<{
  isMaximized: boolean
}>()

defineEmits<{
  (e: 'toggleMaximize'): void
  (e: 'close'): void
}>()

const { t } = useI18n()
</script>

<template>
  <header
    class="flex h-14 shrink-0 items-center justify-between bg-primary/95 px-4 backdrop-blur-md shadow-sm z-10"
  >
    <div class="flex items-center gap-2">
      <div
        class="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white shadow-inner"
      >
        <Clover :size="18" class="animate-pulse-slow" />
      </div>
      <span class="text-[15px] font-semibold tracking-tight text-white">{{
        t('ai.assistant')
      }}</span>
    </div>
    <div class="flex items-center gap-2">
      <!-- 最大化/最小化 -->
      <button
        class="flex h-7 w-7 items-center justify-center rounded-md text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        @click="$emit('toggleMaximize')"
      >
        <Maximize2 v-if="!isMaximized" :size="16" />
        <Minimize2 v-else :size="16" />
      </button>
      <!-- 关闭按钮 -->
      <button
        class="flex h-7 w-7 items-center justify-center rounded-md text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        @click="$emit('close')"
      >
        <X :size="16" />
      </button>
    </div>
  </header>
</template>
