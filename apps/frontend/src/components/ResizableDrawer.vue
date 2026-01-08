<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, type CSSProperties } from 'vue'

interface Props {
  modelValue: boolean
  defaultWidth?: number
  minWidth?: number
  rightGap?: number // 距离右边的最小间距（px）
  storageKey?: string
}

const props = withDefaults(defineProps<Props>(), {
  defaultWidth: 320,
  minWidth: 200,
  rightGap: 48,
  storageKey: 'resizable-drawer-width',
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const drawerWidth = ref(props.defaultWidth)
const isResizing = ref(false)
const startX = ref(0)
const startWidth = ref(0)
const isHovering = ref(false)
const windowWidth = ref(window.innerWidth)

const maxWidth = computed(() => windowWidth.value - props.rightGap)

function clampWidth(width: number) {
  return Math.max(props.minWidth, Math.min(maxWidth.value, width))
}

function handleWindowResize() {
  windowWidth.value = window.innerWidth
  drawerWidth.value = clampWidth(drawerWidth.value)
}

onMounted(() => {
  window.addEventListener('resize', handleWindowResize)
  const savedWidth = localStorage.getItem(props.storageKey)
  if (savedWidth) {
    drawerWidth.value = clampWidth(Number(savedWidth))
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', handleWindowResize)
})

watch(drawerWidth, (newWidth) => {
  localStorage.setItem(props.storageKey, String(newWidth))
})

const drawerStyle = computed(() => ({
  width: `${drawerWidth.value}px`,
  transform: props.modelValue ? 'translateX(0)' : 'translateX(-100%)',
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
      <div
        v-if="modelValue"
        class="fixed inset-0 bg-black/50 z-40"
        :style="overlayStyle"
        @click="closeDrawer"
      />
    </Transition>

    <!-- 抽屉 -->
    <Transition name="slide">
      <div
        v-if="modelValue"
        class="fixed top-0 left-0 h-full bg-white shadow-2xl z-50 flex"
        :style="drawerStyle"
      >
        <!-- 抽屉内容 -->
        <div class="flex-1 overflow-y-auto">
          <slot />
        </div>

        <!-- 拖拽手柄 -->
        <div
          class="resize-handle relative"
          :class="{
            hovering: isHovering,
            resizing: isResizing,
          }"
          @mouseenter="isHovering = true"
          @mouseleave="isHovering = false"
          @mousedown="startResize"
        >
          <!-- 中心线条 -->
          <div class="resize-handle-line" />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(-100%);
}

/* 拖拽手柄基础样式 */
.resize-handle {
  position: absolute;
  top: 0;
  right: -3px;
  width: 6px;
  height: 100%;
  cursor: ew-resize;
  z-index: 10;
  background: linear-gradient(
    90deg,
    rgba(148, 163, 184, 0.05) 0%,
    rgba(148, 163, 184, 0.1) 50%,
    rgba(148, 163, 184, 0.05) 100%
  );
  transition: all 0.2s ease;
  transform: translateZ(0);
  backface-visibility: hidden;
}

/* 悬停状态 */
.resize-handle.hovering {
  right: -8px;
  width: 16px;
  background: linear-gradient(
    90deg,
    rgba(59, 130, 246, 0.05) 0%,
    rgba(59, 130, 246, 0.1) 50%,
    rgba(59, 130, 246, 0.05) 100%
  );
  box-shadow: 0 0 8px rgba(59, 130, 246, 0.15);
}

/* 拖拽中状态 */
.resize-handle.resizing {
  right: -10px;
  width: 20px;
  background: linear-gradient(
    90deg,
    rgba(59, 130, 246, 0.08) 0%,
    rgba(59, 130, 246, 0.15) 50%,
    rgba(59, 130, 246, 0.08) 100%
  );
  box-shadow: 0 0 12px rgba(59, 130, 246, 0.25);
}

/* 中心线条 */
.resize-handle-line {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 2px;
  height: 32px;
  background: linear-gradient(
    180deg,
    rgba(148, 163, 184, 0.2) 0%,
    rgba(148, 163, 184, 0.4) 50%,
    rgba(148, 163, 184, 0.2) 100%
  );
  border-radius: 2px;
  box-shadow: 0 0 2px rgba(148, 163, 184, 0.1);
  transition: all 0.2s ease;
}

/* 悬停时中心线条 */
.resize-handle.hovering .resize-handle-line {
  width: 3px;
  height: 48px;
  background: linear-gradient(
    180deg,
    rgba(59, 130, 246, 0.25) 0%,
    rgba(59, 130, 246, 0.5) 50%,
    rgba(59, 130, 246, 0.25) 100%
  );
  box-shadow: 0 0 4px rgba(59, 130, 246, 0.2);
}

/* 拖拽时中心线条 */
.resize-handle.resizing .resize-handle-line {
  width: 4px;
  height: 64px;
  background: linear-gradient(
    180deg,
    rgba(59, 130, 246, 0.3) 0%,
    rgba(59, 130, 246, 0.6) 50%,
    rgba(59, 130, 246, 0.3) 100%
  );
  box-shadow: 0 0 6px rgba(59, 130, 246, 0.3);
  animation: pulse-glow 1.5s ease-in-out infinite;
}

/* 脉冲动画 */
@keyframes pulse-glow {
  0%,
  100% {
    opacity: 1;
    box-shadow: 0 0 6px rgba(59, 130, 246, 0.3);
  }
  50% {
    opacity: 0.85;
    box-shadow: 0 0 10px rgba(59, 130, 246, 0.4);
  }
}

/* 减少动画偏好 */
@media (prefers-reduced-motion: reduce) {
  .resize-handle,
  .resize-handle-line {
    transition: none;
  }

  .resize-handle.resizing .resize-handle-line {
    animation: none;
  }
}
</style>
