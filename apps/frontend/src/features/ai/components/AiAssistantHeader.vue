<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useWindowSize } from '@vueuse/core'
import { Clover, Maximize2, Minimize2, X } from 'lucide-vue-next'
import { nativeService } from '@/services/native'

defineProps<{
  isMaximized: boolean
}>()

defineEmits<{
  (e: 'toggleMaximize'): void
  (e: 'close'): void
}>()

const { t } = useI18n()
const { width: windowWidth } = useWindowSize()
const isWails = computed(() => nativeService.platform === 'wails')
const isDesktop = computed(() => isWails.value)
const isMac = computed(() => isWails.value && navigator.platform.toLowerCase().includes('mac'))
const isMobile = computed(() => !isDesktop.value && windowWidth.value < 640)
</script>

<template>
  <header
    class="flex h-14 shrink-0 items-center justify-between border-b border-primary/10 bg-primary/5 backdrop-blur-md px-6 z-10 shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
    :class="[isDesktop ? 'select-none cursor-default' : '']"
    style="--wails-draggable: drag"
    data-wails-drag
  >
    <div
      class="flex items-center gap-2.5 transition-all duration-300"
      :class="[isDesktop && isMac ? 'pl-20' : '']"
    >
      <div
        class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary shadow-[0_2px_8px_hsl(var(--primary)_/_0.2)]"
      >
        <Clover :size="18" class="animate-pulse-slow" />
      </div>
      <span
        class="text-[14px] font-bold tracking-tight bg-gradient-to-br from-primary via-foreground/90 to-foreground/70 bg-clip-text text-transparent"
        >{{ t('ai.assistant') }}</span
      >
    </div>
    <div class="flex items-center gap-1.5">
      <!-- 最大化/最小化 -->
      <button
        v-if="!isMobile"
        class="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-all hover:bg-primary/10 hover:text-primary active:scale-95"
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

<style scoped></style>
