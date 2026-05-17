<script setup lang="ts">
import { ref, onMounted, watch, computed, defineAsyncComponent } from 'vue'
import { useTodoStore } from './stores/todo'
import type { FilterType, ViewMode } from './stores/todo'
import { usePomodoroStore } from './stores/pomodoro'
import { useTodo } from './composables/useTodo'
import { useImageTaskExtraction } from './composables/useImageTaskExtraction'
import { useGsap } from '@/composables/useGsap'
import { useIsMobile } from '@/composables/useWindowSize'
import TodoHeader from './components/TodoHeader.vue'
import TodoInput from './components/TodoInput.vue'
import TodoFilter from './components/TodoFilter.vue'
import TodoSearch from './components/TodoSearch.vue'
import TodoList from './components/TodoList.vue'
import PomodoroTimer from './components/PomodoroTimer.vue'
import TodoSyncConflictPanel from './components/TodoSyncConflictPanel.vue'
import TodoImageTaskConfirmDialog from './components/TodoImageTaskConfirmDialog.vue'
import AiAssistantDrawer from '@/features/ai/components/AiAssistantDrawer.vue'
import Fireworks from '@/components/Fireworks.vue'
import { Card, CardContent } from '@/components/ui/card'

const todoStore = useTodoStore()
const pomodoroStore = usePomodoroStore()

const cardRef = ref<HTMLElement | null>(null)
const inputContainerRef = ref<HTMLElement | null>(null)
const { gsap, ctx } = useGsap()
const { isMobile } = useIsMobile()
const TodoVisualizer = defineAsyncComponent(() => import('./components/TodoVisualizer.vue'))
const TodoStatistics = defineAsyncComponent(() => import('./components/TodoStatistics.vue'))
const PomodoroEarth = defineAsyncComponent(() => import('./components/pomodoro/PomodoroEarth.vue'))

// 预定义动画函数并注册到 GSAP Context，确保自动清理且高性能
let animateTilt: (x: number, y: number) => void
let animateReset: () => void

ctx.add(() => {
  animateTilt = (x, y) => {
    if (!cardRef.value) return
    gsap.to(cardRef.value, {
      rotateX: x,
      rotateY: y,
      duration: 0.6,
      ease: 'power2.out',
      overwrite: 'auto',
    })
  }

  animateReset = () => {
    if (!cardRef.value) return
    gsap.to(cardRef.value, {
      rotateX: 0,
      rotateY: 0,
      duration: 1.2,
      ease: 'elastic.out(1, 0.3)',
      overwrite: 'auto',
    })
  }
})

// 鼠标位置追踪，用于背景与卡片微动
const mousePos = ref({ x: 0, y: 0 })
const handleMouseMove = (e: MouseEvent) => {
  const { clientX, clientY } = e
  const { innerWidth, innerHeight } = window
  // 将坐标归一化到 -0.5 到 0.5 之间
  mousePos.value = {
    x: clientX / innerWidth - 0.5,
    y: clientY / innerHeight - 0.5,
  }

  // 卡片倾斜效果 (Tilt Effect)
  if (
    cardRef.value &&
    !pomodoroStore.isMiniMode &&
    !todoStore.isDragging &&
    !todoStore.isAppFullscreen
  ) {
    const tiltX = mousePos.value.y * 6 // 增加倾斜幅度，增强 3D 感
    const tiltY = -mousePos.value.x * 6
    animateTilt?.(tiltX, tiltY)
  }
}

const resetTilt = () => {
  mousePos.value = { x: 0, y: 0 }
  animateReset?.()
}

watch(
  () => todoStore.isAppFullscreen,
  (isFullscreen) => {
    if (isFullscreen) {
      resetTilt()
    }
  },
)

watch(
  () => todoStore.isDragging,
  (isDragging) => {
    if (isDragging) {
      resetTilt()
    }
  },
)

const isInputVisible = computed(() => todoStore.viewMode === 'list' && todoStore.filter !== 'trash')
const shouldMountPomodoroEarth = computed(
  () => pomodoroStore.status !== 'idle' || pomodoroStore.isMiniMode,
)

const currentViewKey = computed(() => {
  if (todoStore.viewMode === 'visual') return 'visual'
  if (todoStore.viewMode === 'stats') return 'stats'
  return `${todoStore.viewMode}-${todoStore.filter}`
})

const currentViewComponent = computed(() => {
  if (todoStore.viewMode === 'list') return TodoList
  if (todoStore.viewMode === 'visual') return TodoVisualizer
  return TodoStatistics
})

// 追踪上一次的 filter 以决定动画方向
const direction = ref(0) // 1: next, -1: prev

const getInputContainerLayout = (visible: boolean) => ({
  height: visible ? (isMobile.value ? 40 : 48) : 0,
  marginBottom: visible ? (isMobile.value ? 4 : 16) : 0,
  opacity: visible ? 1 : 0,
})

const syncInputContainerLayout = (visible: boolean, animate: boolean) => {
  if (!inputContainerRef.value) return

  const layout = getInputContainerLayout(visible)
  ctx.add(() => {
    if (animate) {
      gsap.to(inputContainerRef.value, {
        ...layout,
        duration: 0.5,
        ease: 'expo.out',
        overwrite: true,
      })
      return
    }

    gsap.set(inputContainerRef.value, layout)
  })
}

watch(
  () => todoStore.viewMode,
  (newVal, oldVal) => {
    const viewOrder: Record<ViewMode, number> = {
      list: 0,
      visual: 1,
      stats: 2,
    }
    direction.value = viewOrder[newVal] > viewOrder[oldVal] ? 1 : -1
  },
)

watch(
  () => todoStore.filter,
  (newVal: FilterType, oldVal: FilterType) => {
    const filterOrder: Record<FilterType, number> = { pending: 0, completed: 1, trash: 2 }
    direction.value = filterOrder[newVal] > filterOrder[oldVal] ? 1 : -1
  },
)

watch(
  isInputVisible,
  (visible) => {
    syncInputContainerLayout(visible, true)
  },
  { immediate: true },
)

watch(
  [() => pomodoroStore.isMiniMode, isMobile, inputContainerRef],
  ([isMiniMode]) => {
    if (isMiniMode) return
    syncInputContainerLayout(isInputVisible.value, false)
  },
  { flush: 'post' },
)

onMounted(() => {
  void todoStore.fetchTodos()

  ctx.add(() => {
    // 初始化输入框状态，避免首屏闪烁
    if (inputContainerRef.value) {
      syncInputContainerLayout(isInputVisible.value, false)
    }
  })
})

const {
  newTodoTitle,
  showSearch,
  searchInput,
  showFireworks,
  isDrawerOpen,
  editingId,
  editingTitle,
  showTooltip,
  handleAddTodo,
  handleKeydown,
  clearSearch,
  handleToggleTodo,
  startEditing,
  cancelEditing,
  saveEditing,
  handleEditKeydown,
} = useTodo()

const {
  showDialog: showImageTaskDialog,
  extractedTasks,
  isExtracting,
  extractionError,
  handleImagePaste,
  confirmAddTasks,
  cancelExtraction,
  retryExtraction,
} = useImageTaskExtraction()

const shouldMountAiDrawer = ref(isDrawerOpen.value)

watch(
  isDrawerOpen,
  (open) => {
    if (open) shouldMountAiDrawer.value = true
  },
  { immediate: true },
)

const currentViewProps = computed(() => {
  if (todoStore.viewMode === 'stats') return {}

  const baseProps = {
    filter: todoStore.filter,
  }

  if (todoStore.viewMode !== 'list') return baseProps

  return {
    ...baseProps,
    todos: todoStore.hasProposedChanges ? todoStore.previewTodos : todoStore.filteredTodos,
    searchQuery: todoStore.searchQuery,
    editingId: editingId.value,
    editingTitle: editingTitle.value,
  }
})

const currentViewListeners = computed(() => {
  if (todoStore.viewMode === 'visual') {
    return {
      toggle: (id: string, currentCompleted: boolean) => handleToggleTodo(id, currentCompleted),
      delete: (id: string): void => {
        void todoStore.deleteTodo(id)
      },
    }
  }

  if (todoStore.viewMode !== 'list') return {}

  return {
    toggle: (id: string, currentCompleted: boolean) => handleToggleTodo(id, currentCompleted),
    startEdit: (id: string, title: string) => startEditing(id, title),
    saveEdit: () => saveEditing(),
    cancelEdit: () => cancelEditing(),
    delete: (id: string): void => {
      void todoStore.deleteTodo(id)
    },
    reorder: (ids: string[], pId: string | null) => todoStore.reorderTodos(ids, pId),
    'update:editingTitle': (value: string) => {
      editingTitle.value = value
    },
    editKeydown: (e: KeyboardEvent) => handleEditKeydown(e),
  }
})

const syncConflicts = computed(() => todoStore.syncConflicts)

function onFireworksComplete() {
  showFireworks.value = false
}
</script>

<template>
  <div
    class="todo-typography h-full bg-background flex items-center md:items-end justify-center overflow-hidden relative transition-all duration-500"
    :class="[
      todoStore.isAppFullscreen ? 'p-0' : 'p-0 md:p-8',
      { 'p-0 items-center': pomodoroStore.isMiniMode },
    ]"
    @mousemove="handleMouseMove"
    @mouseleave="resetTilt"
  >
    <!-- 全屏地球背景 (番茄钟开启时显示) -->
    <PomodoroEarth v-if="shouldMountPomodoroEarth" :mouse-pos="mousePos" />

    <!-- 背景装饰：从单一径向渐变升级为动态 Mesh Gradient -->
    <div class="absolute inset-0 overflow-hidden pointer-events-none -z-20">
      <div
        class="absolute -inset-[10%] opacity-30 dark:opacity-20 transition-transform duration-1000 ease-out"
        :style="{
          background: `
            radial-gradient(circle at 20% 30%, hsl(var(--primary) / 0.15) 0%, transparent 50%),
            radial-gradient(circle at 80% 70%, hsl(var(--primary) / 0.1) 0%, transparent 50%),
            radial-gradient(circle at 50% 50%, hsl(var(--background)) 0%, transparent 100%)
          `,
          transform: `translate(${mousePos.x * 20}px, ${mousePos.y * 20}px)`,
        }"
      ></div>
    </div>

    <div
      v-if="!pomodoroStore.isMiniMode"
      ref="cardRef"
      class="w-full flex flex-col z-10 will-change-transform transition-all duration-500 ease-in-out"
      :class="[todoStore.isAppFullscreen ? 'max-w-none h-screen' : 'max-w-4xl h-full md:h-[94vh]']"
      :style="{
        perspective: '1200px',
        transformStyle: 'preserve-3d',
      }"
    >
      <Card
        class="flex-1 flex flex-col border border-white/5 dark:border-white/10 shadow-none overflow-hidden bg-card/40 md:bg-card/60 backdrop-blur-[40px] relative group/card transition-all duration-500 ease-in-out"
        :class="[
          todoStore.isAppFullscreen
            ? 'rounded-none'
            : 'md:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] dark:md:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.6)] rounded-none md:rounded-[32px]',
        ]"
      >
        <!-- 玻璃边缘高光 (Glass Edge Highlight) -->
        <div
          v-if="!todoStore.isAppFullscreen"
          class="absolute inset-0 rounded-[32px] pointer-events-none border border-white/10 dark:border-white/5 mask-edge"
        ></div>

        <CardContent
          class="todo-container p-4 pt-6 md:p-8 md:pt-6 flex flex-col flex-1 min-h-0 relative z-10 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]"
        >
          <!-- Header -->
          <TodoHeader />

          <TodoSyncConflictPanel
            :conflicts="syncConflicts"
            :todos="todoStore.todos"
            @clear-all="todoStore.clearSyncConflicts()"
            @accept="todoStore.acceptSyncConflict($event)"
            @retry="todoStore.retrySyncConflict($event)"
          />

          <!-- Input Area - Creation First -->
          <div ref="inputContainerRef" class="relative overflow-hidden">
            <Transition
              enter-active-class="transition-all duration-400 ease-out"
              enter-from-class="opacity-0 -translate-y-2 scale-[0.98]"
              enter-to-class="opacity-100 translate-y-0 scale-100"
              leave-active-class="transition-all duration-300 ease-in"
              leave-from-class="opacity-100 translate-y-0 scale-100"
              leave-to-class="opacity-0 -translate-y-2 scale-[0.98]"
            >
              <TodoInput
                v-if="isInputVisible"
                v-model="newTodoTitle"
                :show-tooltip="showTooltip"
                :error-message="todoStore.error || ''"
                class="absolute inset-0"
                @add="handleAddTodo"
                @keydown="handleKeydown"
                @paste="handleImagePaste"
              />
            </Transition>
          </div>

          <!-- Filter Tabs - Control Second -->
          <TodoFilter
            v-if="todoStore.viewMode === 'list' || todoStore.viewMode === 'visual'"
            v-model:filter="todoStore.filter"
            v-model:is-drawer-open="isDrawerOpen"
            v-model:show-search="showSearch"
            :show-trash="todoStore.viewMode !== 'visual'"
            class="mb-3 md:mb-5"
          />

          <!-- Search Bar (Collapsible) - Keep near tabs -->
          <Transition
            enter-active-class="transition-all duration-300 ease-out"
            enter-from-class="opacity-0 -translate-y-2"
            enter-to-class="opacity-100 translate-y-0"
            leave-active-class="transition-all duration-200 ease-in"
            leave-from-class="opacity-100 translate-y-0"
            leave-to-class="opacity-0 -translate-y-2"
          >
            <TodoSearch
              v-if="showSearch"
              v-model="searchInput"
              class="mb-3"
              @clear="clearSearch"
              @close="showSearch = false"
            />
          </Transition>

          <!-- List / Visualizer / Stats with smooth transitions -->
          <div
            class="flex-1 relative flex flex-col min-h-0"
            :class="!showSearch && todoStore.viewMode === 'visual' ? 'mt-0' : 'mt-1.5'"
          >
            <Transition
              mode="out-in"
              :css="false"
              @before-enter="
                (el) => {
                  const element = el as HTMLElement
                  gsap.killTweensOf(element)
                  gsap.set(element, {
                    opacity: 0,
                    x: direction * 10,
                    scale: 0.98,
                    filter: 'blur(4px)',
                    willChange: 'transform, opacity, filter',
                  })
                }
              "
              @enter="
                (el, done) => {
                  gsap.to(el, {
                    opacity: 1,
                    x: 0,
                    scale: 1,
                    filter: 'blur(0px)',
                    duration: 0.25,
                    ease: 'power2.out',
                    onComplete: () => {
                      gsap.set(el, { clearProps: 'willChange,filter' })
                      done()
                    },
                  })
                }
              "
              @leave="
                (el, done) => {
                  const element = el as HTMLElement
                  gsap.killTweensOf(element)
                  // 提前设置 will-change 优化性能
                  gsap.set(element, { willChange: 'transform, opacity, filter' })
                  gsap.to(element, {
                    opacity: 0,
                    x: -direction * 10,
                    scale: 0.98,
                    filter: 'blur(4px)',
                    duration: 0.2,
                    ease: 'power2.in',
                    onComplete: () => {
                      gsap.set(element, { clearProps: 'willChange,filter' })
                      done()
                    },
                  })
                }
              "
            >
              <KeepAlive :include="['TodoList', 'TodoVisualizer', 'TodoStatistics']">
                <component
                  :is="currentViewComponent"
                  :key="currentViewKey"
                  v-bind="currentViewProps"
                  class="flex-1 flex flex-col min-h-0"
                  v-on="currentViewListeners"
                />
              </KeepAlive>
            </Transition>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- Fireworks -->
    <Fireworks
      v-if="!pomodoroStore.isMiniMode"
      :active="showFireworks"
      @complete="onFireworksComplete"
    />

    <!-- AI 助手抽屉 -->
    <AiAssistantDrawer v-if="shouldMountAiDrawer" v-model="isDrawerOpen" />

    <!-- 番茄钟 -->
    <PomodoroTimer />

    <!-- 图片任务提取对话框 -->
    <TodoImageTaskConfirmDialog
      v-model:open="showImageTaskDialog"
      :tasks="extractedTasks"
      :is-loading="isExtracting"
      :error="extractionError"
      @confirm="confirmAddTasks"
      @cancel="cancelExtraction"
      @retry="retryExtraction"
    />
  </div>
</template>

<style scoped>
.mask-edge {
  mask-image:
    linear-gradient(to bottom, black, transparent 15%, transparent 85%, black),
    linear-gradient(to right, black, transparent 15%, transparent 85%, black);
  mask-composite: intersect;
  pointer-events: none;
}

.todo-typography {
  --todo-font-title: 18px;
  --todo-font-body: 14px;
  --todo-font-meta: 12px;
  --todo-font-caption: 11px;
  --todo-control-primary-height: 48px;
  --todo-control-secondary-height: 38px;
  --todo-segment-height: 42px;
  --todo-item-height: 52px;
  --todo-item-child-height: 44px;
  --todo-radius-soft: 14px;
}

@media (max-width: 767px) {
  .todo-typography {
    --todo-font-title: 16px;
    --todo-font-body: 13px;
    --todo-font-meta: 11px;
    --todo-font-caption: 10px;
    --todo-control-primary-height: 40px;
    --todo-control-secondary-height: 30px;
    --todo-segment-height: 38px;
    --todo-item-height: 48px;
    --todo-item-child-height: 40px;
    --todo-radius-soft: 16px;
  }
}
</style>
