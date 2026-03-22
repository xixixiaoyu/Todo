import type { SyncConflict as SharedSyncConflict } from '@lumina/shared'
import type { TodoCloudDataDeps } from './todo.cloud.types'
import { cloneTodo } from './todo.dates'
import type { Todo, TodoSyncConflict } from './todo.types'

export function buildTodoSyncConflict(
  conflict: SharedSyncConflict,
  localDraft: Todo | undefined,
  serverSnapshot: Todo | undefined,
): TodoSyncConflict {
  return {
    id: conflict.id,
    reason: conflict.reason,
    serverVersion: conflict.serverVersion,
    localDraft,
    serverSnapshot,
    occurredAt: new Date(),
  }
}

export function createTodoCloudConflictActions(
  deps: TodoCloudDataDeps,
  debouncedSync: () => void,
): {
  acceptSyncConflict: (id: string) => void
  retrySyncConflict: (id: string) => void
  clearSyncConflicts: () => void
} {
  function clearSyncConflicts(): void {
    deps.syncConflicts.value = []
  }

  function acceptSyncConflict(id: string): void {
    const conflict = deps.syncConflicts.value.find((item) => item.id === id)
    if (!conflict) return

    if (conflict.reason === 'TOMBSTONED' || conflict.reason === 'OWNER_MISMATCH') {
      deps.todos.value = deps.todos.value.filter((todo) => todo.id !== id)
      deps.syncConflicts.value = deps.syncConflicts.value.filter((item) => item.id !== id)
      return
    }

    if (conflict.serverSnapshot) {
      const index = deps.todos.value.findIndex((todo) => todo.id === id)
      if (index !== -1) {
        deps.todos.value[index] = cloneTodo(conflict.serverSnapshot)
      } else {
        deps.todos.value.push(cloneTodo(conflict.serverSnapshot))
      }
    } else {
      const todo = deps.todos.value.find((item) => item.id === id)
      if (todo) {
        todo.syncStatus = 'synced'
      }
    }

    deps.syncConflicts.value = deps.syncConflicts.value.filter((item) => item.id !== id)
  }

  function retrySyncConflict(id: string): void {
    const conflict = deps.syncConflicts.value.find((item) => item.id === id)
    if (!conflict || conflict.reason !== 'VERSION_CONFLICT') return

    const localDraft = conflict.localDraft
    if (!localDraft) return

    const index = deps.todos.value.findIndex((todo) => todo.id === id)
    const nextTodo = cloneTodo(localDraft)
    if (typeof conflict.serverVersion === 'number') {
      nextTodo.version = conflict.serverVersion
    }
    nextTodo.updatedAt = new Date()
    nextTodo.syncStatus = 'pending'

    if (index !== -1) {
      deps.todos.value[index] = nextTodo
    } else {
      deps.todos.value.push(nextTodo)
    }

    deps.syncConflicts.value = deps.syncConflicts.value.filter((item) => item.id !== id)
    debouncedSync()
  }

  return {
    acceptSyncConflict,
    retrySyncConflict,
    clearSyncConflicts,
  }
}
