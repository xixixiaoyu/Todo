<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Plus } from 'lucide-vue-next'
import type { Todo } from '../stores/todo'
import TodoItem from './TodoItem.vue'
import { ScrollArea } from '@/components/ui/scroll-area'

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
  <div class="flex-1 flex flex-col min-h-0">
    <ScrollArea class="flex-1 -mx-2 px-2 h-[calc(100vh-450px)]">
      <!-- Empty State -->
      <div
        v-if="todos.length === 0"
        class="flex flex-col items-center justify-center py-24 text-muted-foreground/30 animate-in fade-in zoom-in duration-500"
      >
        <div class="relative mb-6">
          <Plus :size="64" :stroke-width="1" class="text-muted-foreground/20" />
          <div class="absolute inset-0 bg-primary/5 blur-3xl rounded-full scale-150 -z-10" />
        </div>
        <p class="text-lg font-medium tracking-tight">
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
      <div v-else class="space-y-3 pb-6">
        <TransitionGroup
          enter-active-class="transition-all duration-300 ease-out"
          enter-from-class="opacity-0 translate-y-4"
          enter-to-class="opacity-100 translate-y-0"
          leave-active-class="transition-all duration-200 ease-in absolute w-full"
          leave-from-class="opacity-100 scale-100"
          leave-to-class="opacity-0 scale-95"
          move-class="transition-transform duration-300"
        >
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
        </TransitionGroup>
      </div>
    </ScrollArea>
  </div>
</template>
