import type { RecurrenceRule } from '@lumina/shared'
import { toDate } from './todo.dates'

export function resolveScheduleDate(
  dueAt: Date | string | number | null | undefined,
  remindAt: Date | string | number | null | undefined,
): Date | null {
  const dueDate = toDate(dueAt)
  if (dueDate) {
    return new Date(dueDate)
  }

  const remindDate = toDate(remindAt)
  return remindDate ? new Date(remindDate) : null
}

export function buildFixedReminderAt(dueAt: Date | null): Date | null {
  if (!dueAt) return null
  return new Date(dueAt)
}

export function isReminderOnlySchedule(
  dueAt: Date | string | number | null | undefined,
  remindAt: Date | string | number | null | undefined,
): boolean {
  return !toDate(dueAt) && !!toDate(remindAt)
}

export function hasDistinctReminderTime(
  dueAt: Date | string | number | null | undefined,
  remindAt: Date | string | number | null | undefined,
): boolean {
  const remindDate = toDate(remindAt)
  if (!remindDate) return false

  const dueDate = toDate(dueAt)
  if (!dueDate) return true

  return dueDate.getTime() !== remindDate.getTime()
}

export function resolveScheduleUpdate(
  dueAt: Date | string | number | null | undefined,
  remindAt: Date | string | number | null | undefined,
  nextDate: Date | null,
  recurrenceRule: RecurrenceRule | null,
): { dueAt: Date | null; remindAt: Date | null } {
  if (!nextDate) {
    return {
      dueAt: null,
      remindAt: null,
    }
  }

  const nextDueAt = new Date(nextDate)
  const dueDate = toDate(dueAt)
  const remindDate = toDate(remindAt)

  if (!dueDate && remindDate && !recurrenceRule) {
    return {
      dueAt: null,
      remindAt: new Date(nextDueAt),
    }
  }

  if (dueDate && remindDate && dueDate.getTime() !== remindDate.getTime()) {
    const reminderOffset = remindDate.getTime() - dueDate.getTime()

    return {
      dueAt: nextDueAt,
      remindAt: new Date(nextDueAt.getTime() + reminderOffset),
    }
  }

  return {
    dueAt: nextDueAt,
    remindAt: buildFixedReminderAt(nextDueAt),
  }
}
