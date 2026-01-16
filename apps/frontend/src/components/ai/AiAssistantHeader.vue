<script setup lang="ts">
import { computed } from 'vue'
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
const isElectron = computed(() => !!window.electronAPI)
const isMac = computed(() => window.electronAPI?.platform === 'darwin')
</script>

<template>
  <header
    class="flex h-14 shrink-0 items-center justify-between border-b border-border/40 bg-background/80 px-4 backdrop-blur-xl z-10"
    :class="[isElectron ? 'drag-region select-none cursor-default' : '']"
  >
    <div
      class="flex items-center gap-2.5 transition-all duration-300"
      :class="[{ 'no-drag': isElectron }, isElectron && isMac ? 'pl-20' : '']"
    >
      <div
        class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shadow-sm"
      >
        <Clover :size="18" class="animate-pulse-slow" />
      </div>
      <span class="text-[14px] font-bold tracking-tight text-foreground/90">{{
        t('ai.assistant')
      }}</span>
    </div>
    <div class="flex items-center gap-1.5" :class="{ 'no-drag': isElectron }">
      <!-- 最大化/最小化 -->
      <button
        class="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-all hover:bg-accent hover:text-foreground active:scale-95"
        @click="$emit('toggleMaximize')"
      >
        <Maximize2 v-if="!isMaximized" :size="15" />
        <Minimize2 v-else :size="15" />
      </button>
      <!-- 关闭按钮 -->
      <button
        class="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive active:scale-95"
        @click="$emit('close')"
      >
        <X :size="16" />
      </button>
    </div>
  </header>
</template>

<style scoped>
.drag-region {
  -webkit-app-region: drag;
}

.no-drag {
  -webkit-app-region: no-drag;
}
</style>
