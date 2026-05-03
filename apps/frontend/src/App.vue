<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import { useTodoStore } from '@/features/todo/stores/todo'
import ToastProvider from '@/components/ui/ToastProvider.vue'
import AIAnonymousMigrationDialog from '@/features/ai/components/AIAnonymousMigrationDialog.vue'
import BottomTabBar from '@/components/BottomTabBar.vue'
import { TooltipProvider } from '@/components/ui/tooltip'
import { nativeService } from '@/services/native'
import { useTheme } from '@/composables/useTheme'

// 初始化主题
useTheme()

const route = useRoute()

const showTabBar = computed(() => {
  const path = route.path
  // 隐藏导航栏的路由：认证页面、设置、404
  const hiddenPaths = [
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
    '/settings/mcp',
  ]
  if (hiddenPaths.some((p) => path.startsWith(p))) return false
  // 404 catch-all 也不显示
  if (path !== '/' && !path.startsWith('/novel') && !path.startsWith('/teaching')) return false
  return true
})

const todoStore = useTodoStore()

onMounted(() => {
  if (nativeService.platform === 'wails') {
    document.body.classList.add('is-wails')
  }

  // 初始化全局 WebSocket 监听
  void todoStore.initSocketListener()
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
      <div
        v-if="nativeService.platform === 'wails'"
        class="wails-drag h-8 shrink-0 flex items-center justify-center cursor-default select-none"
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

      <BottomTabBar v-if="showTabBar" />

      <ToastProvider />
      <AIAnonymousMigrationDialog />
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
