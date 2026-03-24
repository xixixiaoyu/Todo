import { Injectable, Inject } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { PrismaService } from '../prisma/prisma.service'
import { SyncMergeDto } from './todos.dto'
import type { SyncItem } from '@lumina/shared'
import { EventsGateway } from '../events/events.gateway'
import type { Prisma } from '@prisma/client'
import { createNextRecurringTodoData, resolveRecurringSyncState } from './todos-sync.recurrence'

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
  deferredAt: true,
  deletedAt: true,
  pomodoroCount: true,
} as const

type TodoPublic = Prisma.TodoGetPayload<{ select: typeof todoSelect }>
type SyncConflictReason = 'TOMBSTONED' | 'OWNER_MISMATCH' | 'VERSION_CONFLICT'

interface SyncConflict {
  id: string
  reason: SyncConflictReason
  serverVersion?: number
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
          const canDeferTodo =
            !todo.completed && !todo.deletedAt && (todo.parentId ?? null) === null
          const deferredAt = canDeferTodo && todo.deferredAt ? new Date(todo.deferredAt) : null
          const {
            clientDueAt,
            clientRemindAt,
            effectiveRecurrenceRule,
            effectiveRecurrenceTz,
            recurrenceSpawnedAt,
            keepRemindedAt,
            shouldSpawnNextRecurring,
          } = resolveRecurringSyncState({
            todo,
            existing,
            serverTime,
          })

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
            recurrenceSpawnedAt,
            completedAt: todo.completedAt ? new Date(todo.completedAt) : null,
            deferredAt,
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
            await tx.todo.create({
              data: createNextRecurringTodoData({
                id: randomUUID(),
                todo,
                userId,
                serverTime,
                dueAt: clientDueAt,
                remindAt: clientRemindAt,
                recurrenceRule: effectiveRecurrenceRule,
                recurrenceTz: effectiveRecurrenceTz,
              }),
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
