import { Injectable, Inject, forwardRef } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { EventsGateway } from '../events/events.gateway'

const todoSelect = {
  id: true,
  title: true,
  completed: true,
  order: true,
  isPinned: true,
  parentId: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  deletedAt: true,
  pomodoroCount: true,
} as const

@Injectable()
export class TodosService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(forwardRef(() => EventsGateway))
    private readonly eventsGateway: EventsGateway,
  ) {}

  /**
   * 获取用户的所有待办事项 (基础版)
   */
  async findAll(userId: number) {
    return this.prisma.todo.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      select: todoSelect,
      orderBy: [{ isPinned: 'desc' }, { order: 'asc' }, { createdAt: 'desc' }],
    })
  }

  /**
   * 获取回收站中的待办事项
   */
  async findTrash(userId: number) {
    return this.prisma.todo.findMany({
      where: {
        userId,
        deletedAt: { not: null },
      },
      select: todoSelect,
      orderBy: { deletedAt: 'desc' },
    })
  }

  /**
   * 恢复已删除的待办事项
   */
  async restore(userId: number, id: string) {
    const todo = await this.prisma.todo.findFirst({
      where: { id, userId },
    })

    if (!todo) return null

    const updated = await this.prisma.todo.update({
      where: { id },
      data: {
        deletedAt: null,
        updatedAt: new Date(),
        version: { increment: 1 },
      },
      select: todoSelect,
    })

    this.eventsGateway.broadcastSyncNotify(userId)
    return updated
  }

  /**
   * 永久删除待办事项
   */
  async deletePermanently(userId: number, id: string) {
    const todo = await this.prisma.todo.findFirst({
      where: { id, userId },
    })

    if (!todo) return null

    await this.prisma.$transaction(async (tx) => {
      await tx.todoTombstone.upsert({
        where: { userId_todoId: { userId, todoId: id } },
        update: { deletedAt: new Date() },
        create: { userId, todoId: id },
      })

      await tx.todo.delete({
        where: { id },
      })
    })

    this.eventsGateway.broadcastSyncNotify(userId)
    return { id }
  }

  /**
   * 清空回收站
   */
  async clearTrash(userId: number) {
    const trashTodos = await this.prisma.todo.findMany({
      where: {
        userId,
        deletedAt: { not: null },
      },
      select: { id: true },
    })

    const ids = trashTodos.map((t) => t.id)

    const result = await this.prisma.$transaction(async (tx) => {
      if (ids.length > 0) {
        await tx.todoTombstone.createMany({
          data: ids.map((todoId) => ({ userId, todoId, deletedAt: new Date() })),
          skipDuplicates: true,
        })
      }

      return tx.todo.deleteMany({
        where: {
          userId,
          deletedAt: { not: null },
        },
      })
    })

    this.eventsGateway.broadcastSyncNotify(userId)
    return result
  }
}
