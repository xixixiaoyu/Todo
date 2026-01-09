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
    class="group flex items-center gap-4 rounded-xl border border-[#e8e4dd] bg-white px-4 py-3 transition-all hover:shadow-sm"
  >
    <button
      class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all"
      :class="
        todo.completed
          ? 'border-[#90b494] bg-[#90b494] text-white'
          : 'border-[#d4d0c8] hover:border-[#c9b896]'
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
        class="flex-1 rounded-lg border border-[#c9b896] bg-white px-2 py-1 text-[#3a3a3a] outline-none focus:ring-2 focus:ring-[#c9b896]/50"
        :placeholder="t('todo.editPlaceholder')"
        @input="emit('update:editingTitle', ($event.target as HTMLInputElement).value)"
        @keydown="emit('editKeydown', $event)"
      />
      <button
        class="text-[#90b494] transition-all hover:text-[#7a9b7e]"
        :title="t('todo.save')"
        @click="emit('saveEdit')"
      >
        <Check :size="18" />
      </button>
      <button
        class="text-[#c4c0b8] transition-all hover:text-[#8b8680]"
        :title="t('todo.cancel')"
        @click="emit('cancelEdit')"
      >
        <X :size="18" />
      </button>
    </template>

    <!-- 显示模式 -->
    <template v-else>
      <span
        class="flex-1 text-[#3a3a3a] transition-all"
        :class="todo.completed ? 'text-[#8b8680] line-through' : ''"
      >
        {{ todo.title }}
      </span>
      <button
        class="text-[#c4c0b8] opacity-0 transition-all hover:text-[#c9b896] group-hover:opacity-100"
        :title="t('todo.edit')"
        @click="emit('startEdit', todo.id, todo.title)"
      >
        <Pencil :size="18" />
      </button>
      <button
        class="text-[#c4c0b8] opacity-0 transition-all hover:text-[#d97757] group-hover:opacity-100"
        @click="emit('delete', todo.id)"
      >
        <Trash2 :size="18" />
      </button>
    </template>
  </div>
</template>
