<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Plus } from 'lucide-vue-next'
import type { Todo } from '../stores/todo'
import TodoItem from './TodoItem.vue'

const { t } = useI18n()

defineProps<{
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
  'update:editingTitle': [value: string]
  editKeydown: [e: KeyboardEvent]
}>()
</script>

<template>
  <div class="min-h-[calc(100vh-350px)] flex-1">
    <!-- Empty State -->
    <div
      v-if="todos.length === 0"
      class="flex flex-col items-center justify-center py-20 text-muted-foreground/50"
    >
      <Plus :size="48" :stroke-width="1" class="mb-4" />
      <p class="text-base">
        {{
          searchQuery
            ? t('todo.emptySearch')
            : filter === 'pending'
              ? t('todo.emptyPending')
              : t('todo.emptyCompleted')
        }}
      </p>
    </div>

    <!-- Todo Items -->
    <div v-else class="space-y-3">
      <TodoItem
        v-for="todo in todos"
        :key="todo.id"
        :todo="todo"
        :editing-id="editingId"
        :editing-title="editingTitle"
        @toggle="(id, currentCompleted) => emit('toggle', id, currentCompleted)"
        @start-edit="(id, title) => emit('startEdit', id, title)"
        @save-edit="emit('saveEdit')"
        @cancel-edit="emit('cancelEdit')"
        @delete="(id) => emit('delete', id)"
        @update:editing-title="(value) => emit('update:editingTitle', value)"
        @edit-keydown="(e) => emit('editKeydown', e)"
      />
    </div>
  </div>
</template>
