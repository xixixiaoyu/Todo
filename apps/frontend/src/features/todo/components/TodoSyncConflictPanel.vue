<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-vue-next'
import type { Todo, TodoSyncConflict } from '../stores/todo.types'
import { Button } from '@/components/ui/button'

const { t } = useI18n()

const props = defineProps<{
  conflicts: TodoSyncConflict[]
  todos: Todo[]
}>()

const emit = defineEmits<{
  clearAll: []
  accept: [id: string]
  retry: [id: string]
}>()

const isOpen = ref(false)

const conflictReasonLabel = (reason: 'TOMBSTONED' | 'OWNER_MISMATCH' | 'VERSION_CONFLICT') => {
  if (reason === 'TOMBSTONED') return t('todo.syncConflictReasonTombstoned')
  if (reason === 'OWNER_MISMATCH') return t('todo.syncConflictReasonOwnerMismatch')
  return t('todo.syncConflictReasonVersion')
}

const getConflictTitle = (id: string) => {
  const conflict = props.conflicts.find((item) => item.id === id)
  return (
    conflict?.localDraft?.title ||
    conflict?.serverSnapshot?.title ||
    props.todos.find((todo) => todo.id === id)?.title ||
    t('todo.syncConflictUnknownTitle')
  )
}

const canRetryConflict = (reason: 'TOMBSTONED' | 'OWNER_MISMATCH' | 'VERSION_CONFLICT') =>
  reason === 'VERSION_CONFLICT'

const conflictCountLabel = computed(() =>
  t('todo.syncConflictBanner', { count: props.conflicts.length }),
)
</script>

<template>
  <div
    v-if="conflicts.length > 0"
    class="mb-3 md:mb-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3 py-3 md:px-4 md:py-3"
  >
    <div class="flex items-center justify-between gap-3">
      <div class="flex items-center gap-2 text-amber-700 dark:text-amber-300">
        <AlertTriangle class="h-4 w-4 md:h-5 md:w-5" />
        <p class="text-[var(--todo-font-meta)] font-semibold">
          {{ conflictCountLabel }}
        </p>
      </div>
      <div class="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          class="h-8 rounded-lg px-2 text-[var(--todo-font-caption)] hover:bg-amber-500/10"
          @click="emit('clearAll')"
        >
          {{ t('todo.syncConflictDismissAll') }}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          class="h-8 w-8 rounded-lg hover:bg-amber-500/10"
          @click="isOpen = !isOpen"
        >
          <ChevronUp v-if="isOpen" class="h-4 w-4" />
          <ChevronDown v-else class="h-4 w-4" />
        </Button>
      </div>
    </div>

    <div v-if="isOpen" class="mt-3 space-y-2">
      <div
        v-for="conflict in conflicts"
        :key="conflict.id"
        class="rounded-xl border border-amber-500/25 bg-background/60 px-3 py-2"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="truncate text-[var(--todo-font-meta)] font-semibold text-foreground">
              {{ getConflictTitle(conflict.id) }}
            </p>
            <p class="text-[var(--todo-font-caption)] text-muted-foreground mt-0.5">
              {{ conflictReasonLabel(conflict.reason) }}
            </p>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <Button
              variant="outline"
              size="sm"
              class="h-7 rounded-lg px-2 text-[var(--todo-font-caption)]"
              @click="emit('accept', conflict.id)"
            >
              {{ t('todo.syncConflictAcceptServer') }}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              class="h-7 rounded-lg px-2 text-[var(--todo-font-caption)]"
              :disabled="!canRetryConflict(conflict.reason)"
              @click="emit('retry', conflict.id)"
            >
              {{ t('todo.syncConflictRetryLocal') }}
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
