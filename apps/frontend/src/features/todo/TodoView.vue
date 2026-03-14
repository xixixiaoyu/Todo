<script setup lang="ts">
import { ref, onMounted, watch, computed, defineAsyncComponent } from 'vue'
import { useI18n } from 'vue-i18n'
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-vue-next'
import { useTodoStore, type FilterType } from './stores/todo'
import { usePomodoroStore } from './stores/pomodoro'
import { useTodo } from './composables/useTodo'
import { useGsap } from '@/composables/useGsap'
import { useIsMobile } from '@/composables/useWindowSize'
import TodoHeader from './components/TodoHeader.vue'
import TodoInput from './components/TodoInput.vue'
import TodoFilter from './components/TodoFilter.vue'
import TodoSearch from './components/TodoSearch.vue'
import TodoList from './components/TodoList.vue'
import PomodoroTimer from './components/PomodoroTimer.vue'
import Fireworks from '@/components/Fireworks.vue'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const todoStore = useTodoStore()
const pomodoroStore = usePomodoroStore()
const { t } = useI18n()

const cardRef = ref<HTMLElement | null>(null)
const inputContainerRef = ref<HTMLElement | null>(null)
const { gsap, ctx } = useGsap()
const { isMobile } = useIsMobile()
const TodoVisualizer = defineAsyncComponent(() => import('./components/TodoVisualizer.vue'))
const TodoStatistics = defineAsyncComponent(() => import('./components/TodoStatistics.vue'))
const PomodoroEarth = defineAsyncComponent(() => import('./components/pomodoro/PomodoroEarth.vue'))
const AiAssistantDrawer = defineAsyncComponent(
  () => import('@/features/ai/components/AiAssistantDrawer.vue'),
)

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
  if (cardRef.value && !pomodoroStore.isMiniMode && !todoStore.isDragging) {
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
  height: visible ? (isMobile.value ? 56 : 52) : 0,
  marginBottom: visible ? (isMobile.value ? 4 : 24) : 0,
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
    const viewOrder: Record<'list' | 'visual' | 'stats', number> = { list: 0, visual: 1, stats: 2 }
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

    // 整体卡片入场：更快的 Power4 曲线，减少位移
    if (cardRef.value) {
      gsap.from(cardRef.value, {
        y: 10,
        opacity: 0,
        duration: 0.4,
        ease: 'power3.out',
      })
    }

    // 内部元素交错入场：极致响应
    const containerChildren = gsap.utils.toArray('.todo-container > *')
    if (containerChildren.length > 0) {
      gsap.from(containerChildren, {
        y: 8,
        opacity: 0,
        duration: 0.3,
        stagger: 0.03,
        ease: 'power2.out',
      })
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
const shouldMountAiDrawer = ref(false)

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
  if (todoStore.viewMode !== 'list') return {}

  return {
    toggle: (id: string, currentCompleted: boolean) => handleToggleTodo(id, currentCompleted),
    startEdit: (id: string, title: string) => startEditing(id, title),
    saveEdit: () => saveEditing(),
    cancelEdit: () => cancelEditing(),
    delete: (id: string) => void todoStore.deleteTodo(id),
    reorder: (ids: string[], pId: string | null) => todoStore.reorderTodos(ids, pId),
    'update:editingTitle': (value: string) => {
      editingTitle.value = value
    },
    editKeydown: (e: KeyboardEvent) => handleEditKeydown(e),
  }
})

const isConflictPanelOpen = ref(false)
const syncConflicts = computed(() => todoStore.syncConflicts)

const conflictReasonLabel = (reason: 'TOMBSTONED' | 'OWNER_MISMATCH' | 'VERSION_CONFLICT') => {
  if (reason === 'TOMBSTONED') return t('todo.syncConflictReasonTombstoned')
  if (reason === 'OWNER_MISMATCH') return t('todo.syncConflictReasonOwnerMismatch')
  return t('todo.syncConflictReasonVersion')
}

const getConflictTitle = (id: string) => {
  const conflict = syncConflicts.value.find((item) => item.id === id)
  return (
    conflict?.localDraft?.title ||
    conflict?.serverSnapshot?.title ||
    todoStore.todos.find((todo) => todo.id === id)?.title ||
    t('todo.syncConflictUnknownTitle')
  )
}

const canRetryConflict = (reason: 'TOMBSTONED' | 'OWNER_MISMATCH' | 'VERSION_CONFLICT') =>
  reason === 'VERSION_CONFLICT'

function onFireworksComplete() {
  showFireworks.value = false
}
</script>

<template>
  <div
    class="h-full bg-background p-0 md:p-8 flex items-center md:items-end justify-center overflow-hidden relative"
    :class="{ 'p-0 items-center': pomodoroStore.isMiniMode }"
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
      class="w-full max-w-4xl h-full md:h-[94vh] flex flex-col z-10 will-change-transform"
      style="perspective: 1200px; transform-style: preserve-3d"
    >
      <Card
        class="flex-1 flex flex-col border border-white/5 dark:border-white/10 shadow-none md:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] dark:md:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.6)] overflow-hidden rounded-none md:rounded-[32px] bg-card/40 md:bg-card/60 backdrop-blur-[40px] relative group/card"
      >
        <!-- 玻璃边缘高光 (Glass Edge Highlight) -->
        <div
          class="absolute inset-0 rounded-[32px] pointer-events-none border border-white/10 dark:border-white/5 mask-edge"
        ></div>

        <CardContent
          class="todo-container p-4 pt-6 md:p-8 md:pt-6 flex flex-col flex-1 min-h-0 relative z-10 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]"
        >
          <!-- Header -->
          <TodoHeader />

          <div
            v-if="syncConflicts.length > 0"
            class="mb-3 md:mb-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3 py-3 md:px-4 md:py-3"
          >
            <div class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                <AlertTriangle class="h-4 w-4 md:h-5 md:w-5" />
                <p class="text-xs md:text-sm font-semibold">
                  {{ t('todo.syncConflictBanner', { count: syncConflicts.length }) }}
                </p>
              </div>
              <div class="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  class="h-8 rounded-lg px-2 text-[11px] md:text-xs hover:bg-amber-500/10"
                  @click="todoStore.clearSyncConflicts()"
                >
                  {{ t('todo.syncConflictDismissAll') }}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  class="h-8 w-8 rounded-lg hover:bg-amber-500/10"
                  @click="isConflictPanelOpen = !isConflictPanelOpen"
                >
                  <ChevronUp v-if="isConflictPanelOpen" class="h-4 w-4" />
                  <ChevronDown v-else class="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div v-if="isConflictPanelOpen" class="mt-3 space-y-2">
              <div
                v-for="conflict in syncConflicts"
                :key="conflict.id"
                class="rounded-xl border border-amber-500/25 bg-background/60 px-3 py-2"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <p class="truncate text-xs md:text-sm font-semibold text-foreground">
                      {{ getConflictTitle(conflict.id) }}
                    </p>
                    <p class="text-[11px] md:text-xs text-muted-foreground mt-0.5">
                      {{ conflictReasonLabel(conflict.reason) }}
                    </p>
                  </div>
                  <div class="flex items-center gap-1.5 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      class="h-7 rounded-lg px-2 text-[11px]"
                      @click="todoStore.acceptSyncConflict(conflict.id)"
                    >
                      {{ t('todo.syncConflictAcceptServer') }}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      class="h-7 rounded-lg px-2 text-[11px]"
                      :disabled="!canRetryConflict(conflict.reason)"
                      @click="todoStore.retrySyncConflict(conflict.id)"
                    >
                      {{ t('todo.syncConflictRetryLocal') }}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

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
            class="mb-3 md:mb-6"
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
              class="mb-4"
              @clear="clearSearch"
              @close="showSearch = false"
            />
          </Transition>

          <!-- List / Visualizer / Stats with smooth transitions -->
          <div
            class="flex-1 relative flex flex-col min-h-0"
            :class="!showSearch && todoStore.viewMode === 'visual' ? 'mt-0' : 'mt-2'"
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
                    x: direction * 15,
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
                    duration: 0.4,
                    ease: 'power3.out',
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
                    x: -direction * 15,
                    scale: 0.98,
                    filter: 'blur(4px)',
                    duration: 0.25,
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
</style>
