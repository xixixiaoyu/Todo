import { Injectable, Inject, forwardRef } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { SyncMergeDto } from './todos.dto'
import type { SyncItem } from '@my-app/shared'
import { EventsGateway } from '../events/events.gateway'

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
    const successfullyUpdatedIds = new Set<string>()
    if (todos && todos.length > 0) {
      await this.prisma.$transaction(async (tx) => {
        for (const todo of todos as SyncItem[]) {
          const existing = await tx.todo.findUnique({
            where: { id: todo.id },
            select: { updatedAt: true, userId: true },
          })

          const clientUpdatedAt = new Date(todo.updatedAt)

          if (existing && existing.userId !== userId) {
            continue
          }

          if (existing && existing.updatedAt > clientUpdatedAt) {
            // 服务器版本更亲，跳过更新，让后续的 Pull 流程把服务器版本下发给客户端
            continue
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
          }

          await tx.todo.upsert({
            where: { id: todo.id },
            update: data,
            create: {
              ...data,
              id: todo.id,
              createdAt: new Date(todo.createdAt),
            },
          })

          successfullyUpdatedIds.add(todo.id)
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

    // 只过滤掉那些客户端成功更新且服务器端没有更进一步更新的项目
    const updatesToPull = serverChanges.filter((t) => !successfullyUpdatedIds.has(t.id))

    // 分离常规更新和逻辑删除
    const synced = updatesToPull.filter((t) => !t.deletedAt)
    const deletedIds = updatesToPull.filter((t) => t.deletedAt).map((t) => t.id)

    // 4. 通知其他在线设备进行同步
    if (successfullyUpdatedIds.size > 0) {
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
