import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Job } from 'bullmq'
import { ScheduledTasksProcessor } from '@/scheduled-tasks/scheduled-tasks.processor'

describe('ScheduledTasksProcessor', () => {
  const mockPrisma = {
    todo: {
      count: vi.fn(),
      groupBy: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    todoTombstone: {
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  }

  const mockEventsGateway = {
    broadcastToRoom: vi.fn(),
  }

  let processor: ScheduledTasksProcessor

  beforeEach(() => {
    vi.clearAllMocks()
    processor = new ScheduledTasksProcessor(mockPrisma as never, mockEventsGateway as never)
  })

  it('should generate daily stats summary when processing daily-stats job', async () => {
    mockPrisma.todo.count
      .mockResolvedValueOnce(20)
      .mockResolvedValueOnce(8)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2)

    mockPrisma.todo.groupBy
      .mockResolvedValueOnce([
        { userId: 1, _count: { _all: 12 } },
        { userId: 2, _count: { _all: 8 } },
      ])
      .mockResolvedValueOnce([
        { userId: 1, _count: { _all: 6 } },
        { userId: 2, _count: { _all: 2 } },
      ])

    const loggerLogSpy = vi.spyOn(
      (processor as unknown as { logger: { log: () => void } }).logger,
      'log',
    )
    const loggerErrorSpy = vi.spyOn(
      (processor as unknown as { logger: { error: () => void } }).logger,
      'error',
    )

    const job = {
      id: 'daily-1',
      name: 'daily-stats',
      data: { type: 'daily-stats' },
    } as unknown as Job<{ type: string }>

    await processor.process(job)

    expect(mockPrisma.todo.count).toHaveBeenCalledTimes(5)
    expect(mockPrisma.todo.groupBy).toHaveBeenCalledTimes(2)
    expect(loggerErrorSpy).not.toHaveBeenCalled()
    expect(loggerLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('[daily-1] 执行每日数据统计...'),
    )
    expect(loggerLogSpy).toHaveBeenCalledWith(expect.stringContaining('[daily-1] 每日统计结果:'))
  })

  it('should catch errors from daily-stats aggregation and log them', async () => {
    mockPrisma.todo.count.mockRejectedValue(new Error('db unavailable'))

    const loggerErrorSpy = vi.spyOn(
      (processor as unknown as { logger: { error: () => void } }).logger,
      'error',
    )

    const job = {
      id: 'daily-2',
      name: 'daily-stats',
      data: { type: 'daily-stats' },
    } as unknown as Job<{ type: string }>

    await expect(processor.process(job)).resolves.toBeUndefined()
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('每日统计任务失败: db unavailable'),
    )
  })
})
