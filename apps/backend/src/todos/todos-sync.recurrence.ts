import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import type { SyncItem } from '@lumina/shared'

dayjs.extend(utc)
dayjs.extend(timezone)

export type RecurrenceRule = 'DAILY' | 'WEEKDAYS' | 'WEEKLY' | 'MONTHLY'

type ExistingRecurringTodoState = {
  completed?: boolean
  remindAt?: Date | null
  remindedAt?: Date | null
  recurrenceRule?: unknown
  recurrenceTz?: unknown
  recurrenceSpawnedAt?: Date | null
}

type ResolvedRecurringState = {
  clientDueAt: Date | null
  clientRemindAt: Date | null
  effectiveRecurrenceRule: RecurrenceRule | null
  effectiveRecurrenceTz: string | null
  recurrenceSpawnedAt: Date | null
  keepRemindedAt: boolean
  shouldSpawnNextRecurring: boolean
}

function isRecurrenceRule(value: unknown): value is RecurrenceRule {
  return value === 'DAILY' || value === 'WEEKDAYS' || value === 'WEEKLY' || value === 'MONTHLY'
}

function hasOwn(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key)
}

function normalizeRecurrenceTz(value: unknown): string | null {
  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  if (!trimmed) return null

  try {
    Intl.DateTimeFormat(undefined, { timeZone: trimmed })
    return trimmed
  } catch {
    return null
  }
}

function toNullableDate(value: unknown): Date | null {
  if (value === null || value === undefined) return null

  const parsed = new Date(value as string | number | Date)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function getNextDueAt(dueAt: Date, rule: RecurrenceRule, recurrenceTz: string | null): Date {
  const timezoneName = recurrenceTz || 'UTC'
  if (rule === 'DAILY') {
    return dayjs(dueAt).tz(timezoneName).add(1, 'day').tz(timezoneName, true).toDate()
  }

  if (rule === 'WEEKLY') {
    return dayjs(dueAt).tz(timezoneName).add(1, 'week').tz(timezoneName, true).toDate()
  }

  if (rule === 'MONTHLY') {
    return dayjs(dueAt).tz(timezoneName).add(1, 'month').tz(timezoneName, true).toDate()
  }

  let next = dayjs(dueAt).tz(timezoneName).add(1, 'day').tz(timezoneName, true)
  while (next.day() === 0 || next.day() === 6) {
    next = next.add(1, 'day').tz(timezoneName, true)
  }
  return next.toDate()
}

function getNextRemindAt(baseDueAt: Date, baseRemindAt: Date | null, nextDueAt: Date): Date | null {
  if (!baseRemindAt) return null

  const deltaMs = baseRemindAt.getTime() - baseDueAt.getTime()
  return new Date(nextDueAt.getTime() + deltaMs)
}

export function resolveRecurringSyncState(params: {
  todo: SyncItem
  existing?: ExistingRecurringTodoState | null
  serverTime: Date
}): ResolvedRecurringState {
  const { todo, existing, serverTime } = params
  const clientDueAt = todo.dueAt ? new Date(todo.dueAt) : null
  const clientRemindAt = todo.remindAt ? new Date(todo.remindAt) : null
  const hasRecurrenceRule = hasOwn(todo, 'recurrenceRule')
  const hasRecurrenceTz = hasOwn(todo, 'recurrenceTz')
  const hasRecurrenceSpawnedAt = hasOwn(todo, 'recurrenceSpawnedAt')

  const recurrenceRule = hasRecurrenceRule
    ? isRecurrenceRule(todo.recurrenceRule)
      ? todo.recurrenceRule
      : null
    : isRecurrenceRule(existing?.recurrenceRule)
      ? existing.recurrenceRule
      : null

  const recurrenceTz = recurrenceRule
    ? hasRecurrenceTz
      ? normalizeRecurrenceTz(todo.recurrenceTz)
      : normalizeRecurrenceTz(existing?.recurrenceTz)
    : null

  const recurrenceSpawnedAtInput = hasRecurrenceSpawnedAt
    ? toNullableDate(todo.recurrenceSpawnedAt)
    : undefined

  const effectiveRecurrenceRule = clientDueAt ? recurrenceRule : null
  const effectiveRecurrenceTz = effectiveRecurrenceRule ? recurrenceTz : null
  const keepRemindedAt =
    !!existing?.remindAt &&
    !!existing.remindedAt &&
    !!clientRemindAt &&
    existing.remindAt.getTime() === clientRemindAt.getTime()

  const shouldSpawnNextRecurring =
    !!existing &&
    !existing.completed &&
    todo.completed &&
    !todo.deletedAt &&
    !!effectiveRecurrenceRule &&
    (todo.parentId ?? null) === null &&
    !existing.recurrenceSpawnedAt

  const recurrenceSpawnedAt = shouldSpawnNextRecurring
    ? serverTime
    : effectiveRecurrenceRule
      ? recurrenceSpawnedAtInput === undefined
        ? (existing?.recurrenceSpawnedAt ?? null)
        : recurrenceSpawnedAtInput
      : null

  return {
    clientDueAt,
    clientRemindAt,
    effectiveRecurrenceRule,
    effectiveRecurrenceTz,
    recurrenceSpawnedAt,
    keepRemindedAt,
    shouldSpawnNextRecurring,
  }
}

export function createNextRecurringTodoData(params: {
  id: string
  todo: SyncItem
  userId: number
  serverTime: Date
  dueAt: Date
  remindAt: Date | null
  recurrenceRule: RecurrenceRule
  recurrenceTz: string | null
}): {
  id: string
  title: string
  completed: false
  order: number
  isPinned: boolean
  parentId: null
  userId: number
  version: 1
  dueAt: Date
  remindAt: Date | null
  remindedAt: null
  recurrenceRule: RecurrenceRule
  recurrenceTz: string | null
  recurrenceSpawnedAt: null
  createdAt: Date
  updatedAt: Date
  completedAt: null
  deletedAt: null
  pomodoroCount: 0
} {
  const nextDueAt = getNextDueAt(params.dueAt, params.recurrenceRule, params.recurrenceTz)
  const nextRemindAt = getNextRemindAt(params.dueAt, params.remindAt, nextDueAt)

  return {
    id: params.id,
    title: params.todo.title,
    completed: false,
    order: params.todo.order,
    isPinned: params.todo.isPinned,
    parentId: null,
    userId: params.userId,
    version: 1,
    dueAt: nextDueAt,
    remindAt: nextRemindAt,
    remindedAt: null,
    recurrenceRule: params.recurrenceRule,
    recurrenceTz: params.recurrenceTz,
    recurrenceSpawnedAt: null,
    createdAt: params.serverTime,
    updatedAt: params.serverTime,
    completedAt: null,
    deletedAt: null,
    pomodoroCount: 0,
  }
}
