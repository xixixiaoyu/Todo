<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { RotateCcw, Trash2 } from 'lucide-vue-next'
import { useIsMobile } from '@/composables/useWindowSize'
import { useTodoStore, type Todo } from '../stores/todo'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import TodoItemActionsDesktop from './TodoItemActionsDesktop.vue'
import TodoItemActionsMobileSheet from './TodoItemActionsMobileSheet.vue'

const { t } = useI18n()
const todoStore = useTodoStore()
const { isMobile } = useIsMobile()

defineProps<{
  todo: Todo
  isBreakingDown: boolean
  level?: number
}>()

const emit = defineEmits<{
  startEdit: []
  delete: []
  breakdown: []
  addSubtask: []
  permanentDelete: []
}>()

function handlePermanentDelete() {
  emit('permanentDelete')
}
</script>

<template>
  <div
    v-if="todoStore.filter === 'trash'"
    class="absolute right-0 top-0 bottom-0 flex items-center gap-1 px-3 bg-gradient-to-l from-card via-card/95 to-transparent rounded-r-xl"
  >
    <TooltipProvider :delay-duration="0">
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            class="h-8 w-8 text-primary hover:bg-primary/10"
            @click.stop="todoStore.restoreTodo(todo.id)"
          >
            <RotateCcw class="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">{{ t('todo.restore') }}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            class="h-8 w-8 text-destructive hover:bg-destructive/10 transition-colors"
            @click.stop="handlePermanentDelete"
          >
            <Trash2 class="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">{{ t('todo.delete') }}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  </div>

  <TodoItemActionsMobileSheet
    v-else-if="isMobile"
    :todo="todo"
    :is-breaking-down="isBreakingDown"
    :level="level"
    @start-edit="emit('startEdit')"
    @delete="emit('delete')"
    @breakdown="emit('breakdown')"
    @add-subtask="emit('addSubtask')"
  />

  <TodoItemActionsDesktop
    v-else
    :todo="todo"
    :is-breaking-down="isBreakingDown"
    :level="level"
    @start-edit="emit('startEdit')"
    @delete="emit('delete')"
    @breakdown="emit('breakdown')"
    @add-subtask="emit('addSubtask')"
  />
</template>
