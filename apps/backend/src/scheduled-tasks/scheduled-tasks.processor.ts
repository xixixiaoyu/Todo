import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq'
import { Logger, Inject } from '@nestjs/common'
import { Job } from 'bullmq'
import { SCHEDULED_TASKS_QUEUE } from './constants'
import { PrismaService } from '../prisma/prisma.service'
import { EventsGateway } from '../events/events.gateway'

interface ScheduledJobData {
  type: string
  [key: string]: unknown
}

/**
 * 定时任务处理器
 * 处理 BullMQ 队列中的定时任务
 */
@Processor(SCHEDULED_TASKS_QUEUE)
export class ScheduledTasksProcessor extends WorkerHost {
  private readonly logger = new Logger(ScheduledTasksProcessor.name)

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(EventsGateway)
    private readonly eventsGateway: EventsGateway,
  ) {
    super()
  }

  async process(job: Job<ScheduledJobData>): Promise<void> {
    const { type } = job.data

    switch (type) {
      case 'health-check':
        await this.handleHealthCheck(job)
        break
      case 'cleanup-expired':
        await this.handleCleanupExpired(job)
        break
      case 'todo-reminders':
        await this.handleTodoReminders(job)
        break
      case 'daily-stats':
        await this.handleDailyStats(job)
        break
      default:
        this.logger.warn(`未知的任务类型: ${type}`)
    }
  }

  /**
   * 健康检查任务
   */
  private async handleHealthCheck(job: Job): Promise<void> {
    this.logger.debug(`[${job.id}] 执行健康检查...`)
    // 在这里添加健康检查逻辑
    // 例如：检查数据库连接、Redis 连接、外部 API 等
  }

  /**
   * 清理过期数据任务
   */
  private async handleCleanupExpired(job: Job): Promise<void> {
    this.logger.log(`[${job.id}] 执行过期数据清理...`)

    // 1. 物理删除已逻辑删除超过 30 天的待办事项
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    try {
      const expiredTodos = await this.prisma.todo.findMany({
        where: {
          deletedAt: {
            lt: thirtyDaysAgo,
          },
        },
        select: { id: true, userId: true },
      })

      const deleteResult = await this.prisma.$transaction(async (tx) => {
        if (expiredTodos.length > 0) {
          await tx.todoTombstone.createMany({
            data: expiredTodos.map((t) => ({
              userId: t.userId,
              todoId: t.id,
              deletedAt: new Date(),
            })),
            skipDuplicates: true,
          })
        }

        return tx.todo.deleteMany({
          where: {
            deletedAt: {
              lt: thirtyDaysAgo,
            },
          },
        })
      })
      if (deleteResult.count > 0) {
        this.logger.log(`清理了 ${deleteResult.count} 条 30 天前的逻辑删除记录`)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.error(`清理逻辑删除记录失败: ${message}`)
    }

    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

    try {
      await this.prisma.todoTombstone.deleteMany({
        where: {
          deletedAt: {
            lt: ninetyDaysAgo,
          },
        },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.error(`清理 tombstone 记录失败: ${message}`)
    }

    // 可以在这里继续添加其他清理逻辑
    // 例如：删除过期的 session、清理临时文件等
  }

  private async handleTodoReminders(job: Job): Promise<void> {
    const now = new Date()
    this.logger.debug(`[${job.id}] 执行待办提醒推送...`)

    try {
      const dueTodos = await this.prisma.todo.findMany({
        where: {
          deletedAt: null,
          completed: false,
          remindAt: {
            lte: now,
          },
          remindedAt: null,
        },
        select: { id: true, userId: true, title: true },
        take: 200,
      })

      if (dueTodos.length === 0) return

      for (const todo of dueTodos) {
        this.eventsGateway.broadcastToRoom(`user:${todo.userId}`, 'todos:remind', {
          todoId: todo.id,
          remindedAt: now.toISOString(),
        })
      }

      const ids = dueTodos.map((t) => t.id)
      await this.prisma.todo.updateMany({
        where: {
          id: { in: ids },
          remindedAt: null,
        },
        data: {
          remindedAt: now,
          updatedAt: now,
          version: { increment: 1 },
        },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.error(`待办提醒推送失败: ${message}`)
    }
  }

  /**
   * 每日统计任务
   */
  private async handleDailyStats(job: Job): Promise<void> {
    this.logger.log(`[${job.id}] 执行每日数据统计...`)
    // 在这里添加统计逻辑
    // 例如：生成每日报表、发送统计邮件等
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.debug(`任务完成: ${job.name} [${job.id}]`)
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`任务失败: ${job.name} [${job.id}] - ${error.message}`)
  }
}
