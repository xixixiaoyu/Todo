import { Injectable, Inject } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { SyncMergeDto } from './todos.dto'
import type { SyncItem } from '@my-app/shared'

@Injectable()
export class TodosService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * 增量同步与合并逻辑
   */
  async sync(userId: number, syncDto: SyncMergeDto) {
    const { todos, lastSyncAt } = syncDto
    const serverTime = new Date()

    // 1. 处理客户端推送的变更 (Upsert)
    if (todos && todos.length > 0) {
      for (const todo of todos as SyncItem[]) {
        await this.prisma.todo.upsert({
          where: { id: todo.id },
          update: {
            title: todo.title,
            completed: todo.completed,
            order: todo.order,
            isPinned: todo.isPinned,
            parentId: todo.parentId,
            completedAt: todo.completedAt ? new Date(todo.completedAt) : null,
            deletedAt: todo.deletedAt ? new Date(todo.deletedAt) : null,
            updatedAt: new Date(todo.updatedAt),
            userId,
          },
          create: {
            id: todo.id,
            title: todo.title,
            completed: todo.completed,
            order: todo.order,
            isPinned: todo.isPinned,
            parentId: todo.parentId,
            completedAt: todo.completedAt ? new Date(todo.completedAt) : null,
            deletedAt: todo.deletedAt ? new Date(todo.deletedAt) : null,
            createdAt: new Date(todo.createdAt),
            updatedAt: new Date(todo.updatedAt),
            userId,
          },
        })
      }
    }

    // 2. 拉取自上次同步以来的服务器端变更
    const since = lastSyncAt ? new Date(lastSyncAt) : new Date(0)

    const serverChanges = await this.prisma.todo.findMany({
      where: {
        userId,
        updatedAt: {
          gt: since,
        },
      },
    })

    // 过滤掉客户端刚刚推上来的那些 ID，避免重复下发
    const clientTodoIds = new Set((todos as SyncItem[]).map((t) => t.id))
    const updatesToPull = serverChanges.filter((t) => !clientTodoIds.has(t.id))

    return {
      synced: updatesToPull,
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
