<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import {
  RotateCcw,
  Trash2,
  Loader2,
  Wand2,
  Target,
  CalendarClock,
  Pin,
  PinOff,
  Pencil,
  Plus,
} from 'lucide-vue-next'
import { ref } from 'vue'
import { useTodoStore, type Todo } from '../stores/todo'
import { usePomodoroStore } from '../stores/pomodoro'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import TodoSchedulePopover from './TodoSchedulePopover.vue'
import PomodoroModeSelector from './PomodoroModeSelector.vue'

const { t } = useI18n()
const pomodoroStore = usePomodoroStore()
const todoStore = useTodoStore()

const props = defineProps<{
  todo: Todo
  isBreakingDown: boolean
  isMobileActionsVisible: boolean
  level?: number
}>()

const emit = defineEmits<{
  startEdit: []
  delete: []
  breakdown: []
  addSubtask: []
  permanentDelete: []
}>()

const isScheduleOpen = ref(false)

function handleApplySchedule(dueAt: Date | null, remindAt: Date | null) {
  todoStore.updateTodoSchedule(props.todo.id, dueAt, remindAt)
}
</script>

<template>
  <!-- Trash Mode Actions -->
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
            @click.stop="emit('permanentDelete')"
          >
            <Trash2 class="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">{{ t('todo.delete') }}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  </div>

  <!-- Normal Mode Actions -->
  <div
    v-else
    class="absolute right-0 top-0 bottom-0 flex items-center gap-0.5 opacity-0 md:group-hover:opacity-100 bg-gradient-to-l from-card via-card/95 to-transparent pl-8 md:pl-12 pr-2 md:pr-3 rounded-r-xl transition-all duration-200"
    :class="{ 'opacity-100': isMobileActionsVisible }"
  >
    <TooltipProvider :delay-duration="0">
      <!-- AI Breakdown -->
      <Tooltip v-if="!todo.completed && !todo.isProposedDelete">
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            class="group h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 relative overflow-hidden transition-all duration-300"
            :class="{ 'text-primary bg-primary/10 ring-1 ring-primary/20': isBreakingDown }"
            :disabled="isBreakingDown"
            @click.stop="emit('breakdown')"
          >
            <Loader2
              v-if="isBreakingDown"
              class="h-3.5 w-3.5 md:h-4 md:w-4 animate-spin text-primary relative z-10"
            />
            <Wand2
              v-else
              class="h-3.5 w-3.5 md:h-4 md:w-4 transition-transform group-hover:rotate-12 group-hover:scale-110 relative z-10"
            />

            <!-- Shimmer effect during loading -->
            <div
              v-if="isBreakingDown"
              class="absolute inset-0 bg-gradient-to-r from-transparent via-primary/20 to-transparent animate-shimmer"
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">{{ t('todo.breakdown') }}</TooltipContent>
      </Tooltip>

      <!-- Focus -->
      <Tooltip v-if="!todo.completed">
        <TooltipTrigger as-child>
          <PomodoroModeSelector
            :todo-id="todo.id"
            @select="pomodoroStore.startFocus(todo.id, $event)"
          >
            <Button
              variant="ghost"
              size="icon"
              class="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
              :class="{ 'text-primary bg-primary/5': pomodoroStore.activeTodoId === todo.id }"
              @click.stop
            >
              <Target class="h-3.5 w-3.5 md:h-4 md:w-4 lucide-target" />
            </Button>
          </PomodoroModeSelector>
        </TooltipTrigger>
        <TooltipContent side="top">{{ t('todo.focus') }}</TooltipContent>
      </Tooltip>

      <Tooltip v-if="!todo.isProposedDelete">
        <TooltipTrigger as-child>
          <Popover v-model:open="isScheduleOpen">
            <PopoverTrigger as-child>
              <Button
                variant="ghost"
                size="icon"
                class="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                :class="todo.remindAt || todo.dueAt ? 'text-primary bg-primary/5' : ''"
                @click.stop
              >
                <CalendarClock class="h-3.5 w-3.5 md:h-4 md:w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent side="bottom" :side-offset="10" align="end" class="w-[380px] p-4 z-50">
              <TodoSchedulePopover
                :due-at="todo.dueAt"
                :remind-at="todo.remindAt"
                @apply="handleApplySchedule"
                @close="isScheduleOpen = false"
              />
            </PopoverContent>
          </Popover>
        </TooltipTrigger>
        <TooltipContent side="top">{{ t('todo.schedule') }}</TooltipContent>
      </Tooltip>

      <!-- Pin -->
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            class="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
            :class="{ 'text-primary bg-primary/5': todo.isPinned }"
            @click.stop="todoStore.togglePin(todo.id)"
          >
            <PinOff v-if="todo.isPinned" class="h-3.5 w-3.5 md:h-4 md:w-4 lucide-pin-off" />
            <Pin v-else class="h-3.5 w-3.5 md:h-4 md:w-4 lucide-pin" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">{{
          todo.isPinned ? t('todo.unpin') : t('todo.pin')
        }}</TooltipContent>
      </Tooltip>

      <!-- Edit -->
      <Tooltip v-if="!todo.completed">
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            class="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
            @click.stop="emit('startEdit')"
          >
            <Pencil class="h-3.5 w-3.5 md:h-4 md:w-4 lucide-pencil" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">{{ t('todo.edit') }}</TooltipContent>
      </Tooltip>

      <!-- Add Subtask -->
      <Tooltip v-if="(level || 0) < 2 && !todo.completed">
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            class="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
            @click.stop="emit('addSubtask')"
          >
            <Plus class="h-3.5 w-3.5 md:h-4 md:w-4 lucide-plus" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">{{ t('todo.addSubtask') }}</TooltipContent>
      </Tooltip>

      <!-- Delete -->
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            class="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            @click.stop="emit('delete')"
          >
            <Trash2 class="h-3.5 w-3.5 md:h-4 md:w-4 lucide-trash2" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">{{ t('todo.delete') }}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  </div>
</template>
