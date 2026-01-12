<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ClipboardList, CheckCircle2, SearchX } from 'lucide-vue-next'
import { computed } from 'vue'
import draggable from 'vuedraggable'
import type { Todo } from '../stores/todo'
import TodoItem from './TodoItem.vue'
import { ScrollArea } from '@/components/ui/scroll-area'

const { t } = useI18n()

const props = defineProps<{
  todos: Todo[]
  filter: 'pending' | 'completed'
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
  return {
    icon: CheckCircle2,
    title: t('todo.emptyCompleted'),
    description: t('todo.emptyCompletedDescription'),
  }
})
const displayTodos = computed(() => {
  // 只显示那些父任务不在当前过滤列表中的任务
  // 这样如果是父子都匹配，只显示父任务（子任务在父任务内部递归显示）
  // 如果只有子任务匹配，则显示子任务
  return props.todos.filter((todo) => {
    if (!todo.parentId) return true
    return !props.todos.some((t) => t.id === todo.parentId)
  })
})
</script>

<template>
  <div class="flex-1 flex flex-col min-h-0">
    <ScrollArea class="flex-1 -mx-2 px-2">
      <!-- Empty State -->
      <div
        v-if="todos.length === 0"
        class="flex flex-col items-center justify-center py-32 animate-in fade-in zoom-in duration-700"
      >
        <div class="relative mb-8 group">
          <!-- Background Glow -->
          <div
            class="absolute inset-0 bg-primary/10 blur-3xl rounded-full scale-150 group-hover:bg-primary/20 transition-colors duration-500"
          />

          <!-- Icon Container -->
          <div
            class="relative flex items-center justify-center w-24 h-24 rounded-3xl bg-card border border-border/50 shadow-sm transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3"
          >
            <component
              :is="emptyState.icon"
              :size="40"
              :stroke-width="1.5"
              class="text-primary/40 group-hover:text-primary/60 transition-colors duration-500"
            />
          </div>

          <!-- Decorative Elements -->
          <div class="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-primary/20 animate-pulse" />
          <div
            class="absolute -bottom-1 -left-1 w-3 h-3 rounded-full bg-primary/10 animate-bounce delay-300"
          />
        </div>

        <div class="text-center space-y-2 px-6">
          <h3 class="text-xl font-semibold tracking-tight text-foreground/80">
            {{ emptyState.title }}
          </h3>
          <p class="text-sm text-muted-foreground/60 max-w-[200px] mx-auto leading-relaxed">
            {{ emptyState.description }}
          </p>
        </div>
      </div>

      <div v-else class="min-h-[100px]">
        <draggable
          v-model="dragList"
          item-key="id"
          handle=".drag-handle"
          group="todos"
          ghost-class="opacity-50"
          chosen-class="scale-[1.02]"
          drag-class="rotate-1"
          class="space-y-1 pb-6"
          :animation="300"
          :disabled="!!searchQuery"
        >
          <template #item="{ element: todo }">
            <TodoItem
              :key="todo.id"
              :todo="todo"
              :editing-id="editingId"
              :editing-title="editingTitle"
              :default-expanded="filter !== 'completed'"
              @toggle="(id, currentCompleted) => emit('toggle', id, currentCompleted)"
              @start-edit="(id, title) => emit('startEdit', id, title)"
              @save-edit="emit('saveEdit')"
              @cancel-edit="emit('cancelEdit')"
              @delete="(id) => emit('delete', id)"
              @update:editing-title="(value) => emit('update:editingTitle', value)"
              @edit-keydown="(e) => emit('editKeydown', e)"
            />
          </template>
        </draggable>
      </div>
    </ScrollArea>
  </div>
</template>
