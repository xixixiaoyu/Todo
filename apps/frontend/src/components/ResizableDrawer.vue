<script setup lang="ts">
import { ref, computed, watch, onMounted, type CSSProperties, toRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useEscClose } from '@/composables/useEscClose'
import { useWindowSize } from '@vueuse/core'

interface Props {
  modelValue: boolean
  defaultWidth?: number
  minWidth?: number
  maxWidth?: number
  rightGap?: number // 距离右边的最小间距（px）
  storageKey?: string
  isFullscreen?: boolean // 是否全屏
}

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(defineProps<Props>(), {
  defaultWidth: 320,
  minWidth: 200,
  rightGap: 48,
  storageKey: 'resizable-drawer-width',
  isFullscreen: false,
  maxWidth: undefined,
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const { t } = useI18n()
const drawerWidth = ref(props.defaultWidth)
const isResizing = ref(false)
const startX = ref(0)
const startWidth = ref(0)
const isHovering = ref(false)
const { width: windowWidth } = useWindowSize()

// 移动端检测
const isMobile = computed(() => windowWidth.value < 640)

const resolvedMaxWidth = computed(() => {
  const windowLimit = windowWidth.value - props.rightGap
  return props.maxWidth ? Math.min(props.maxWidth, windowLimit) : windowLimit
})

function clampWidth(width: number) {
  return Math.max(props.minWidth, Math.min(resolvedMaxWidth.value, width))
}

watch(windowWidth, () => {
  drawerWidth.value = clampWidth(drawerWidth.value)
})

onMounted(() => {
  const savedWidth = localStorage.getItem(props.storageKey)
  if (savedWidth) {
    drawerWidth.value = clampWidth(Number(savedWidth))
  }
})

watch(drawerWidth, (newWidth) => {
  localStorage.setItem(props.storageKey, String(newWidth))
})

const drawerStyle = computed(() => ({
  width: props.isFullscreen ? '100%' : isMobile.value ? '100%' : `${drawerWidth.value}px`,
}))

const overlayStyle = computed<CSSProperties>(() => ({
  opacity: props.modelValue ? '1' : '0',
  pointerEvents: props.modelValue ? 'auto' : 'none',
}))

function startResize(e: MouseEvent) {
  e.preventDefault()
  isResizing.value = true
  startX.value = e.clientX
  startWidth.value = drawerWidth.value
  document.body.style.cursor = 'ew-resize'
  document.body.style.userSelect = 'none'
  document.addEventListener('mousemove', onResize)
  document.addEventListener('mouseup', stopResize)
}

function onResize(e: MouseEvent) {
  if (!isResizing.value) return
  drawerWidth.value = clampWidth(startWidth.value + e.clientX - startX.value)
}

function stopResize() {
  isResizing.value = false
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', stopResize)
}

function closeDrawer() {
  emit('update:modelValue', false)
}

// 使用公共 Composable 处理 ESC 关闭
useEscClose(toRef(props, 'modelValue'), closeDrawer)

watch(
  () => props.modelValue,
  (newValue) => {
    document.body.style.overflow = newValue ? 'hidden' : ''
  },
)
</script>

<template>
  <Teleport to="body">
    <!-- 遮罩层 -->
    <Transition name="fade">
      <div v-if="modelValue" class="drawer-overlay" :style="overlayStyle" @click="closeDrawer" />
    </Transition>

    <!-- 抽屉 -->
    <Transition name="slide">
      <div
        v-if="modelValue"
        class="drawer"
        :style="drawerStyle"
        role="dialog"
        aria-modal="true"
        v-bind="$attrs"
      >
        <!-- 抽屉内容 -->
        <div class="drawer-content">
          <slot />
        </div>

        <!-- 拖拽手柄（移动端或全屏时隐藏） -->
        <div
          v-if="!isMobile && !isFullscreen"
          class="resize-handle"
          :class="{
            hovering: isHovering,
            resizing: isResizing,
          }"
          role="separator"
          aria-orientation="vertical"
          :aria-label="t('common.resizeDrawer')"
          tabindex="0"
          @mouseenter="isHovering = true"
          @mouseleave="isHovering = false"
          @mousedown="startResize"
        >
          <div class="resize-handle-line" />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* 遮罩层 */
.drawer-overlay {
  position: fixed;
  inset: 0;
  z-index: 40;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

/* 抽屉主体 */
.drawer {
  position: fixed;
  top: 0;
  left: 0;
  height: 100%;
  z-index: 50;
  display: flex;
  background: hsl(var(--background));
  border-right: 1px solid hsl(var(--border) / 0.6);
  box-shadow: 10px 0 30px -15px rgba(0, 0, 0, 0.08);
}

:root.dark .drawer {
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
}

/* 抽屉内容区 */
.drawer-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  overscroll-behavior: contain;
}

/* 自定义滚动条 */
.drawer-content::-webkit-scrollbar {
  width: 6px;
}

.drawer-content::-webkit-scrollbar-track {
  background: transparent;
}

.drawer-content::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 3px;
}

.drawer-content::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.2);
}

:root.dark .drawer-content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
}

:root.dark .drawer-content::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}

/* 过渡动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s cubic-bezier(0.23, 1, 0.32, 1);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-enter-active {
  transition: transform 0.3s cubic-bezier(0.23, 1, 0.32, 1);
}

.slide-leave-active {
  transition: transform 0.25s cubic-bezier(0.23, 1, 0.32, 1);
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(-100%);
}

/* 拖拽手柄 */
.resize-handle {
  position: absolute;
  top: 0;
  right: -4px;
  width: 8px;
  height: 100%;
  cursor: ew-resize;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  transform: translateZ(0);
  will-change: background-color;
  background: transparent;
}

.resize-handle:hover,
.resize-handle.hovering {
  background: rgba(var(--primary), 0.04);
}

.resize-handle.resizing {
  background: rgba(var(--primary), 0.08);
}

:root.dark .resize-handle:hover,
:root.dark .resize-handle.hovering {
  background: rgba(255, 255, 255, 0.02);
}

:root.dark .resize-handle.resizing {
  background: rgba(255, 255, 255, 0.04);
}

/* 指示线 */
.resize-handle-line {
  width: 4px;
  height: 40px;
  background: hsl(var(--border));
  border-radius: 2px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  opacity: 0.4;
  position: relative;
}

.resize-handle-line::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 2px;
  height: 12px;
  background: hsl(var(--foreground) / 0.1);
  border-radius: 1px;
  transition: all 0.3s ease;
}

.resize-handle:hover .resize-handle-line,
.resize-handle.hovering .resize-handle-line,
.resize-handle.resizing .resize-handle-line {
  opacity: 1;
  width: 6px;
  height: 60px;
  background: hsl(var(--primary) / 0.2);
}

.resize-handle:hover .resize-handle-line::after,
.resize-handle.resizing .resize-handle-line::after {
  height: 24px;
  background: hsl(var(--primary));
}

.resize-handle.resizing .resize-handle-line {
  height: 80px;
  background: hsl(var(--primary) / 0.3);
}

:root.dark .resize-handle-line {
  background: rgba(148, 163, 184, 0.4);
}

:root.dark .resize-handle:hover .resize-handle-line,
:root.dark .resize-handle.hovering .resize-handle-line {
  background: rgba(148, 163, 184, 0.6);
}

:root.dark .resize-handle.resizing .resize-handle-line {
  background: rgba(148, 163, 184, 0.7);
}

/* 聚焦状态（键盘无障碍） */
.resize-handle:focus-visible {
  outline: none;
}

/* 减少动画偏好 */
@media (prefers-reduced-motion: reduce) {
  .drawer-overlay,
  .drawer,
  .resize-handle,
  .resize-handle-line {
    transition: none;
  }

  .fade-enter-active,
  .fade-leave-active,
  .slide-enter-active,
  .slide-leave-active {
    transition: none;
  }
}
</style>
