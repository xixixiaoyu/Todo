<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Check, X, Pencil, Trash2 } from 'lucide-vue-next'
import type { Todo } from '../stores/todo'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

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
    class="group flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3.5 transition-all hover:shadow-md hover:border-primary/20 dark:hover:shadow-[0_4px_12px_rgba(0,0,0,0.4)]"
  >
    <Checkbox
      :model-value="todo.completed"
      class="h-5 w-5 rounded-full border-2 data-[state=checked]:bg-success data-[state=checked]:border-success transition-transform active:scale-90"
      @update:model-value="emit('toggle', todo.id, todo.completed)"
    />

    <!-- 编辑模式 -->
    <template v-if="editingId === todo.id">
      <Input
        :model-value="editingTitle"
        type="text"
        class="h-10 flex-1 bg-background text-foreground text-base focus-visible:ring-primary/20"
        :placeholder="t('todo.editPlaceholder')"
        auto-focus
        @update:model-value="emit('update:editingTitle', $event as string)"
        @keydown="emit('editKeydown', $event)"
        @blur="emit('saveEdit')"
      />
      <div class="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          class="h-8 w-8 text-success hover:bg-success/10"
          @click="emit('saveEdit')"
        >
          <Check class="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          class="h-8 w-8 text-muted-foreground hover:bg-muted"
          @click="emit('cancelEdit')"
        >
          <X class="h-4 w-4" />
        </Button>
      </div>
    </template>

    <!-- 显示模式 -->
    <template v-else>
      <span
        class="flex-1 cursor-pointer select-none text-foreground transition-all duration-300"
        :class="todo.completed ? 'line-through text-muted-foreground/50' : ''"
        @dblclick="emit('startEdit', todo.id, todo.title)"
      >
        {{ todo.title }}
      </span>
      <div class="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              class="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
              @click="emit('startEdit', todo.id, todo.title)"
            >
              <Pencil class="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{{ t('todo.edit') }}</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              class="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              @click="emit('delete', todo.id)"
            >
              <Trash2 class="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{{ t('common.delete') || 'Delete' }}</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </template>
  </div>
</template>
