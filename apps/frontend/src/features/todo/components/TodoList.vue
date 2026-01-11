<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ClipboardList, CheckCircle2, SearchX } from 'lucide-vue-next'
import { computed } from 'vue'
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
  'update:editingTitle': [value: string]
  editKeydown: [e: KeyboardEvent]
}>()

const emptyState = computed(() => {
  if (props.searchQuery) {
    return {
      icon: SearchX,
      title: t('todo.emptySearch'),
      description: t('todo.emptySearchDescription', '尝试换个关键词试试吧'),
    }
  }
  if (props.filter === 'pending') {
    return {
      icon: ClipboardList,
      title: t('todo.emptyPending'),
      description: t('todo.emptyPendingDescription', '享受当下，或者开启一个新的任务'),
    }
  }
  return {
    icon: CheckCircle2,
    title: t('todo.emptyCompleted'),
    description: t('todo.emptyCompletedDescription', '还没有已完成的任务，继续加油'),
  }
})
</script>

<template>
  <div class="flex-1 flex flex-col min-h-0">
    <ScrollArea class="flex-1 -mx-2 px-2 h-[calc(100vh-450px)]">
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
