<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import {
  RotateCcw,
  Trash2,
  Loader2,
  Wand2,
  Target,
  X,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  Zap,
  Timer,
  Rocket,
  Globe,
  CalendarClock,
  Pin,
  PinOff,
  Pencil,
  Plus,
  MoreHorizontal,
} from 'lucide-vue-next'
import { onBeforeUnmount, ref, watch } from 'vue'
import { useTodoStore, type Todo } from '../stores/todo'
import { usePomodoroStore } from '../stores/pomodoro'
import { useIsMobile } from '@/composables/useWindowSize'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import TodoSchedulePopover from './TodoSchedulePopover.vue'
import PomodoroModeSelector from './PomodoroModeSelector.vue'
import type { PomodoroMode } from '../stores/pomodoro'

const { t } = useI18n()
const pomodoroStore = usePomodoroStore()
const todoStore = useTodoStore()
const { isMobile } = useIsMobile()

const props = defineProps<{
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

const isScheduleOpen = ref(false)
const isMobileSheetOpen = ref(false)
const isMobileFocusExpanded = ref(false)
const isMobileScheduleEditorOpen = ref(false)
const focusModes: ReadonlyArray<{
  id: PomodoroMode
  icon: typeof Zap
  color: string
}> = [
  { id: 'icebreaker', icon: Zap, color: 'text-orange-500' },
  { id: 'classic', icon: Timer, color: 'text-primary' },
  { id: 'flow', icon: Rocket, color: 'text-blue-500' },
  { id: 'cosmos', icon: Globe, color: 'text-purple-500' },
]

function handleApplySchedule(dueAt: Date | null, remindAt: Date | null) {
  todoStore.updateTodoSchedule(props.todo.id, dueAt, remindAt)
}

function openMobileSheet() {
  isMobileSheetOpen.value = true
}

function closeMobileSheet() {
  isMobileSheetOpen.value = false
}

function handleMobilePinToggle() {
  void todoStore.togglePin(props.todo.id)
  closeMobileSheet()
}

function handleMobileStartEdit() {
  emit('startEdit')
  closeMobileSheet()
}

function handleMobileBreakdown() {
  if (props.isBreakingDown) return
  emit('breakdown')
  closeMobileSheet()
}

function handleMobileAddSubtask() {
  emit('addSubtask')
  closeMobileSheet()
}

function handleMobileDelete() {
  emit('delete')
  closeMobileSheet()
}

function handleMobileFocusSelect(mode: PomodoroMode) {
  void pomodoroStore.startFocus(props.todo.id, mode)
  closeMobileSheet()
}

function lockBackgroundScroll() {
  if (typeof document === 'undefined') return
  const body = document.body
  const currentCount = Number(body.dataset.todoSheetLockCount ?? '0')

  if (currentCount === 0) {
    body.dataset.todoSheetPrevOverflow = body.style.overflow
    body.dataset.todoSheetPrevTouchAction = body.style.touchAction
    body.style.overflow = 'hidden'
    body.style.touchAction = 'none'
  }

  body.dataset.todoSheetLockCount = String(currentCount + 1)
}

function unlockBackgroundScroll() {
  if (typeof document === 'undefined') return
  const body = document.body
  const currentCount = Number(body.dataset.todoSheetLockCount ?? '0')

  if (currentCount <= 1) {
    body.style.overflow = body.dataset.todoSheetPrevOverflow ?? ''
    body.style.touchAction = body.dataset.todoSheetPrevTouchAction ?? ''
    delete body.dataset.todoSheetLockCount
    delete body.dataset.todoSheetPrevOverflow
    delete body.dataset.todoSheetPrevTouchAction
    return
  }

  body.dataset.todoSheetLockCount = String(currentCount - 1)
}

watch(isMobileSheetOpen, (isOpen) => {
  if (isOpen) {
    lockBackgroundScroll()
    return
  }

  unlockBackgroundScroll()
  isMobileFocusExpanded.value = false
  isMobileScheduleEditorOpen.value = false
})

onBeforeUnmount(() => {
  if (isMobileSheetOpen.value) {
    unlockBackgroundScroll()
  }
})
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
    class="absolute right-0 top-0 bottom-0 flex items-center gap-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 bg-gradient-to-l from-card via-card/95 to-transparent pl-8 md:pl-12 pr-2 md:pr-3 rounded-r-xl transition-all duration-200"
  >
    <!-- Mobile Optimized Layout -->
    <template v-if="isMobile">
      <Button
        variant="ghost"
        size="icon"
        class="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
        @click.stop="openMobileSheet"
      >
        <MoreHorizontal class="h-3.5 w-3.5" />
      </Button>

      <Teleport to="body">
        <Transition name="mobile-sheet-fade">
          <button
            v-if="isMobileSheetOpen"
            type="button"
            class="fixed inset-0 z-[210] bg-black/35 backdrop-blur-[1px]"
            @click.stop="closeMobileSheet"
          />
        </Transition>

        <Transition name="mobile-sheet-slide">
          <div
            v-if="isMobileSheetOpen"
            class="fixed inset-x-0 bottom-0 z-[211] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          >
            <div
              class="mx-auto w-full max-w-md rounded-2xl border border-border/70 bg-card/95 shadow-2xl backdrop-blur-xl"
              @click.stop
            >
              <div class="flex justify-center pt-2.5 pb-1">
                <span class="h-1 w-10 rounded-full bg-muted-foreground/30" />
              </div>

              <div class="px-2 pb-2">
                <div class="mb-1 flex items-center justify-between px-1">
                  <Button
                    v-if="isMobileScheduleEditorOpen"
                    variant="ghost"
                    size="sm"
                    class="h-8 rounded-lg px-2 text-muted-foreground"
                    @click.stop="isMobileScheduleEditorOpen = false"
                  >
                    <ChevronLeft class="h-4 w-4 mr-1" />
                    {{ t('common.back') }}
                  </Button>
                  <div v-else class="h-8" />
                  <Button
                    variant="ghost"
                    size="icon"
                    class="h-7 w-7 text-muted-foreground/75 hover:text-muted-foreground hover:bg-muted/40"
                    @click.stop="closeMobileSheet"
                  >
                    <X class="h-4 w-4" />
                  </Button>
                </div>

                <template v-if="isMobileScheduleEditorOpen">
                  <div class="px-2 pb-2">
                    <TodoSchedulePopover
                      :due-at="todo.dueAt"
                      :remind-at="todo.remindAt"
                      @apply="handleApplySchedule"
                      @close="closeMobileSheet"
                    />
                  </div>
                </template>
                <template v-else>
                  <div class="space-y-1 p-1">
                    <template v-if="!todo.completed">
                      <Button
                        variant="ghost"
                        class="h-11 w-full justify-start gap-2.5 rounded-xl px-3 text-base"
                        @click.stop="isMobileFocusExpanded = !isMobileFocusExpanded"
                      >
                        <Target class="h-4 w-4 text-muted-foreground lucide-target" />
                        <span>{{ t('todo.focus') }}</span>
                        <component
                          :is="isMobileFocusExpanded ? ChevronDown : ChevronRight"
                          class="ml-auto h-4 w-4 text-muted-foreground"
                        />
                      </Button>
                      <div
                        v-if="isMobileFocusExpanded"
                        class="grid grid-cols-2 gap-2 rounded-xl border border-border/60 bg-muted/20 p-2"
                      >
                        <Button
                          v-for="mode in focusModes"
                          :key="mode.id"
                          variant="ghost"
                          class="h-10 justify-start gap-2 rounded-lg px-2.5"
                          @click.stop="handleMobileFocusSelect(mode.id)"
                        >
                          <component :is="mode.icon" class="h-4 w-4" :class="mode.color" />
                          <span class="text-sm">{{ t(`pomodoro.modes.${mode.id}`) }}</span>
                        </Button>
                      </div>
                    </template>

                    <Button
                      v-if="!todo.isProposedDelete"
                      variant="ghost"
                      class="h-11 w-full justify-start gap-2.5 rounded-xl px-3 text-base"
                      @click.stop="isMobileScheduleEditorOpen = true"
                    >
                      <CalendarClock
                        class="h-4 w-4 text-muted-foreground"
                        :class="{ 'text-primary': todo.remindAt || todo.dueAt }"
                      />
                      <span :class="{ 'text-primary': todo.remindAt || todo.dueAt }">{{
                        t('todo.schedule')
                      }}</span>
                      <ChevronRight class="ml-auto h-4 w-4 text-muted-foreground" />
                    </Button>

                    <Button
                      v-if="!todo.completed"
                      variant="ghost"
                      class="h-11 w-full justify-start gap-2.5 rounded-xl px-3 text-base"
                      @click.stop="handleMobileStartEdit"
                    >
                      <Pencil class="h-4 w-4 text-muted-foreground" />
                      <span>{{ t('todo.edit') }}</span>
                    </Button>

                    <Button
                      v-if="(level || 0) < 2 && !todo.completed"
                      variant="ghost"
                      class="h-11 w-full justify-start gap-2.5 rounded-xl px-3 text-base"
                      @click.stop="handleMobileAddSubtask"
                    >
                      <Plus class="h-4 w-4 text-muted-foreground" />
                      <span>{{ t('todo.addSubtask') }}</span>
                    </Button>

                    <Button
                      variant="ghost"
                      class="h-11 w-full justify-start gap-2.5 rounded-xl px-3 text-base"
                      @click.stop="handleMobilePinToggle"
                    >
                      <PinOff
                        v-if="todo.isPinned"
                        class="h-4 w-4 text-muted-foreground lucide-pin-off"
                      />
                      <Pin v-else class="h-4 w-4 text-muted-foreground lucide-pin" />
                      <span>{{ todo.isPinned ? t('todo.unpin') : t('todo.pin') }}</span>
                    </Button>

                    <Button
                      v-if="!todo.completed && !todo.isProposedDelete"
                      variant="ghost"
                      class="h-11 w-full justify-start gap-2.5 rounded-xl px-3 text-base"
                      :disabled="isBreakingDown"
                      @click.stop="handleMobileBreakdown"
                    >
                      <Loader2 v-if="isBreakingDown" class="h-4 w-4 animate-spin text-primary" />
                      <Wand2 v-else class="h-4 w-4 text-muted-foreground" />
                      <span>{{ t('todo.breakdown') }}</span>
                    </Button>

                    <div class="mt-2 border-t border-border/60 pt-2">
                      <Button
                        variant="ghost"
                        class="h-11 w-full justify-start gap-2.5 rounded-xl px-3 text-base text-destructive hover:text-destructive hover:bg-destructive/10"
                        @click.stop="handleMobileDelete"
                      >
                        <Trash2 class="h-4 w-4" />
                        <span>{{ t('todo.delete') }}</span>
                      </Button>
                    </div>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>
    </template>

    <!-- Desktop Layout (Original) -->
    <TooltipProvider v-else :delay-duration="0">
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
            <PopoverContent
              side="bottom"
              :side-offset="10"
              align="end"
              class="w-[92vw] max-w-[760px] max-h-[82vh] overflow-y-auto p-4 z-50"
            >
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

<style scoped>
.mobile-sheet-fade-enter-active,
.mobile-sheet-fade-leave-active {
  transition: opacity 0.2s ease;
}

.mobile-sheet-fade-enter-from,
.mobile-sheet-fade-leave-to {
  opacity: 0;
}

.mobile-sheet-slide-enter-active,
.mobile-sheet-slide-leave-active {
  transition:
    transform 0.24s ease,
    opacity 0.24s ease;
}

.mobile-sheet-slide-enter-from,
.mobile-sheet-slide-leave-to {
  opacity: 0;
  transform: translateY(16px);
}
</style>
