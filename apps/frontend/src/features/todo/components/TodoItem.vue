<script setup lang="ts">
import { ref, computed, watch, useId, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import draggable from 'vuedraggable'
import { ChevronDown, ChevronRight, GripVertical } from 'lucide-vue-next'
import { useHaptics, ImpactStyle } from '@/composables/useHaptics'
import { useGsap } from '@/composables/useGsap'
import { useTodoStore, type Todo } from '../stores/todo'
import { useIsMobile } from '@/composables/useWindowSize'
import { useToast } from '@/composables/useToast'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'

// Sub-components
import TodoItemActions from './TodoItemActions.vue'
import TodoItemContent from './TodoItemContent.vue'
import TodoItemEdit from './TodoItemEdit.vue'
import TodoItemAddSubtask from './TodoItemAddSubtask.vue'

const store = useTodoStore()
const { isMobile } = useIsMobile()
const { hapticImpact, hapticSelectionStart } = useHaptics()
const { success: showToastSuccess, error: showToastError } = useToast()
const { gsap, ctx } = useGsap()
const { t } = useI18n()

const editInputId = useId()
const subtaskInputId = useId()
const subtaskListRef = ref<HTMLElement | null>(null)

const props = defineProps<{
  todo: Todo
  allTodos: Todo[]
  editingId: string | null
  editingTitle: string
  searchQuery?: string
  level?: number
  hideDeferredBadge?: boolean
}>()

const emit = defineEmits<{
  toggle: [id: string, currentCompleted: boolean]
  startEdit: [id: string, title: string]
  saveEdit: []
  cancelEdit: []
  delete: [id: string]
  reorder: [ids: string[], parentId: string | null]
  'update:editingTitle': [value: string]
  editKeydown: [e: KeyboardEvent]
}>()

// --- State ---
const isBreakingDown = ref(false)
const isAddingChild = ref(false)
const showTooltip = ref(false)
const isDragHovering = ref(false)
const dragEnterCount = ref(0)
const dragExpandTimer = ref<ReturnType<typeof setTimeout> | null>(null)
const DRAG_EXPAND_DELAY = 500

// --- Computed ---
const isChild = computed(() => (props.level ?? 0) > 0)
const isExpanded = computed(() => props.todo.expanded ?? true)
const hasChildren = computed(() => children.value.length > 0)
const shouldReserveExpandSlot = computed(() => {
  if ((props.level ?? 0) >= 2) return false

  const parentId = props.todo.parentId ?? null

  return props.allTodos.some((candidate) => {
    if ((candidate.parentId ?? null) !== parentId) return false
    if (candidate.deletedAt) return false

    return props.allTodos.some((child) => child.parentId === candidate.id && !child.deletedAt)
  })
})
const itemClass = computed(() => {
  if (isChild.value) {
    return 'min-h-[var(--todo-item-child-height)] border-border/30 bg-muted/10 px-3 py-1.5 md:px-4 md:py-2 hover:bg-muted/15 hover:border-border/45'
  }

  return 'min-h-[var(--todo-item-height)] border-border/55 bg-card/95 px-3 py-2 md:px-4 md:py-2.5 hover:border-border/75'
})

const checkboxClass = computed(() => {
  const border = isChild.value ? 'border-primary/45' : 'border-primary/70'

  return `rounded-full border-2 ${border} data-[state=checked]:border-success data-[state=checked]:bg-success transition-transform active:scale-90`
})
const children = computed(() => {
  if (props.searchQuery) return []
  return props.allTodos
    .filter((t) => t.parentId === props.todo.id && !t.deletedAt)
    .sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1
      if (!a.isPinned && b.isPinned) return 1
      if (!a.completed && b.completed) return -1
      if (a.completed && !b.completed) return 1
      return (a.order ?? 0) - (b.order ?? 0)
    })
})

const dragChildren = computed({
  get: () => children.value,
  set: (val) => {
    // 检测拖入子任务列表的项：它们不应处于「稍后处理」状态
    for (const todo of val) {
      if (todo.deferredAt && !todo.completed) {
        void store.setTodoDeferred(todo.id, false)
      }
    }
    store.reorderTodos(
      val.map((t) => t.id),
      props.todo.id,
    )
  },
})

const parentPath = computed(() => {
  if (!props.searchQuery?.trim() && store.filter !== 'trash') return []
  return store.getTodoPath(props.todo.id)
})

// --- Methods ---
async function handleBreakdown() {
  isBreakingDown.value = true
  try {
    const addedIds = await store.breakdownTaskWithAI(props.todo.id)
    void hapticImpact(ImpactStyle.Medium)

    if (addedIds && addedIds.length > 0) {
      showToastSuccess(t('ai.contributionReady'), 10000, {
        label: t('ai.breakdownUndo'),
        onClick: () => {
          void store.removeTodos(addedIds)
          void hapticImpact(ImpactStyle.Light)
        },
      })
    }
  } catch (err) {
    console.error('Breakdown error:', err)
    showToastError(t('todo.addError'))
  } finally {
    isBreakingDown.value = false
  }
}

function toggleExpand() {
  store.toggleTodoExpansion(props.todo.id)
}

function triggerFeedback() {
  showTooltip.value = true
  setTimeout(() => {
    showTooltip.value = false
  }, 2000)
}

async function handleSaveEdit() {
  if (props.editingTitle.trim()) {
    const success = await store.updateTodo(props.todo.id, props.editingTitle)
    if (success) {
      emit('saveEdit')
    } else {
      triggerFeedback()
    }
  } else {
    emit('cancelEdit')
  }
}

function handleDelete() {
  void hapticImpact(ImpactStyle.Medium)
  emit('delete', props.todo.id)
}

async function handlePermanentDelete() {
  void hapticImpact(ImpactStyle.Medium)
  await store.deleteTodoPermanently(props.todo.id)
}

function handleAddSubtask() {
  isAddingChild.value = true
  store.clearError()
}

function handleSubtaskAdded() {
  isAddingChild.value = false
  if (!isExpanded.value) {
    store.toggleTodoExpansion(props.todo.id)
  }
}

function handleDragEnter() {
  if (!store.isDragging) return
  dragEnterCount.value++

  if (!isDragHovering.value) {
    isDragHovering.value = true
  }

  // 悬停时延迟展开已折叠的父节点，避免拖拽经过时误触发
  if (hasChildren.value && !isExpanded.value && !dragExpandTimer.value) {
    dragExpandTimer.value = setTimeout(() => {
      dragExpandTimer.value = null
      store.toggleTodoExpansion(props.todo.id)
    }, DRAG_EXPAND_DELAY)
  }
}

function handleDragLeave() {
  dragEnterCount.value--
  void nextTick(() => {
    if (dragEnterCount.value <= 0) {
      dragEnterCount.value = 0
      isDragHovering.value = false
      if (dragExpandTimer.value) {
        clearTimeout(dragExpandTimer.value)
        dragExpandTimer.value = null
      }
    }
  })
}

function handleDragEnd() {
  store.setDragging(false)
  // 清理悬停状态
  isDragHovering.value = false
  dragEnterCount.value = 0
  if (dragExpandTimer.value) {
    clearTimeout(dragExpandTimer.value)
    dragExpandTimer.value = null
  }
  // Auto-expand collapsed parent when a child is dragged into it
  if (!isExpanded.value && hasChildren.value) {
    store.toggleTodoExpansion(props.todo.id)
  }
}

// --- Watchers ---
watch(
  () => store.error,
  (newError) => {
    if (newError && (props.editingId === props.todo.id || isAddingChild.value)) {
      triggerFeedback()
    }
  },
)

// 使用 GSAP 驱动的高性能高度展开动画，替代简单的 v-show
watch(
  [() => isExpanded.value || isDragHovering.value, subtaskListRef],
  ([shouldShow, el], [_, oldEl]) => {
    if (!el) return

    // 如果是初次挂载（oldEl 为 null），则使用 set 而非 animate
    const isInitial = !oldEl

    ctx.add(() => {
      if (shouldShow) {
        // 展开动画
        if (isInitial) {
          gsap.set(el, {
            height: 'auto',
            opacity: 1,
            display: 'flex',
          })
        } else {
          gsap.fromTo(
            el,
            { height: 0, opacity: 0, display: 'flex' },
            {
              height: 'auto',
              opacity: 1,
              duration: 0.4,
              ease: 'expo.out',
              clearProps: 'height', // 动画结束后清除 height，以便内容自适应
            },
          )
        }
      } else {
        // 折叠动画
        if (isInitial) {
          gsap.set(el, {
            height: 0,
            opacity: 0,
            display: 'none',
          })
        } else {
          gsap.to(el, {
            height: 0,
            opacity: 0,
            duration: 0.3,
            ease: 'power2.inOut',
            onComplete: () => {
              gsap.set(el, { display: 'none' })
            },
          })
        }
      }
    })
  },
  { immediate: true, flush: 'post' },
)
</script>

<template>
  <div class="flex flex-col gap-2 md:gap-2.5">
    <div
      class="group relative flex items-center gap-1.5 rounded-[16px] border transition-all duration-200 hover:shadow-[0_6px_18px_rgba(0,0,0,0.04)] md:gap-2.5 md:rounded-[var(--todo-radius-soft)] md:hover:shadow-md md:hover:shadow-black/5"
      :class="[
        itemClass,
        { 'border-primary/30 bg-primary/[0.03] shadow-sm shadow-primary/5': todo.isPinned },
        { 'border-success/40 bg-success/[0.04] ring-1 ring-success/20': todo.isProposed },
        {
          'border-destructive/40 bg-destructive/[0.04] opacity-70 grayscale-[0.5]':
            todo.isProposedDelete,
        },
        { 'ring-2 ring-primary/20': isDragHovering && hasChildren },
      ]"
      @dragenter.prevent="handleDragEnter"
      @dragleave="handleDragLeave"
    >
      <!-- Left: Drag & Expand & Checkbox -->
      <div class="flex items-center gap-1 md:gap-2">
        <div
          v-if="store.filter !== 'trash'"
          class="drag-handle flex h-7 w-4 items-center justify-center cursor-grab active:cursor-grabbing md:h-8 md:w-5 group/drag"
          @touchstart="hapticSelectionStart"
        >
          <GripVertical
            class="h-3 w-3 md:h-4 md:w-4 text-muted-foreground/30 group-hover/drag:text-muted-foreground transition-colors"
          />
        </div>

        <div
          v-if="shouldReserveExpandSlot"
          data-test="expand-slot"
          class="flex h-6 w-6 items-center justify-center"
        >
          <Button
            v-if="hasChildren"
            data-test="expand-toggle"
            variant="ghost"
            size="icon"
            class="h-6 w-6 rounded-md text-muted-foreground/80 transition-colors hover:bg-muted/60 hover:text-foreground"
            :aria-label="isExpanded ? t('common.collapse') : t('common.expand')"
            @click.stop="toggleExpand"
          >
            <ChevronDown v-if="isExpanded" class="h-3.5 w-3.5" />
            <ChevronRight v-else class="h-3.5 w-3.5" />
          </Button>
        </div>

        <Checkbox
          v-if="store.filter !== 'trash'"
          :model-value="todo.completed"
          :disabled="todo.isProposedDelete"
          :class="checkboxClass"
          class="h-5 w-5"
          @update:model-value="
            () => {
              void hapticImpact(ImpactStyle.Light)
              emit('toggle', todo.id, todo.completed)
            }
          "
        />
      </div>

      <!-- Center: Edit Mode or Content -->
      <TodoItemEdit
        v-if="editingId === todo.id"
        :model-value="editingTitle"
        :input-id="editInputId"
        :error="store.error"
        :show-tooltip="showTooltip"
        @update:model-value="emit('update:editingTitle', $event)"
        @save="handleSaveEdit"
        @cancel="emit('cancelEdit')"
        @keydown="emit('editKeydown', $event)"
      />

      <TodoItemContent
        v-else
        :todo="todo"
        :search-query="searchQuery"
        :parent-path="parentPath"
        :hide-deferred-badge="hideDeferredBadge"
        :class="{ 'pr-12 md:pr-0': isMobile }"
        @start-edit="emit('startEdit', todo.id, todo.title)"
      />

      <!-- Right: Actions -->
      <TodoItemActions
        v-if="editingId !== todo.id"
        :todo="todo"
        :is-breaking-down="isBreakingDown"
        :level="level"
        @start-edit="emit('startEdit', todo.id, todo.title)"
        @delete="handleDelete"
        @breakdown="handleBreakdown"
        @add-subtask="handleAddSubtask"
        @permanent-delete="handlePermanentDelete"
      />
    </div>

    <!-- Subtask Input -->
    <TodoItemAddSubtask
      v-if="isAddingChild"
      :parent-id="todo.id"
      :input-id="subtaskInputId"
      :error="store.error"
      :show-tooltip="showTooltip"
      @added="handleSubtaskAdded"
      @cancel="isAddingChild = false"
    />

    <!-- Subtasks List (Recursive) -->
    <div
      v-if="(level || 0) < 2 && (hasChildren || store.isDragging)"
      ref="subtaskListRef"
      class="flex flex-col ml-8 overflow-hidden"
    >
      <draggable
        v-model="dragChildren"
        item-key="id"
        handle=".drag-handle"
        :group="{ name: 'todos', pull: true, put: true }"
        :animation="200"
        ghost-class="opacity-50"
        chosen-class="scale-[1.01]"
        class="w-full flex flex-col gap-2 md:gap-2.5 min-h-[4px]"
        @start="
          () => {
            hapticSelectionStart()
            store.setDragging(true)
          }
        "
        @end="handleDragEnd"
      >
        <template #item="{ element }">
          <TodoItem
            :todo="element"
            :all-todos="allTodos"
            :editing-id="editingId"
            :editing-title="editingTitle"
            :search-query="searchQuery"
            :level="(level || 0) + 1"
            :hide-deferred-badge="hideDeferredBadge"
            @toggle="(id, completed) => emit('toggle', id, completed)"
            @start-edit="(id, title) => emit('startEdit', id, title)"
            @save-edit="emit('saveEdit')"
            @cancel-edit="emit('cancelEdit')"
            @delete="(id) => emit('delete', id)"
            @reorder="(ids, parentId) => emit('reorder', ids, parentId)"
            @update:editing-title="emit('update:editingTitle', $event)"
            @edit-keydown="emit('editKeydown', $event)"
          />
        </template>
      </draggable>
    </div>
  </div>
</template>
