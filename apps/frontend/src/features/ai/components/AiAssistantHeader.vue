<script setup lang="ts">
import { computed } from 'vue'
import { useWindowSize } from '@vueuse/core'
import { Maximize2, Minimize2, X, PanelRightClose, PanelRightOpen } from 'lucide-vue-next'
import { nativeService } from '@/services/native'

withDefaults(
  defineProps<{
    isMaximized: boolean
    workspaceCollapsed?: boolean
    showClose?: boolean
    showMaximize?: boolean
  }>(),
  {
    showClose: true,
    showMaximize: true,
  },
)

defineEmits<{
  (e: 'toggleMaximize'): void
  (e: 'close'): void
  (e: 'toggleWorkspace'): void
}>()

const { width: windowWidth } = useWindowSize()
const isWails = computed(() => nativeService.platform === 'wails')
const isDesktop = computed(() => isWails.value)
const isMobile = computed(() => !isDesktop.value && windowWidth.value < 640)
</script>

<template>
  <header
    class="flex h-10 shrink-0 items-center justify-between gap-1 border-b border-border/20 bg-background/30 backdrop-blur-md px-3 z-10"
    :class="[isDesktop ? 'select-none cursor-default' : '']"
    style="--wails-draggable: drag"
    data-wails-drag
  >
    <!-- 右侧：工作区 / 最大化 / 关闭 -->
    <div class="flex items-center gap-1">
      <button
        v-if="workspaceCollapsed !== undefined"
        class="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-all hover:bg-accent hover:text-foreground active:scale-95"
        :title="workspaceCollapsed ? '展开工作区' : '折叠工作区'"
        @click="$emit('toggleWorkspace')"
      >
        <PanelRightOpen v-if="workspaceCollapsed" :size="14" />
        <PanelRightClose v-else :size="14" />
      </button>
      <button
        v-if="!isMobile && showMaximize"
        class="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-all hover:bg-accent hover:text-foreground active:scale-95"
        @click="$emit('toggleMaximize')"
      >
        <Maximize2 v-if="!isMaximized" :size="14" />
        <Minimize2 v-else :size="14" />
      </button>
      <button
        v-if="showClose"
        class="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive active:scale-95"
        @click="$emit('close')"
      >
        <X :size="14" />
      </button>
    </div>
  </header>
</template>
