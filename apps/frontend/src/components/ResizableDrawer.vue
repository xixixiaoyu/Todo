<script setup lang="ts">
import { ref, computed, watch, onMounted, type CSSProperties, type Ref } from 'vue'

interface Props {
  modelValue: boolean
  defaultWidth?: number
  minWidth?: number
  maxWidth?: number // 屏幕宽度的比例，0.85 表示 85%
  storageKey?: string
}

const props = withDefaults(defineProps<Props>(), {
  defaultWidth: 320,
  minWidth: 200,
  maxWidth: 0.7,
  storageKey: 'resizable-drawer-width',
})

interface Emits {
  (e: 'update:modelValue', value: boolean): void
}

const emit = defineEmits<Emits>()

const STORAGE_KEY = props.storageKey

const drawerWidth = ref(props.defaultWidth)
const isResizing = ref(false)
const startX = ref(0)
const startWidth = ref(0)
const isHovering = ref(false)

const maxWidth = computed(() => window.innerWidth * props.maxWidth)

onMounted(() => {
  const savedWidth = localStorage.getItem(STORAGE_KEY)
  if (savedWidth) {
    const width = Number(savedWidth)
    if (width >= props.minWidth && width <= maxWidth.value) {
      drawerWidth.value = width
    }
  }
})

watch(drawerWidth, (newWidth) => {
  localStorage.setItem(STORAGE_KEY, String(newWidth))
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

  const deltaX = e.clientX - startX.value
  const newWidth = startWidth.value + deltaX

  if (newWidth >= props.minWidth && newWidth <= maxWidth.value) {
    drawerWidth.value = newWidth
  }
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
    if (newValue) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
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
    rgba(148, 163, 184, 0.1) 0%,
    rgba(148, 163, 184, 0.2) 50%,
    rgba(148, 163, 184, 0.1) 100%
  );
  backdrop-filter: blur(4px);
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
    rgba(59, 130, 246, 0.1) 0%,
    rgba(59, 130, 246, 0.2) 50%,
    rgba(59, 130, 246, 0.1) 100%
  );
  box-shadow: 0 0 12px rgba(59, 130, 246, 0.3);
  backdrop-filter: blur(8px);
}

/* 拖拽中状态 */
.resize-handle.resizing {
  right: -10px;
  width: 20px;
  background: linear-gradient(
    90deg,
    rgba(59, 130, 246, 0.15) 0%,
    rgba(59, 130, 246, 0.3) 50%,
    rgba(59, 130, 246, 0.15) 100%
  );
  box-shadow: 0 0 20px rgba(59, 130, 246, 0.5);
  backdrop-filter: blur(12px);
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
    rgba(148, 163, 184, 0.3) 0%,
    rgba(148, 163, 184, 0.6) 50%,
    rgba(148, 163, 184, 0.3) 100%
  );
  border-radius: 2px;
  box-shadow: 0 0 4px rgba(148, 163, 184, 0.2);
  transition: all 0.2s ease;
}

/* 悬停时中心线条 */
.resize-handle.hovering .resize-handle-line {
  width: 3px;
  height: 48px;
  background: linear-gradient(
    180deg,
    rgba(59, 130, 246, 0.4) 0%,
    rgba(59, 130, 246, 0.8) 50%,
    rgba(59, 130, 246, 0.4) 100%
  );
  box-shadow: 0 0 8px rgba(59, 130, 246, 0.4);
}

/* 拖拽时中心线条 */
.resize-handle.resizing .resize-handle-line {
  width: 4px;
  height: 64px;
  background: linear-gradient(
    180deg,
    rgba(59, 130, 246, 0.5) 0%,
    rgba(59, 130, 246, 1) 50%,
    rgba(59, 130, 246, 0.5) 100%
  );
  box-shadow: 0 0 12px rgba(59, 130, 246, 0.6);
  animation: pulse-glow 1.5s ease-in-out infinite;
}

/* 脉冲动画 */
@keyframes pulse-glow {
  0%,
  100% {
    opacity: 1;
    box-shadow: 0 0 12px rgba(59, 130, 246, 0.6);
  }
  50% {
    opacity: 0.8;
    box-shadow: 0 0 20px rgba(59, 130, 246, 0.8);
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
