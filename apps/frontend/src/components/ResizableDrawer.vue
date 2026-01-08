<script setup lang="ts">
import { ref, computed, watch, onMounted, type CSSProperties } from 'vue'

interface Props {
  modelValue: boolean
  defaultWidth?: number
  minWidth?: number
  maxWidth?: number
  storageKey?: string
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
}

const props = withDefaults(defineProps<Props>(), {
  defaultWidth: 320,
  minWidth: 200,
  maxWidth: 600,
  storageKey: 'resizable-drawer-width',
})

const emit = defineEmits<Emits>()

const STORAGE_KEY = props.storageKey

const drawerWidth = ref(props.defaultWidth)
const isResizing = ref(false)
const startX = ref(0)
const startWidth = ref(0)

onMounted(() => {
  const savedWidth = localStorage.getItem(STORAGE_KEY)
  if (savedWidth) {
    const width = Number(savedWidth)
    if (width >= props.minWidth && width <= props.maxWidth) {
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
  isResizing.value = true
  startX.value = e.clientX
  startWidth.value = drawerWidth.value
  document.addEventListener('mousemove', onResize)
  document.addEventListener('mouseup', stopResize)
}

function onResize(e: MouseEvent) {
  if (!isResizing.value) return

  const deltaX = e.clientX - startX.value
  const newWidth = startWidth.value + deltaX

  if (newWidth >= props.minWidth && newWidth <= props.maxWidth) {
    drawerWidth.value = newWidth
  }
}

function stopResize() {
  isResizing.value = false
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

        <!-- 拖动手柄 -->
        <div
          class="w-4 bg-gray-200 hover:bg-primary-400 cursor-col-resize transition-colors flex items-center justify-center group"
          @mousedown="startResize"
        >
          <div class="w-1.5 h-8 bg-gray-400 rounded-full group-hover:bg-white transition-colors" />
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
</style>
