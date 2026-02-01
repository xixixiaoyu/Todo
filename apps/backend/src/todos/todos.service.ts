import { Injectable, Inject, forwardRef } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { SyncMergeDto } from './todos.dto'
import type { SyncItem } from '@my-app/shared'
import { EventsGateway } from '../events/events.gateway'
import { Todo } from '@prisma/client'

@Injectable()
export class TodosService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(forwardRef(() => EventsGateway))
    private readonly eventsGateway: EventsGateway,
  ) {}

  /**
   * 增量同步与合并逻辑
   */
  async sync(userId: number, syncDto: SyncMergeDto, excludeSocketId?: string) {
    const { todos, lastSyncAt } = syncDto
    const serverTime = new Date()
    const since = lastSyncAt ? new Date(lastSyncAt) : new Date(0)

    // 1. 处理客户端推送的变更 (使用事务保证原子性)
    const successfullyUpdatedItems: Todo[] = []
    if (todos && todos.length > 0) {
      await this.prisma.$transaction(async (tx) => {
        for (const todo of todos as SyncItem[]) {
          const existing = await tx.todo.findUnique({
            where: { id: todo.id },
            select: { updatedAt: true, userId: true, version: true },
          })

          const clientUpdatedAt = new Date(todo.updatedAt)
          const clientVersion = todo.version ?? 0

          if (existing && existing.userId !== userId) {
            continue
          }

          // 冲突检测逻辑：版本号优先，时间戳作为最后的兜底
          if (existing) {
            const serverVersion = existing.version ?? 0
            if (clientVersion < serverVersion) {
              // 服务器版本更高，跳过更新
              continue
            }
            if (clientVersion === serverVersion && existing.updatedAt > clientUpdatedAt) {
              // 版本号相同但服务器时间戳更新，跳过
              continue
            }
          }

          const data = {
            title: todo.title,
            completed: todo.completed,
            order: todo.order,
            isPinned: todo.isPinned,
            parentId: todo.parentId,
            completedAt: todo.completedAt ? new Date(todo.completedAt) : null,
            deletedAt: todo.deletedAt ? new Date(todo.deletedAt) : null,
            updatedAt: clientUpdatedAt,
            userId,
            version: clientVersion + 1, // 成功更新后版本号 +1
          }

          const updated = await tx.todo.upsert({
            where: { id: todo.id },
            update: data,
            create: {
              ...data,
              id: todo.id,
              createdAt: new Date(todo.createdAt),
            },
          })

          successfullyUpdatedItems.push(updated)
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
      },
    })

    // 过滤掉那些客户端成功更新的项目，稍后会将它们与 serverChanges 合并
    const updatedIds = new Set(successfullyUpdatedItems.map((i) => i.id))
    const otherServerChanges = serverChanges.filter((t) => !updatedIds.has(t.id))

    // 合并客户端成功更新的项目（带有新版本号）和服务器端的其他变更
    const allChanges = [...successfullyUpdatedItems, ...otherServerChanges]

    // 分离常规更新和逻辑删除
    const synced = allChanges.filter((t) => !t.deletedAt)
    const deletedIds = allChanges.filter((t) => t.deletedAt).map((t) => t.id)

    // 4. 通知其他在线设备进行同步
    if (successfullyUpdatedItems.length > 0) {
      this.eventsGateway.broadcastSyncNotify(userId, excludeSocketId)
    }

    return {
      synced,
      deletedIds,
      serverTime: serverTime.toISOString(),
    }
  }

  /**
   * 获取用户的所有待办事项 (基础版)
   */
  async findAll(userId: number) {
    return this.prisma.todo.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      orderBy: [{ isPinned: 'desc' }, { order: 'asc' }, { createdAt: 'desc' }],
    })
  }
}
