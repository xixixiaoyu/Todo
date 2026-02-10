<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { useTodoStore, type FilterType } from './stores/todo'
import { usePomodoroStore } from './stores/pomodoro'
import { useTodo } from './composables/useTodo'
import { useGsap } from '@/composables/useGsap'
import TodoHeader from './components/TodoHeader.vue'
import TodoInput from './components/TodoInput.vue'
import TodoFilter from './components/TodoFilter.vue'
import TodoSearch from './components/TodoSearch.vue'
import TodoList from './components/TodoList.vue'
import TodoVisualizer from './components/TodoVisualizer.vue'
import TodoStatistics from './components/TodoStatistics.vue'
import PomodoroTimer from './components/PomodoroTimer.vue'
import Fireworks from '@/components/Fireworks.vue'
import AiAssistantDrawer from '@/features/ai/components/AiAssistantDrawer.vue'
import { Card, CardContent } from '@/components/ui/card'

const todoStore = useTodoStore()
const pomodoroStore = usePomodoroStore()

const cardRef = ref<HTMLElement | null>(null)
const inputContainerRef = ref<HTMLElement | null>(null)
const { gsap, ctx } = useGsap()

const isInputVisible = computed(() => todoStore.viewMode === 'list' && todoStore.filter !== 'trash')

const currentViewKey = computed(() =>
  todoStore.viewMode === 'list' ? `list-${todoStore.filter}` : todoStore.viewMode,
)

const currentViewComponent = computed(() => {
  if (todoStore.viewMode === 'list') return TodoList
  if (todoStore.viewMode === 'visual') return TodoVisualizer
  return TodoStatistics
})

// 追踪上一次的 filter 以决定动画方向
const direction = ref(0) // 1: next, -1: prev

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
    if (!inputContainerRef.value) return

    ctx.add(() => {
      gsap.to(inputContainerRef.value, {
        height: visible ? 52 : 0,
        marginBottom: visible ? 24 : 0,
        opacity: visible ? 1 : 0,
        duration: 0.5,
        ease: 'expo.out',
        overwrite: true,
      })
    })
  },
  { immediate: true },
)

onMounted(() => {
  void todoStore.fetchTodos()

  ctx.add(() => {
    // 初始化输入框状态，避免首屏闪烁
    if (inputContainerRef.value) {
      gsap.set(inputContainerRef.value, {
        height: isInputVisible.value ? 52 : 0,
        marginBottom: isInputVisible.value ? 24 : 0,
        opacity: isInputVisible.value ? 1 : 0,
      })
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
        delay: 0.1,
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

const currentViewProps = computed(() => {
  if (todoStore.viewMode !== 'list') return {}

  return {
    todos: todoStore.hasProposedChanges ? todoStore.previewTodos : todoStore.filteredTodos,
    filter: todoStore.filter,
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

function onFireworksComplete() {
  showFireworks.value = false
}
</script>

<template>
  <div
    class="h-full bg-background p-0 md:p-8 flex items-center md:items-end justify-center overflow-hidden relative"
    :class="{ 'p-0 items-center': pomodoroStore.isMiniMode }"
  >
    <!-- 背景装饰：柔和的径向渐变增加深度感 -->
    <div
      class="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(251,191,36,0.03),transparent_70%)] pointer-events-none"
    ></div>

    <div
      v-if="!pomodoroStore.isMiniMode"
      ref="cardRef"
      class="w-full max-w-4xl h-full md:h-[94vh] flex flex-col z-10"
    >
      <Card
        class="flex-1 flex flex-col border-none shadow-none md:shadow-card dark:md:shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden rounded-none md:rounded-[24px] bg-card/30 md:bg-card/50 backdrop-blur-2xl"
      >
        <CardContent class="todo-container p-4 pt-4 md:p-8 md:pt-6 flex flex-col flex-1 min-h-0">
          <!-- Header -->
          <TodoHeader />

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
            class="mb-6"
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
              :css="false"
              @before-enter="
                (el) => {
                  const element = el as HTMLElement
                  gsap.killTweensOf(element)
                  gsap.set(element, {
                    opacity: 0,
                    x: direction * 12,
                    y: 6,
                    scale: 0.99,
                    zIndex: 1,
                    willChange: 'transform, opacity',
                  })
                }
              "
              @enter="
                (el, done) => {
                  gsap.killTweensOf(el)
                  gsap.to(el, {
                    opacity: 1,
                    x: 0,
                    y: 0,
                    scale: 1,
                    duration: 0.32,
                    ease: 'power3.out',
                    onComplete: () => {
                      gsap.set(el, { clearProps: 'willChange,zIndex' })
                      done()
                    },
                  })
                }
              "
              @before-leave="
                (el) => {
                  const element = el as HTMLElement
                  gsap.killTweensOf(element)
                  gsap.set(element, {
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    width: '100%',
                    height: '100%',
                    zIndex: 0,
                    pointerEvents: 'none',
                  })
                }
              "
              @leave="
                (el, done) => {
                  gsap.killTweensOf(el)
                  gsap.to(el, {
                    opacity: 0,
                    x: -direction * 8,
                    y: -4,
                    scale: 0.99,
                    duration: 0.22,
                    ease: 'power2.in',
                    onComplete: () => {
                      gsap.set(el, {
                        clearProps:
                          'position,top,left,right,bottom,width,height,zIndex,pointerEvents',
                      })
                      done()
                    },
                  })
                }
              "
            >
              <KeepAlive :include="['TodoVisualizer', 'TodoStatistics']">
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
    <AiAssistantDrawer v-model="isDrawerOpen" />

    <!-- 番茄钟 -->
    <PomodoroTimer />
  </div>
</template>
