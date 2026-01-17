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
  // 如果正在搜索，则显示所有匹配项（扁平化展示）
  if (props.searchQuery) {
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
    <ScrollArea class="flex-1 -mx-4 px-4">
      <!-- Empty State -->
      <div
        v-if="todos.length === 0"
        class="flex flex-col items-center justify-center py-20 animate-in fade-in zoom-in-95 duration-1000 ease-out"
      >
        <div
          class="mb-6 flex items-center justify-center w-20 h-20 rounded-full bg-primary/5 border border-primary/10"
        >
          <component :is="emptyState.icon" :size="32" :stroke-width="1.5" class="text-primary/40" />
        </div>

        <div class="text-center space-y-1.5 px-6">
          <h3 class="text-lg font-medium tracking-tight text-foreground/60">
            {{ emptyState.title }}
          </h3>
          <p class="text-sm text-muted-foreground/40 max-w-[240px] mx-auto leading-relaxed">
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
          class="space-y-3 pb-6"
          :animation="300"
          :disabled="!!searchQuery"
        >
          <template #item="{ element: todo }">
            <TodoItem
              :key="todo.id"
              :todo="todo"
              :editing-id="editingId"
              :editing-title="editingTitle"
              :search-query="searchQuery"
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
