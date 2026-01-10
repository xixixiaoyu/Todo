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
    class="group flex items-center gap-4 rounded-xl border border-[#e8e4dd] bg-white px-4 py-3 transition-all hover:shadow-sm dark:border-[#3a3a3a] dark:bg-[#2a2a2a] dark:hover:shadow-[0_2px_8px_rgba(0,0,0,0.3)]"
  >
    <button
      class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all"
      :class="
        todo.completed
          ? 'border-[#90b494] bg-[#90b494] text-white dark:border-[#7a9b7e] dark:bg-[#7a9b7e]'
          : 'border-[#d4d0c8] hover:border-[#c9b896] dark:border-[#4a4a4a] dark:hover:border-[#b8a785]'
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
        class="flex-1 rounded-lg border border-[#c9b896] bg-white px-2 py-1 text-[#3a3a3a] outline-none focus:ring-2 focus:ring-[#c9b896]/50 dark:border-[#b8a785] dark:bg-[#1a1a1a] dark:text-[#e0e0e0]"
        :placeholder="t('todo.editPlaceholder')"
        @input="emit('update:editingTitle', ($event.target as HTMLInputElement).value)"
        @keydown="emit('editKeydown', $event)"
        @blur="emit('saveEdit')"
      />
      <button
        class="text-[#90b494] transition-all hover:text-[#7a9b7e] dark:text-[#7a9b7e] dark:hover:text-[#90b494]"
        :title="t('todo.save')"
        @click="emit('saveEdit')"
      >
        <Check :size="18" />
      </button>
      <button
        class="text-[#c4c0b8] transition-all hover:text-[#8b8680] dark:text-[#6b6b6b] dark:hover:text-[#a0a0a0]"
        :title="t('todo.cancel')"
        @click="emit('cancelEdit')"
      >
        <X :size="18" />
      </button>
    </template>

    <!-- 显示模式 -->
    <template v-else>
      <span
        class="flex-1 cursor-pointer select-none text-[#3a3a3a] transition-all dark:text-[#e0e0e0]"
        :class="todo.completed ? 'line-through text-[#8b8680] dark:text-[#6b6b6b]' : ''"
        @dblclick="emit('startEdit', todo.id, todo.title)"
      >
        {{ todo.title }}
      </span>
      <button
        class="text-[#c4c0b8] opacity-0 transition-all hover:text-[#c9b896] group-hover:opacity-100 dark:text-[#6b6b6b] dark:hover:text-[#b8a785]"
        :title="t('todo.edit')"
        @click="emit('startEdit', todo.id, todo.title)"
      >
        <Pencil :size="18" />
      </button>
      <button
        class="text-[#c4c0b8] opacity-0 transition-all hover:text-[#d97757] group-hover:opacity-100 dark:text-[#6b6b6b] dark:hover:text-[#e8a08a]"
        @click="emit('delete', todo.id)"
      >
        <Trash2 :size="18" />
      </button>
    </template>
  </div>
</template>
