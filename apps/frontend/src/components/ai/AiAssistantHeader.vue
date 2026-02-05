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
    class="flex h-14 shrink-0 items-center justify-between bg-transparent backdrop-blur-2xl z-10 px-6"
    :class="[isDesktop ? 'select-none cursor-default' : '']"
    style="--wails-draggable: drag"
    data-wails-drag
  >
    <div
      class="flex items-center gap-2.5 transition-all duration-300"
      :class="[isDesktop && isMac ? 'pl-20' : '']"
    >
      <div
        class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shadow-sm"
      >
        <Clover :size="18" class="animate-pulse-slow" />
      </div>
      <span class="text-[14px] font-semibold tracking-tight text-foreground/80">{{
        t('ai.assistant')
      }}</span>
    </div>
    <div class="flex items-center gap-1.5">
      <!-- 最大化/最小化 -->
      <button
        v-if="!isMobile"
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

<style scoped></style>
