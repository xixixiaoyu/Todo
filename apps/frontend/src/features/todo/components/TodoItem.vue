<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Check, X, Pencil, Trash2 } from 'lucide-vue-next'
import type { Todo } from '../stores/todo'

const { t } = useI18n()

defineProps<{
  todo: Todo
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
  <div
    class="group flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3 transition-all hover:shadow-sm dark:hover:shadow-[0_2px_8px_rgba(0,0,0,0.3)]"
  >
    <button
      class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all"
      :class="
        todo.completed
          ? 'border-success bg-success text-white'
          : 'border-border hover:border-primary/50'
      "
      @click="emit('toggle', todo.id, todo.completed)"
    >
      <Check v-if="todo.completed" :size="14" />
    </button>

    <!-- 编辑模式 -->
    <template v-if="editingId === todo.id">
      <input
        :value="editingTitle"
        type="text"
        class="flex-1 rounded-lg border border-primary/50 bg-background px-2 py-1 text-foreground outline-none focus:ring-2 focus:ring-primary/20"
        :placeholder="t('todo.editPlaceholder')"
        @input="emit('update:editingTitle', ($event.target as HTMLInputElement).value)"
        @keydown="emit('editKeydown', $event)"
        @blur="emit('saveEdit')"
      />
      <button
        class="text-success transition-all hover:opacity-80"
        :title="t('todo.save')"
        @click="emit('saveEdit')"
      >
        <Check :size="18" />
      </button>
      <button
        class="text-muted-foreground transition-all hover:text-foreground"
        :title="t('todo.cancel')"
        @click="emit('cancelEdit')"
      >
        <X :size="18" />
      </button>
    </template>

    <!-- 显示模式 -->
    <template v-else>
      <span
        class="flex-1 cursor-pointer select-none text-foreground transition-all"
        :class="todo.completed ? 'line-through text-text-completed' : ''"
        @dblclick="emit('startEdit', todo.id, todo.title)"
      >
        {{ todo.title }}
      </span>
      <button
        class="text-muted-foreground opacity-0 transition-all hover:text-primary group-hover:opacity-100"
        :title="t('todo.edit')"
        @click="emit('startEdit', todo.id, todo.title)"
      >
        <Pencil :size="18" />
      </button>
      <button
        class="text-muted-foreground opacity-0 transition-all hover:text-error group-hover:opacity-100"
        @click="emit('delete', todo.id)"
      >
        <Trash2 :size="18" />
      </button>
    </template>
  </div>
</template>
