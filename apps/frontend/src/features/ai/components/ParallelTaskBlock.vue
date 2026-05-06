<script setup lang="ts">
import { computed, ref } from 'vue'

export interface SubtaskState {
  id: string
  subject: string
  status: 'pending' | 'running' | 'done' | 'failed' | 'aborted'
  content: string
  thinkingContent: string
  error: string | null
  startedAt: number | null
  completedAt: number | null
}

const props = defineProps<{
  tasks: SubtaskState[]
  isRunning: boolean
}>()

defineEmits<{
  (e: 'abortTask', taskId: string): void
  (e: 'abortAll'): void
}>()

const expandedTasks = ref(new Set<string>())

const doneCount = computed(() => props.tasks.filter((t) => t.status === 'done').length)
const failedCount = computed(() => props.tasks.filter((t) => t.status === 'failed').length)

function toggleExpand(taskId: string) {
  const next = new Set(expandedTasks.value)
  if (next.has(taskId)) {
    next.delete(taskId)
  } else {
    next.add(taskId)
  }
  expandedTasks.value = next
}

function formatDuration(startedAt: number | null, completedAt: number | null): string {
  if (!startedAt) return ''
  const end = completedAt || Date.now()
  const ms = end - startedAt
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
}
</script>

<template>
  <div class="parallel-task-block">
    <div class="parallel-task-block__header">
      <span class="parallel-task-block__title">
        {{ isRunning ? 'Executing parallel tasks...' : 'Parallel tasks' }}
      </span>
      <span class="parallel-task-block__summary">
        {{ doneCount }}/{{ tasks.length }} done
        <template v-if="failedCount > 0"> · {{ failedCount }} failed </template>
      </span>
      <button v-if="isRunning" class="parallel-task-block__abort-all" @click="$emit('abortAll')">
        Abort all
      </button>
    </div>

    <div class="parallel-task-block__list">
      <div
        v-for="task in tasks"
        :key="task.id"
        class="parallel-task-block__item"
        :class="`parallel-task-block__item--${task.status}`"
      >
        <div class="parallel-task-block__item-header">
          <span class="parallel-task-block__item-status">
            <span v-if="task.status === 'pending'" class="status-dot status-dot--pending">○</span>
            <span v-else-if="task.status === 'running'" class="status-dot status-dot--running"
              >◉</span
            >
            <span v-else-if="task.status === 'done'" class="status-dot status-dot--done">●</span>
            <span v-else-if="task.status === 'failed'" class="status-dot status-dot--failed"
              >✕</span
            >
            <span v-else class="status-dot status-dot--aborted">⊘</span>
          </span>
          <span class="parallel-task-block__item-subject">{{ task.subject }}</span>
          <span v-if="task.startedAt" class="parallel-task-block__item-time">
            {{ formatDuration(task.startedAt, task.completedAt) }}
          </span>
          <button
            v-if="task.status === 'running'"
            class="parallel-task-block__abort"
            @click="$emit('abortTask', task.id)"
          >
            Abort
          </button>
        </div>

        <div
          v-if="task.thinkingContent && expandedTasks.has(task.id)"
          class="parallel-task-block__thinking"
        >
          <div class="parallel-task-block__thinking-label">Thinking:</div>
          <pre class="parallel-task-block__thinking-content">{{ task.thinkingContent }}</pre>
        </div>

        <div v-if="task.content && expandedTasks.has(task.id)" class="parallel-task-block__content">
          <pre class="parallel-task-block__pre">{{ task.content }}</pre>
        </div>

        <div v-if="task.error" class="parallel-task-block__error">Error: {{ task.error }}</div>

        <button
          v-if="task.content || task.thinkingContent"
          class="parallel-task-block__toggle"
          @click="toggleExpand(task.id)"
        >
          {{ expandedTasks.has(task.id) ? 'Collapse' : 'Expand' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.parallel-task-block {
  border: 1px solid var(--color-border, #e0e0e0);
  border-radius: 10px;
  overflow: hidden;
  margin: 8px 0;
  background: var(--color-surface, #fff);
}

.parallel-task-block__header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  background: var(--color-surface-secondary, #f8f8f8);
  border-bottom: 1px solid var(--color-border, #e0e0e0);
}

.parallel-task-block__title {
  font-weight: 600;
  font-size: 0.85rem;
}

.parallel-task-block__summary {
  font-size: 0.75rem;
  color: var(--color-text-secondary, #888);
}

.parallel-task-block__abort-all {
  margin-left: auto;
  background: none;
  border: 1px solid #e74c3c;
  color: #e74c3c;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.72rem;
  cursor: pointer;
}

.parallel-task-block__abort-all:hover {
  background: #e74c3c;
  color: #fff;
}

.parallel-task-block__list {
  padding: 6px 0;
}

.parallel-task-block__item {
  padding: 6px 14px;
  border-bottom: 1px solid var(--color-border-light, #f0f0f0);
}

.parallel-task-block__item:last-child {
  border-bottom: none;
}

.parallel-task-block__item-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-dot {
  font-size: 0.7rem;
  flex-shrink: 0;
  width: 14px;
  text-align: center;
}

.status-dot--pending {
  color: var(--color-text-disabled, #bbb);
}
.status-dot--running {
  color: #3498db;
  animation: pulse 1.5s ease-in-out infinite;
}
.status-dot--done {
  color: #27ae60;
}
.status-dot--failed {
  color: #e74c3c;
}
.status-dot--aborted {
  color: #f39c12;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}

.parallel-task-block__item-subject {
  font-size: 0.82rem;
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.parallel-task-block__item-time {
  font-size: 0.7rem;
  color: var(--color-text-secondary, #888);
  flex-shrink: 0;
}

.parallel-task-block__abort {
  background: none;
  border: none;
  color: #e74c3c;
  font-size: 0.7rem;
  cursor: pointer;
  padding: 1px 4px;
}

.parallel-task-block__thinking,
.parallel-task-block__content {
  margin-top: 6px;
  padding: 6px 8px;
  background: var(--color-surface-secondary, #f8f8f8);
  border-radius: 4px;
}

.parallel-task-block__thinking-label {
  font-size: 0.7rem;
  color: var(--color-text-secondary, #888);
  margin-bottom: 4px;
}

.parallel-task-block__thinking-content,
.parallel-task-block__pre {
  font-size: 0.75rem;
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 200px;
  overflow-y: auto;
  margin: 0;
  font-family: var(--font-mono, monospace);
}

.parallel-task-block__error {
  font-size: 0.75rem;
  color: #e74c3c;
  margin-top: 4px;
}

.parallel-task-block__toggle {
  background: none;
  border: none;
  color: var(--color-accent, #3498db);
  font-size: 0.72rem;
  cursor: pointer;
  padding: 2px 0;
  margin-top: 2px;
}
</style>
