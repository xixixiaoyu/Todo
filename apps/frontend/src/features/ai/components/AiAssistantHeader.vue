<script setup lang="ts">
import { computed } from 'vue'
import { useWindowSize } from '@vueuse/core'
import {
  Maximize2,
  Minimize2,
  X,
  PanelRightClose,
  PanelRightOpen,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-vue-next'
import { nativeService } from '@/services/native'

defineProps<{
  isMaximized: boolean
  workspaceCollapsed?: boolean
  sessionSidebarCollapsed?: boolean
}>()

defineEmits<{
  (e: 'toggleMaximize'): void
  (e: 'close'): void
  (e: 'toggleWorkspace'): void
  (e: 'toggleSessionSidebar'): void
}>()

const { width: windowWidth } = useWindowSize()
const isWails = computed(() => nativeService.platform === 'wails')
const isDesktop = computed(() => isWails.value)
const isMac = computed(() => isWails.value && navigator.platform.toLowerCase().includes('mac'))
const isMobile = computed(() => !isDesktop.value && windowWidth.value < 640)
</script>

<template>
  <header
    class="flex h-10 shrink-0 items-center justify-between gap-1 border-b border-border/20 bg-background/30 backdrop-blur-md px-3 z-10"
    :class="[isDesktop ? 'select-none cursor-default' : '']"
    style="--wails-draggable: drag"
    data-wails-drag
  >
    <!-- 左侧：会话列表开关（macOS 留出红绿灯空间） -->
    <div class="flex items-center gap-1" :class="[isDesktop && isMac ? 'pl-16' : '']">
      <button
        class="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-all hover:bg-accent hover:text-foreground active:scale-95"
        :title="sessionSidebarCollapsed ? '展开会话列表' : '折叠会话列表'"
        @click="$emit('toggleSessionSidebar')"
      >
        <PanelLeftOpen v-if="sessionSidebarCollapsed" :size="14" />
        <PanelLeftClose v-else :size="14" />
      </button>
    </div>

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
        v-if="!isMobile"
        class="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-all hover:bg-accent hover:text-foreground active:scale-95"
        @click="$emit('toggleMaximize')"
      >
        <Maximize2 v-if="!isMaximized" :size="14" />
        <Minimize2 v-else :size="14" />
      </button>
      <button
        class="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive active:scale-95"
        @click="$emit('close')"
      >
        <X :size="14" />
      </button>
    </div>
  </header>
</template>
