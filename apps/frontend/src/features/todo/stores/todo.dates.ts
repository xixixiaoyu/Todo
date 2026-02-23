import type { Todo } from './todo.types'

export function toDate(value: unknown): Date | null {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

export function normalizeTodoDatesInPlace(todo: Todo): void {
  const createdAt = toDate(todo.createdAt)
  if (createdAt) todo.createdAt = createdAt

  const updatedAt = toDate(todo.updatedAt)
  if (updatedAt) todo.updatedAt = updatedAt

  const completedAt = toDate(todo.completedAt)
  if (completedAt) todo.completedAt = completedAt

  const deletedAt = toDate(todo.deletedAt)
  if (deletedAt) todo.deletedAt = deletedAt

  const dueAt = toDate(todo.dueAt)
  if (dueAt) todo.dueAt = dueAt

  const remindAt = toDate(todo.remindAt)
  if (remindAt) todo.remindAt = remindAt

  const remindedAt = toDate(todo.remindedAt)
  if (remindedAt) todo.remindedAt = remindedAt
}
