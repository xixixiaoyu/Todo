import { Injectable, Inject, forwardRef } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { EventsGateway } from '../events/events.gateway'

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

    await this.prisma.todo.delete({
      where: { id },
    })

    this.eventsGateway.broadcastSyncNotify(userId)
    return { id }
  }

  /**
   * 清空回收站
   */
  async clearTrash(userId: number) {
    const result = await this.prisma.todo.deleteMany({
      where: {
        userId,
        deletedAt: { not: null },
      },
    })

    this.eventsGateway.broadcastSyncNotify(userId)
    return result
  }
}
