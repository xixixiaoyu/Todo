import type { Todo } from './todo.types'

export function isSameTodoList(left: Todo[], right: Todo[]): boolean {
  if (left.length !== right.length) return false

  for (let i = 0; i < left.length; i += 1) {
    const a = left[i]
    const b = right[i]
    if (
      a.id !== b.id ||
      a.title !== b.title ||
      a.completed !== b.completed ||
      a.order !== b.order ||
      a.isPinned !== b.isPinned ||
      a.parentId !== b.parentId ||
      a.version !== b.version ||
      a.syncStatus !== b.syncStatus ||
      (a.dueAt ? new Date(a.dueAt).getTime() : 0) !== (b.dueAt ? new Date(b.dueAt).getTime() : 0) ||
      (a.remindAt ? new Date(a.remindAt).getTime() : 0) !==
        (b.remindAt ? new Date(b.remindAt).getTime() : 0) ||
      (a.remindedAt ? new Date(a.remindedAt).getTime() : 0) !==
        (b.remindedAt ? new Date(b.remindedAt).getTime() : 0) ||
      (a.recurrenceSpawnedAt ? new Date(a.recurrenceSpawnedAt).getTime() : 0) !==
        (b.recurrenceSpawnedAt ? new Date(b.recurrenceSpawnedAt).getTime() : 0) ||
      (a.recurrenceRule ?? null) !== (b.recurrenceRule ?? null) ||
      (a.recurrenceTz ?? null) !== (b.recurrenceTz ?? null) ||
      (a.createdAt ? new Date(a.createdAt).getTime() : 0) !==
        (b.createdAt ? new Date(b.createdAt).getTime() : 0) ||
      (a.updatedAt ? new Date(a.updatedAt).getTime() : 0) !==
        (b.updatedAt ? new Date(b.updatedAt).getTime() : 0) ||
      (a.completedAt ? new Date(a.completedAt).getTime() : 0) !==
        (b.completedAt ? new Date(b.completedAt).getTime() : 0) ||
      (a.deletedAt ? new Date(a.deletedAt).getTime() : 0) !==
        (b.deletedAt ? new Date(b.deletedAt).getTime() : 0)
    ) {
      return false
    }
  }

  return true
}
