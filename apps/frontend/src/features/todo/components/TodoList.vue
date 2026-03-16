<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ClipboardList, CheckCircle2, SearchX, Trash2 } from 'lucide-vue-next'
import { computed } from 'vue'
import draggable from 'vuedraggable'
import { useTodoStore, type Todo } from '../stores/todo'
import TodoItem from './TodoItem.vue'
import { ScrollArea } from '@/components/ui/scroll-area'

const { t } = useI18n()
const store = useTodoStore()

defineOptions({
  name: 'TodoList',
})

const props = defineProps<{
  todos: Todo[]
  filter: 'pending' | 'completed' | 'trash'
  searchQuery: string
  editingId: string | null
  editingTitle: string
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

const dragList = computed({
  get: () => displayTodos.value,
  set: (val) => {
    emit(
      'reorder',
      val.map((t) => t.id),
      null,
    )
  },
})

const emptyState = computed(() => {
  if (props.searchQuery) {
    return {
      icon: SearchX,
      title: t('todo.emptySearch'),
      description: t('todo.emptySearchDescription'),
    }
  }
  if (props.filter === 'pending') {
    return {
      icon: ClipboardList,
      title: t('todo.emptyPending'),
      description: t('todo.emptyPendingDescription'),
    }
  }
  if (props.filter === 'trash') {
    return {
      icon: Trash2,
      title: t('todo.emptyTrash'),
      description: t('todo.emptyTrashDescription'),
    }
  }
  return {
    icon: CheckCircle2,
    title: t('todo.emptyCompleted'),
    description: t('todo.emptyCompletedDescription'),
  }
})

const displayTodos = computed(() => {
  // 回收站模式：直接扁平化展示所有已删除项
  if (props.filter === 'trash' || props.searchQuery) {
    return props.todos
  }

  // 非搜索模式：保持层级结构，只显示根节点
  return props.todos.filter((todo) => {
    if (!todo.parentId) return true
    return !props.todos.some((t) => t.id === todo.parentId)
  })
})
</script>

<template>
  <div class="flex-1 flex flex-col min-h-0">
    <ScrollArea class="flex-1 min-h-0 w-full -mx-4 px-4">
      <!-- Empty State -->
      <div
        v-show="todos.length === 0"
        class="flex flex-col items-center justify-center py-12 md:py-24"
      >
        <div
          class="mb-8 flex items-center justify-center w-24 h-24 rounded-full bg-primary/5 border border-primary/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative group"
        >
          <div
            class="absolute inset-0 rounded-full bg-primary/5 scale-110 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700"
          ></div>
          <component
            :is="emptyState.icon"
            :size="40"
            :stroke-width="1.25"
            class="text-primary/30 group-hover:text-primary/50 transition-colors duration-500 relative z-10"
          />
        </div>

        <div class="text-center space-y-2.5 px-6 relative z-10">
          <h3 class="text-[var(--todo-font-title)] font-medium tracking-tight text-foreground/70">
            {{ emptyState.title }}
          </h3>
          <p
            class="text-[var(--todo-font-meta)] text-muted-foreground/50 max-w-[280px] mx-auto leading-relaxed"
          >
            {{ emptyState.description }}
          </p>
        </div>
      </div>

      <div v-show="todos.length > 0" class="min-h-[100px]">
        <draggable
          v-model="dragList"
          item-key="id"
          handle=".drag-handle"
          :group="{ name: 'todos', pull: true, put: true }"
          ghost-class="opacity-50"
          chosen-class="scale-[1.02]"
          drag-class="rotate-1"
          class="space-y-1.5 pb-6 md:space-y-2"
          :animation="200"
          :disabled="!!searchQuery"
          @start="store.setDragging(true)"
          @end="store.setDragging(false)"
        >
          <template #item="{ element: todo }">
            <div class="todo-item-wrapper">
              <TodoItem
                :key="todo.id"
                :todo="todo"
                :all-todos="todos"
                :editing-id="editingId"
                :editing-title="editingTitle"
                :search-query="searchQuery"
                @toggle="(id, currentCompleted) => emit('toggle', id, currentCompleted)"
                @start-edit="(id, title) => emit('startEdit', id, title)"
                @save-edit="emit('saveEdit')"
                @cancel-edit="emit('cancelEdit')"
                @delete="(id) => emit('delete', id)"
                @reorder="(ids, pId) => emit('reorder', ids, pId)"
                @update:editing-title="(value) => emit('update:editingTitle', value)"
                @edit-keydown="(e) => emit('editKeydown', e)"
              />
            </div>
          </template>
        </draggable>
      </div>
    </ScrollArea>
  </div>
</template>
