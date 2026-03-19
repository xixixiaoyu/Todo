import { Injectable, Inject } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { PrismaService } from '../prisma/prisma.service'
import { SyncMergeDto } from './todos.dto'
import type { SyncItem } from '@lumina/shared'
import { EventsGateway } from '../events/events.gateway'
import type { Prisma } from '@prisma/client'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)

const todoSelect = {
  id: true,
  title: true,
  completed: true,
  order: true,
  isPinned: true,
  parentId: true,
  version: true,
  dueAt: true,
  remindAt: true,
  remindedAt: true,
  recurrenceRule: true,
  recurrenceTz: true,
  recurrenceSpawnedAt: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  deletedAt: true,
  pomodoroCount: true,
} as const

type TodoPublic = Prisma.TodoGetPayload<{ select: typeof todoSelect }>
type SyncConflictReason = 'TOMBSTONED' | 'OWNER_MISMATCH' | 'VERSION_CONFLICT'
type RecurrenceRule = 'DAILY' | 'WEEKDAYS' | 'WEEKLY' | 'MONTHLY'

interface SyncConflict {
  id: string
  reason: SyncConflictReason
  serverVersion?: number
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
  if (rule === 'DAILY')
    return dayjs(dueAt).tz(timezoneName).add(1, 'day').tz(timezoneName, true).toDate()
  if (rule === 'WEEKLY')
    return dayjs(dueAt).tz(timezoneName).add(1, 'week').tz(timezoneName, true).toDate()
  if (rule === 'MONTHLY')
    return dayjs(dueAt).tz(timezoneName).add(1, 'month').tz(timezoneName, true).toDate()

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

@Injectable()
export class TodoSyncService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EventsGateway)
    private readonly eventsGateway: EventsGateway,
  ) {}

  /**
   * 增量同步与合并逻辑
   */
  async sync(userId: number, syncDto: SyncMergeDto, excludeSocketId?: string) {
    const { todos, lastSyncAt } = syncDto
    const serverTime = new Date()
    const rawSince = lastSyncAt ? new Date(lastSyncAt) : new Date(0)
    const since = Number.isNaN(rawSince.getTime())
      ? new Date(0)
      : rawSince.getTime() > serverTime.getTime()
        ? serverTime
        : rawSince

    // 1. 处理客户端推送的变更 (使用事务保证原子性)
    const successfullyUpdatedItems: TodoPublic[] = []
    const acceptedIds: string[] = []
    const conflicts: SyncConflict[] = []
    if (todos && todos.length > 0) {
      await this.prisma.$transaction(async (tx) => {
        for (const todo of todos as SyncItem[]) {
          const tombstone = await tx.todoTombstone.findUnique({
            where: { userId_todoId: { userId, todoId: todo.id } },
            select: { deletedAt: true },
          })
          if (tombstone) {
            conflicts.push({ id: todo.id, reason: 'TOMBSTONED' })
            continue
          }

          const existing = await tx.todo.findUnique({
            where: { id: todo.id },
            select: {
              userId: true,
              version: true,
              completed: true,
              remindAt: true,
              remindedAt: true,
              recurrenceRule: true,
              recurrenceTz: true,
              recurrenceSpawnedAt: true,
            },
          })

          const clientVersion = todo.version ?? 0
          const clientRemindAt = todo.remindAt ? new Date(todo.remindAt) : null
          const clientDueAt = todo.dueAt ? new Date(todo.dueAt) : null
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

          // 服务端兜底：循环任务必须绑定截止时间，避免写入无效状态
          const effectiveRecurrenceRule = clientDueAt ? recurrenceRule : null
          const effectiveRecurrenceTz = effectiveRecurrenceRule ? recurrenceTz : null

          if (existing && existing.userId !== userId) {
            conflicts.push({ id: todo.id, reason: 'OWNER_MISMATCH' })
            continue
          }

          // 冲突检测逻辑：严格版本匹配，避免客户端时钟漂移影响
          if (existing) {
            const serverVersion = existing.version ?? 0
            if (clientVersion !== serverVersion) {
              conflicts.push({
                id: todo.id,
                reason: 'VERSION_CONFLICT',
                serverVersion,
              })
              continue
            }
          }

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

          const data = {
            title: todo.title,
            completed: todo.completed,
            order: todo.order,
            isPinned: todo.isPinned,
            parentId: todo.parentId,
            pomodoroCount: todo.pomodoroCount,
            dueAt: clientDueAt,
            remindAt: clientRemindAt,
            remindedAt: keepRemindedAt ? existing!.remindedAt : null,
            recurrenceRule: effectiveRecurrenceRule,
            recurrenceTz: effectiveRecurrenceTz,
            recurrenceSpawnedAt: shouldSpawnNextRecurring
              ? serverTime
              : effectiveRecurrenceRule
                ? recurrenceSpawnedAtInput === undefined
                  ? (existing?.recurrenceSpawnedAt ?? null)
                  : recurrenceSpawnedAtInput
                : null,
            completedAt: todo.completedAt ? new Date(todo.completedAt) : null,
            deletedAt: todo.deletedAt ? new Date(todo.deletedAt) : null,
            updatedAt: serverTime,
            userId,
            version: existing ? (existing.version ?? 0) + 1 : 1,
          }

          const updated = await tx.todo.upsert({
            where: { id: todo.id },
            update: data,
            create: {
              ...data,
              id: todo.id,
              createdAt: new Date(todo.createdAt),
            },
            select: todoSelect,
          })

          successfullyUpdatedItems.push(updated)
          acceptedIds.push(todo.id)

          if (shouldSpawnNextRecurring && effectiveRecurrenceRule && clientDueAt) {
            const nextDueAt = getNextDueAt(
              clientDueAt,
              effectiveRecurrenceRule,
              effectiveRecurrenceTz,
            )
            const nextRemindAt = getNextRemindAt(clientDueAt, clientRemindAt, nextDueAt)

            await tx.todo.create({
              data: {
                id: randomUUID(),
                title: todo.title,
                completed: false,
                order: todo.order,
                isPinned: todo.isPinned,
                parentId: null,
                userId,
                version: 1,
                dueAt: nextDueAt,
                remindAt: nextRemindAt,
                remindedAt: null,
                recurrenceRule: effectiveRecurrenceRule,
                recurrenceTz: effectiveRecurrenceTz,
                recurrenceSpawnedAt: null,
                createdAt: serverTime,
                updatedAt: serverTime,
                completedAt: null,
                deletedAt: null,
                pomodoroCount: 0,
              },
            })
          }
        }
      })
    }

    // 2. 拉取自上次同步以来的服务器端变更
    const serverChanges = await this.prisma.todo.findMany({
      where: {
        userId,
        updatedAt: {
          gte: since, // 改为 gte，配合前端过滤，确保不漏掉同一毫秒的更新
        },
        // 如果是初次同步（since 为 0），则排除回收站内容，后续按需加载
        ...(since.getTime() === 0 ? { deletedAt: null } : {}),
      },
      select: todoSelect,
    })

    // 过滤掉那些客户端成功更新的项目，稍后会将它们与 serverChanges 合并
    const updatedIds = new Set(successfullyUpdatedItems.map((i) => i.id))
    const otherServerChanges = serverChanges.filter((t) => !updatedIds.has(t.id))

    // 合并客户端成功更新的项目（带有新版本号）和服务器端的其他变更
    const allChanges = [...successfullyUpdatedItems, ...otherServerChanges]

    const tombstones = await this.prisma.todoTombstone.findMany({
      where: {
        userId,
        deletedAt: {
          gte: since,
        },
      },
      select: { todoId: true },
    })
    const deletedIds = Array.from(new Set(tombstones.map((t) => t.todoId)))

    // 4. 通知其他在线设备进行同步
    if (successfullyUpdatedItems.length > 0) {
      this.eventsGateway.broadcastSyncNotify(userId, excludeSocketId)
    }

    return {
      synced: allChanges,
      deletedIds,
      acceptedIds,
      conflicts,
      serverTime: serverTime.toISOString(),
    }
  }
}
