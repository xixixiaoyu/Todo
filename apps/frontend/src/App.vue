<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import { useTodoStore } from '@/features/todo/stores/todo'
import ToastProvider from '@/components/ui/ToastProvider.vue'
import AIAnonymousMigrationDialog from '@/features/ai/components/AIAnonymousMigrationDialog.vue'
import { TooltipProvider } from '@/components/ui/tooltip'
import { nativeService } from '@/services/native'
import { useTheme } from '@/composables/useTheme'

// 初始化主题
useTheme()

const todoStore = useTodoStore()

onMounted(() => {
  if (nativeService.platform === 'wails') {
    document.body.classList.add('is-wails')
  }

  // 初始化全局 WebSocket 监听
})

const handleDblClick = () => {
  void nativeService.toggleMaximise()
}
</script>

<template>
  <TooltipProvider>
    <div
      class="h-screen flex flex-col overflow-hidden bg-background text-foreground transition-colors duration-300"
    >
      <!-- Wails 顶部拖拽区域 (macOS HiddenInset 模式下需要) -->
      <!-- 使用 pointer-events: none 让点击穿透到下层交互元素 -->
      <div
        v-if="nativeService.platform === 'wails'"
        class="wails-drag h-8 shrink-0 flex items-center justify-center cursor-default select-none pointer-events-none"
        style="--wails-draggable: drag"
        @dblclick="handleDblClick"
      >
        <span
          class="text-[10px] text-muted-foreground/30 font-medium tracking-widest uppercase opacity-0 group-hover:opacity-100 transition-opacity"
        >
          Lumina
        </span>
      </div>

      <main class="flex-1 min-h-0 relative">
        <RouterView />
      </main>

      <ToastProvider />
      <AIAnonymousMigrationDialog />
    </div>
  </TooltipProvider>
</template>

<style>
/* Wails 拖拽手柄 — 仅作为系统标题栏占位，点击事件穿透到下层 */
.wails-drag {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 50;
}
</style>
