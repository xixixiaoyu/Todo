<script setup lang="ts">
import { ref, computed, watch, useId } from 'vue'
import draggable from 'vuedraggable'
import { ChevronDown, ChevronRight, GripVertical } from 'lucide-vue-next'
import { useHaptics, ImpactStyle } from '@/composables/useHaptics'
import { useTodoStore, type Todo } from '../stores/todo'
import { useIsMobile } from '@/composables/useWindowSize'
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

const editInputId = useId()
const subtaskInputId = useId()

const props = defineProps<{
  todo: Todo
  allTodos: Todo[]
  editingId: string | null
  editingTitle: string
  searchQuery?: string
  level?: number
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
const isMobileActionsVisible = ref(false)
const isAddingChild = ref(false)
const showTooltip = ref(false)

// --- Computed ---
const isExpanded = computed(() => props.todo.expanded ?? true)
const hasChildren = computed(() => children.value.length > 0)
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
function toggleMobileActions() {
  if (isMobile.value) {
    isMobileActionsVisible.value = !isMobileActionsVisible.value
  }
}

async function handleBreakdown() {
  isBreakingDown.value = true
  try {
    await store.breakdownTaskWithAI(props.todo.id)
    await hapticImpact(ImpactStyle.Medium)
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

// --- Watchers ---
watch(
  () => store.error,
  (newError) => {
    if (newError && (props.editingId === props.todo.id || isAddingChild.value)) {
      triggerFeedback()
    }
  },
)
</script>

<template>
  <div class="flex flex-col gap-2">
    <div
      class="group relative flex items-center gap-3 rounded-xl border transition-all duration-200 hover:shadow-md hover:shadow-black/5"
      :class="[
        level && level > 0
          ? 'bg-transparent border-border/50 py-2 opacity-95 scale-[0.99] hover:bg-muted/5 px-4'
          : 'bg-card border-border px-4 py-3',
        { 'border-primary/30 bg-primary/[0.03] shadow-sm shadow-primary/5': todo.isPinned },
        { 'border-success/40 bg-success/[0.04] ring-1 ring-success/20': todo.isProposed },
        {
          'border-destructive/40 bg-destructive/[0.04] opacity-70 grayscale-[0.5]':
            todo.isProposedDelete,
        },
      ]"
    >
      <!-- Left: Drag & Expand & Checkbox -->
      <div class="flex items-center gap-2">
        <GripVertical
          v-if="store.filter !== 'trash'"
          class="drag-handle h-4 w-4 cursor-grab text-muted-foreground/30 hover:text-muted-foreground transition-colors active:cursor-grabbing"
          @touchstart="hapticSelectionStart"
        />
        <Button
          v-if="(level || 0) < 2 && hasChildren"
          variant="ghost"
          size="icon"
          class="h-6 w-6 text-muted-foreground transition-opacity"
          @click="toggleExpand"
        >
          <ChevronDown v-if="isExpanded" class="h-4 w-4" />
          <ChevronRight v-else class="h-4 w-4" />
        </Button>
        <div v-else class="w-6" />

        <Checkbox
          v-if="store.filter !== 'trash'"
          :model-value="todo.completed"
          :disabled="todo.isProposedDelete"
          class="h-5 w-5 rounded-full border-2 data-[state=checked]:bg-success data-[state=checked]:border-success transition-transform active:scale-90"
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
        @start-edit="emit('startEdit', todo.id, todo.title)"
        @toggle-mobile-actions="toggleMobileActions"
      />

      <!-- Right: Actions -->
      <TodoItemActions
        v-if="editingId !== todo.id"
        :todo="todo"
        :is-breaking-down="isBreakingDown"
        :is-mobile-actions-visible="isMobileActionsVisible"
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
      v-if="isExpanded && hasChildren"
      class="flex flex-col gap-2 ml-4 md:ml-6 border-l border-border/30 pl-4 md:pl-6"
    >
      <draggable
        v-model="dragChildren"
        item-key="id"
        handle=".drag-handle"
        group="todos"
        :animation="200"
        ghost-class="opacity-50"
        chosen-class="scale-[1.01]"
        class="flex flex-col gap-1.5 min-h-[4px]"
        @start="hapticSelectionStart"
      >
        <template #item="{ element }">
          <TodoItem
            :todo="element"
            :all-todos="allTodos"
            :editing-id="editingId"
            :editing-title="editingTitle"
            :search-query="searchQuery"
            :level="(level || 0) + 1"
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
