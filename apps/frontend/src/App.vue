<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import ToastProvider from '@/components/ui/ToastProvider.vue'
import { TooltipProvider } from '@/components/ui/tooltip'
import { isWails } from '@/lib/wails'

onMounted(() => {
  if (isWails()) {
    document.body.classList.add('is-wails')
  }
})
</script>

<template>
  <TooltipProvider>
    <div
      class="h-screen flex flex-col overflow-hidden bg-background text-foreground transition-colors duration-300"
    >
      <!-- Wails 顶部拖拽区域 (macOS HiddenInset 模式下需要) -->
      <div
        v-if="isWails()"
        class="wails-drag h-8 shrink-0 flex items-center justify-center"
        style="--wails-draggable: drag"
      >
        <span
          class="text-[10px] text-muted-foreground/30 font-medium tracking-widest uppercase opacity-0 group-hover:opacity-100 transition-opacity"
        >
          Todo
        </span>
      </div>

      <main class="flex-1 min-h-0 relative">
        <RouterView />
      </main>

      <ToastProvider />
    </div>
  </TooltipProvider>
</template>

<style>
/* 确保 App.vue 的内容不会被拖拽覆盖 */
.wails-drag {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 50;
}

/* Wails 拖拽区域内的交互元素需要显式设置为 no-drag */
[style*='--wails-draggable: drag'] button,
[style*='--wails-draggable: drag'] a,
[style*='--wails-draggable: drag'] input,
[style*='--wails-draggable: drag'] [role='button'] {
  --wails-draggable: no-drag;
}
</style>
