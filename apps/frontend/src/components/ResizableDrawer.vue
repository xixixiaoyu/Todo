<script setup lang="ts">
import { ref, computed, watch, onMounted, type CSSProperties } from 'vue'

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
  maxWidth: 0.85,
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

  if (newWidth >= props.minWidth && newWidth <= maxWidth.value) {
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
          class="w-6 bg-gradient-to-r from-gray-100 to-gray-200 hover:from-primary-50 hover:to-primary-100 cursor-col-resize transition-all duration-200 flex items-center justify-center group border-l border-gray-200 hover:border-primary-200 relative"
          @mousedown="startResize"
        >
          <div class="flex flex-col gap-1.5">
            <div
              class="w-1 h-1.5 bg-gray-400 rounded-full group-hover:bg-primary-500 transition-colors"
            />
            <div
              class="w-1 h-1.5 bg-gray-400 rounded-full group-hover:bg-primary-500 transition-colors"
            />
            <div
              class="w-1 h-1.5 bg-gray-400 rounded-full group-hover:bg-primary-500 transition-colors"
            />
          </div>
          <div
            class="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <svg
              class="w-3 h-3 text-gray-400 group-hover:text-primary-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </div>
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
