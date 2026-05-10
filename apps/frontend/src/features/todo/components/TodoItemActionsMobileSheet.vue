<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import {
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
  Clock3,
  MoreHorizontal,
} from 'lucide-vue-next'
import { onBeforeUnmount, ref, watch } from 'vue'
import { useTodoStore } from '../stores/todo'
import type { Todo } from '../stores/todo'
import { usePomodoroStore } from '../stores/pomodoro'
import type { PomodoroMode } from '../stores/pomodoro'
import { useBodyScrollLock } from '../composables/useBodyScrollLock'
import { Button } from '@/components/ui/button'
import TodoSchedulePopover from './TodoSchedulePopover.vue'

const { t } = useI18n()
const pomodoroStore = usePomodoroStore()
const todoStore = useTodoStore()
const { lockBodyScroll, unlockBodyScroll } = useBodyScrollLock()

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
}>()

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

function handleApplySchedule(
  dueAt: Date | null,
  remindAt: Date | null,
  recurrenceRule: Todo['recurrenceRule'],
) {
  todoStore.updateTodoSchedule(props.todo.id, dueAt, remindAt, recurrenceRule)
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

function handleMobileDeferredToggle() {
  void todoStore.setTodoDeferred(props.todo.id, !props.todo.deferredAt)
  closeMobileSheet()
}

function handleMobileFocusSelect(mode: PomodoroMode) {
  void pomodoroStore.startFocus(props.todo.id, mode)
  closeMobileSheet()
}

watch(isMobileSheetOpen, (isOpen) => {
  if (isOpen) {
    lockBodyScroll()
    return
  }

  unlockBodyScroll()
  isMobileFocusExpanded.value = false
  isMobileScheduleEditorOpen.value = false
})

onBeforeUnmount(() => {
  if (isMobileSheetOpen.value) {
    unlockBodyScroll()
  }
})
</script>

<template>
  <Button
    variant="ghost"
    size="icon"
    class="h-7 w-7 rounded-[14px] text-muted-foreground/70 hover:bg-primary/10 hover:text-primary md:h-8 md:w-8 md:rounded-md"
    @click.stop="openMobileSheet"
  >
    <MoreHorizontal class="h-3 w-3" />
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
                  :recurrence-rule="todo.recurrenceRule"
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
                  <span :class="{ 'text-primary': todo.remindAt || todo.dueAt }">
                    {{ t('todo.schedule') }}
                  </span>
                  <ChevronRight class="ml-auto h-4 w-4 text-muted-foreground" />
                </Button>

                <Button
                  v-if="(level || 0) === 0 && !todo.completed && !todo.isProposedDelete"
                  variant="ghost"
                  class="h-11 w-full justify-start gap-2.5 rounded-xl px-3 text-base"
                  @click.stop="handleMobileDeferredToggle"
                >
                  <Clock3
                    class="h-4 w-4 text-muted-foreground"
                    :class="{ 'text-primary': todo.deferredAt }"
                  />
                  <span :class="{ 'text-primary': todo.deferredAt }">
                    {{ todo.deferredAt ? t('todo.resumeFromDeferred') : t('todo.defer') }}
                  </span>
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
