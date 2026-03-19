import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Test, TestingModule } from '@nestjs/testing'
import { TodoSyncService } from '@/todos/todos-sync.service'
import { PrismaService } from '@/prisma/prisma.service'
import { SyncMergeDto } from '@/todos/todos.dto'
import { EventsGateway } from '@/events/events.gateway'

describe('TodoSyncService', () => {
  let service: TodoSyncService
  const mockPrisma = {
    todo: {
      upsert: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    todoTombstone: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    $transaction: vi.fn((cb) => cb(mockPrisma)),
  }
  const mockEventsGateway = {
    broadcastSyncNotify: vi.fn(),
  }

  beforeEach(async () => {
    vi.clearAllMocks()
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TodoSyncService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: EventsGateway,
          useValue: mockEventsGateway,
        },
      ],
    }).compile()

    service = module.get<TodoSyncService>(TodoSyncService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('sync', () => {
    it('should upsert todos and return server changes', async () => {
      const userId = 1
      const syncDto: SyncMergeDto = {
        todos: [
          {
            id: '861a3556-9150-4819-b7b5-22e379434857',
            title: 'Test Todo',
            completed: false,
            order: 0,
            isPinned: false,
            version: 0,
            pomodoroCount: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        lastSyncAt: new Date(0).toISOString(),
      }

      mockPrisma.todoTombstone.findUnique.mockResolvedValue(null)
      mockPrisma.todo.findUnique.mockResolvedValue(null)
      mockPrisma.todo.upsert.mockResolvedValue({ id: '861a3556-9150-4819-b7b5-22e379434857' })
      mockPrisma.todo.findMany.mockResolvedValue([
        {
          id: 'server-uuid',
          title: 'Server Todo',
          updatedAt: new Date(),
          deletedAt: null,
        },
      ])
      mockPrisma.todoTombstone.findMany.mockResolvedValue([])

      const result = await service.sync(userId, syncDto)

      expect(mockPrisma.$transaction).toHaveBeenCalled()
      expect(mockPrisma.todo.upsert).toHaveBeenCalled()
      expect(mockPrisma.todo.findMany).toHaveBeenCalled()
      expect(result.synced).toHaveLength(2)
      expect(result.synced).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: 'server-uuid' })]),
      )
      expect(result.acceptedIds).toEqual(['861a3556-9150-4819-b7b5-22e379434857'])
      expect(result.conflicts).toEqual([])
      expect(result.deletedIds).toHaveLength(0)
      expect(result.serverTime).toBeDefined()
    })

    it('should exclude deleted items when since is 0', async () => {
      const userId = 1
      const syncDto: SyncMergeDto = {
        todos: [],
        lastSyncAt: undefined, // since will be new Date(0)
      }

      mockPrisma.todo.findMany.mockResolvedValue([
        {
          id: 'active-todo',
          title: 'Active Todo',
          updatedAt: new Date(),
          deletedAt: null,
        },
        // We don't need to mock the "deleted" one being filtered out by findMany,
        // we just verify findMany was called with correct arguments
      ])
      mockPrisma.todoTombstone.findMany.mockResolvedValue([])

      await service.sync(userId, syncDto)

      expect(mockPrisma.todo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId,
            deletedAt: null, // This is the key part for since === 0
          }),
        }),
      )
    })

    it('should fallback to epoch when lastSyncAt is invalid', async () => {
      const userId = 1
      const syncDto = {
        todos: [],
        lastSyncAt: 'invalid-date-value',
      } as unknown as SyncMergeDto

      mockPrisma.todo.findMany.mockResolvedValue([])
      mockPrisma.todoTombstone.findMany.mockResolvedValue([])

      await service.sync(userId, syncDto)

      expect(mockPrisma.todo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId,
            deletedAt: null,
            updatedAt: { gte: new Date(0) },
          }),
        }),
      )
    })

    it('should return logically deleted items in synced list', async () => {
      const userId = 1
      const syncDto: SyncMergeDto = {
        todos: [],
        lastSyncAt: new Date(0).toISOString(),
      }

      const deletedAt = new Date()
      mockPrisma.todo.findMany.mockResolvedValue([
        {
          id: 'deleted-todo',
          title: 'Deleted Todo',
          updatedAt: deletedAt,
          deletedAt: deletedAt,
        },
      ])
      mockPrisma.todoTombstone.findMany.mockResolvedValue([])

      const result = await service.sync(userId, syncDto)

      expect(result.synced).toHaveLength(1)
      expect(result.synced[0].id).toBe('deleted-todo')
      expect(result.synced[0].deletedAt).toBeDefined()
    })

    it('should return deletedIds from tombstones since lastSyncAt', async () => {
      const userId = 1
      const syncDto: SyncMergeDto = {
        todos: [],
        lastSyncAt: new Date(0).toISOString(),
      }

      mockPrisma.todo.findMany.mockResolvedValue([])
      mockPrisma.todoTombstone.findMany.mockResolvedValue([{ todoId: 'deleted-uuid' }])

      const result = await service.sync(userId, syncDto)

      expect(result.deletedIds).toEqual(['deleted-uuid'])
    })

    it('should ignore client updates when tombstone exists', async () => {
      const userId = 1
      const id = '861a3556-9150-4819-b7b5-22e379434857'
      const syncDto: SyncMergeDto = {
        todos: [
          {
            id,
            title: 'Should be ignored',
            completed: false,
            order: 0,
            isPinned: false,
            version: 0,
            pomodoroCount: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        lastSyncAt: new Date(0).toISOString(),
      }

      mockPrisma.todoTombstone.findUnique.mockResolvedValue({ deletedAt: new Date() })
      mockPrisma.todo.findMany.mockResolvedValue([])
      mockPrisma.todoTombstone.findMany.mockResolvedValue([{ todoId: id }])

      const result = await service.sync(userId, syncDto)

      expect(mockPrisma.todo.upsert).not.toHaveBeenCalled()
      expect(result.deletedIds).toEqual([id])
      expect(result.acceptedIds).toEqual([])
      expect(result.conflicts).toEqual([{ id, reason: 'TOMBSTONED' }])
    })

    it('should reject update when client version does not match server version', async () => {
      const userId = 1
      const id = '861a3556-9150-4819-b7b5-22e379434857'
      const syncDto: SyncMergeDto = {
        todos: [
          {
            id,
            title: 'Outdated client change',
            completed: false,
            order: 0,
            isPinned: false,
            version: 3,
            pomodoroCount: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        lastSyncAt: new Date(0).toISOString(),
      }

      mockPrisma.todoTombstone.findUnique.mockResolvedValue(null)
      mockPrisma.todo.findUnique.mockResolvedValue({
        userId,
        version: 5,
        remindAt: null,
        remindedAt: null,
      })
      mockPrisma.todo.findMany.mockResolvedValue([
        {
          id,
          title: 'Server Latest',
          completed: false,
          order: 0,
          isPinned: false,
          version: 5,
          dueAt: null,
          remindAt: null,
          remindedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          completedAt: null,
          deletedAt: null,
          pomodoroCount: 0,
        },
      ])
      mockPrisma.todoTombstone.findMany.mockResolvedValue([])

      const result = await service.sync(userId, syncDto)

      expect(mockPrisma.todo.upsert).not.toHaveBeenCalled()
      expect(result.acceptedIds).toEqual([])
      expect(result.conflicts).toEqual([
        {
          id,
          reason: 'VERSION_CONFLICT',
          serverVersion: 5,
        },
      ])
    })

    it('should spawn next recurring todo when recurring task is completed', async () => {
      const userId = 1
      const id = '861a3556-9150-4819-b7b5-22e379434857'
      const dueAt = '2026-03-17T09:00:00.000Z'
      const remindAt = '2026-03-17T08:30:00.000Z'
      const syncDto: SyncMergeDto = {
        todos: [
          {
            id,
            title: 'Daily standup',
            completed: true,
            order: 0,
            isPinned: false,
            parentId: null,
            version: 2,
            pomodoroCount: 4,
            dueAt,
            remindAt,
            recurrenceRule: 'DAILY',
            recurrenceTz: 'Asia/Shanghai',
            recurrenceSpawnedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            completedAt: new Date(),
          },
        ],
        lastSyncAt: new Date(0).toISOString(),
      }

      mockPrisma.todoTombstone.findUnique.mockResolvedValue(null)
      mockPrisma.todo.findUnique.mockResolvedValue({
        userId,
        version: 2,
        completed: false,
        remindAt: new Date(remindAt),
        remindedAt: null,
        recurrenceSpawnedAt: null,
      })
      mockPrisma.todo.upsert.mockResolvedValue({
        id,
        title: 'Daily standup',
        completed: true,
        order: 0,
        isPinned: false,
        parentId: null,
        version: 3,
        dueAt: new Date(dueAt),
        remindAt: new Date(remindAt),
        remindedAt: null,
        recurrenceRule: 'DAILY',
        recurrenceTz: 'Asia/Shanghai',
        recurrenceSpawnedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: new Date(),
        deletedAt: null,
        pomodoroCount: 4,
      })
      mockPrisma.todo.create.mockResolvedValue({
        id: 'next-recurring',
      })
      mockPrisma.todo.findMany.mockResolvedValue([])
      mockPrisma.todoTombstone.findMany.mockResolvedValue([])

      await service.sync(userId, syncDto)

      expect(mockPrisma.todo.create).toHaveBeenCalledTimes(1)
      const createArgs = mockPrisma.todo.create.mock.calls[0][0]
      expect(createArgs.data.recurrenceRule).toBe('DAILY')
      expect(createArgs.data.dueAt.toISOString()).toBe('2026-03-18T09:00:00.000Z')
      expect(createArgs.data.remindAt.toISOString()).toBe('2026-03-18T08:30:00.000Z')
      expect(createArgs.data.completed).toBe(false)
      expect(createArgs.data.pomodoroCount).toBe(0)
    })

    it('should preserve recurrence metadata when client omits recurrence fields', async () => {
      const userId = 1
      const id = '861a3556-9150-4819-b7b5-22e379434857'
      const existingSpawnedAt = new Date('2026-03-17T09:00:01.000Z')
      const dueAt = '2026-03-19T09:00:00.000Z'
      const syncDto: SyncMergeDto = {
        todos: [
          {
            id,
            title: 'Weekly plan',
            completed: false,
            order: 0,
            isPinned: false,
            version: 3,
            pomodoroCount: 0,
            dueAt,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        lastSyncAt: new Date(0).toISOString(),
      }

      mockPrisma.todoTombstone.findUnique.mockResolvedValue(null)
      mockPrisma.todo.findUnique.mockResolvedValue({
        userId,
        version: 3,
        completed: false,
        remindAt: null,
        remindedAt: null,
        recurrenceRule: 'WEEKLY',
        recurrenceTz: 'Asia/Shanghai',
        recurrenceSpawnedAt: existingSpawnedAt,
      })
      mockPrisma.todo.upsert.mockResolvedValue({ id })
      mockPrisma.todo.findMany.mockResolvedValue([])
      mockPrisma.todoTombstone.findMany.mockResolvedValue([])

      await service.sync(userId, syncDto)

      const upsertArgs = mockPrisma.todo.upsert.mock.calls[0][0]
      expect(upsertArgs.update.recurrenceRule).toBe('WEEKLY')
      expect(upsertArgs.update.recurrenceTz).toBe('Asia/Shanghai')
      expect(upsertArgs.update.recurrenceSpawnedAt).toEqual(existingSpawnedAt)
    })

    it('should clear recurrence fields when dueAt is missing', async () => {
      const userId = 1
      const id = '861a3556-9150-4819-b7b5-22e379434857'
      const syncDto: SyncMergeDto = {
        todos: [
          {
            id,
            title: 'Broken recurring payload',
            completed: false,
            order: 0,
            isPinned: false,
            version: 2,
            pomodoroCount: 0,
            recurrenceRule: 'DAILY',
            recurrenceTz: 'Asia/Shanghai',
            recurrenceSpawnedAt: '2026-03-17T09:00:01.000Z',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        lastSyncAt: new Date(0).toISOString(),
      }

      mockPrisma.todoTombstone.findUnique.mockResolvedValue(null)
      mockPrisma.todo.findUnique.mockResolvedValue({
        userId,
        version: 2,
        completed: false,
        remindAt: null,
        remindedAt: null,
        recurrenceRule: 'DAILY',
        recurrenceTz: 'Asia/Shanghai',
        recurrenceSpawnedAt: new Date('2026-03-17T09:00:01.000Z'),
      })
      mockPrisma.todo.upsert.mockResolvedValue({ id })
      mockPrisma.todo.findMany.mockResolvedValue([])
      mockPrisma.todoTombstone.findMany.mockResolvedValue([])

      await service.sync(userId, syncDto)

      const upsertArgs = mockPrisma.todo.upsert.mock.calls[0][0]
      expect(upsertArgs.update.dueAt).toBeNull()
      expect(upsertArgs.update.recurrenceRule).toBeNull()
      expect(upsertArgs.update.recurrenceTz).toBeNull()
      expect(upsertArgs.update.recurrenceSpawnedAt).toBeNull()
      expect(mockPrisma.todo.create).not.toHaveBeenCalled()
    })

    it('should not spawn recurring todo again when recurrenceSpawnedAt already exists', async () => {
      const userId = 1
      const id = '861a3556-9150-4819-b7b5-22e379434857'
      const syncDto: SyncMergeDto = {
        todos: [
          {
            id,
            title: 'Daily standup',
            completed: true,
            order: 0,
            isPinned: false,
            parentId: null,
            version: 4,
            pomodoroCount: 0,
            dueAt: '2026-03-17T09:00:00.000Z',
            remindAt: '2026-03-17T08:30:00.000Z',
            recurrenceRule: 'DAILY',
            recurrenceSpawnedAt: '2026-03-17T09:00:01.000Z',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        lastSyncAt: new Date(0).toISOString(),
      }

      mockPrisma.todoTombstone.findUnique.mockResolvedValue(null)
      mockPrisma.todo.findUnique.mockResolvedValue({
        userId,
        version: 4,
        completed: false,
        remindAt: new Date('2026-03-17T08:30:00.000Z'),
        remindedAt: null,
        recurrenceSpawnedAt: new Date('2026-03-17T09:00:01.000Z'),
      })
      mockPrisma.todo.upsert.mockResolvedValue({ id })
      mockPrisma.todo.findMany.mockResolvedValue([])
      mockPrisma.todoTombstone.findMany.mockResolvedValue([])

      await service.sync(userId, syncDto)

      expect(mockPrisma.todo.create).not.toHaveBeenCalled()
    })

    it('should skip weekend when recurrence rule is WEEKDAYS', async () => {
      const userId = 1
      const id = '861a3556-9150-4819-b7b5-22e379434857'
      const dueAt = '2026-03-20T09:00:00.000Z'
      const remindAt = '2026-03-20T08:00:00.000Z'
      const syncDto: SyncMergeDto = {
        todos: [
          {
            id,
            title: 'Weekday report',
            completed: true,
            order: 0,
            isPinned: false,
            parentId: null,
            version: 1,
            pomodoroCount: 0,
            dueAt,
            remindAt,
            recurrenceRule: 'WEEKDAYS',
            recurrenceSpawnedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        lastSyncAt: new Date(0).toISOString(),
      }

      mockPrisma.todoTombstone.findUnique.mockResolvedValue(null)
      mockPrisma.todo.findUnique.mockResolvedValue({
        userId,
        version: 1,
        completed: false,
        remindAt: new Date(remindAt),
        remindedAt: null,
        recurrenceSpawnedAt: null,
      })
      mockPrisma.todo.upsert.mockResolvedValue({ id })
      mockPrisma.todo.create.mockResolvedValue({ id: 'next-weekday' })
      mockPrisma.todo.findMany.mockResolvedValue([])
      mockPrisma.todoTombstone.findMany.mockResolvedValue([])

      await service.sync(userId, syncDto)

      const createArgs = mockPrisma.todo.create.mock.calls[0][0]
      expect(createArgs.data.dueAt.toISOString()).toBe('2026-03-23T09:00:00.000Z')
      expect(createArgs.data.remindAt.toISOString()).toBe('2026-03-23T08:00:00.000Z')
    })

    it('should keep wall-clock time across DST based on recurrence timezone', async () => {
      const userId = 1
      const id = '861a3556-9150-4819-b7b5-22e379434857'
      const dueAt = '2026-03-07T14:00:00.000Z'
      const remindAt = '2026-03-07T13:30:00.000Z'
      const syncDto: SyncMergeDto = {
        todos: [
          {
            id,
            title: 'NY daily standup',
            completed: true,
            order: 0,
            isPinned: false,
            parentId: null,
            version: 1,
            pomodoroCount: 0,
            dueAt,
            remindAt,
            recurrenceRule: 'DAILY',
            recurrenceTz: 'America/New_York',
            recurrenceSpawnedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            completedAt: new Date(),
          },
        ],
        lastSyncAt: new Date(0).toISOString(),
      }

      mockPrisma.todoTombstone.findUnique.mockResolvedValue(null)
      mockPrisma.todo.findUnique.mockResolvedValue({
        userId,
        version: 1,
        completed: false,
        remindAt: new Date(remindAt),
        remindedAt: null,
        recurrenceRule: 'DAILY',
        recurrenceTz: 'America/New_York',
        recurrenceSpawnedAt: null,
      })
      mockPrisma.todo.upsert.mockResolvedValue({ id })
      mockPrisma.todo.create.mockResolvedValue({ id: 'next-recurring-dst' })
      mockPrisma.todo.findMany.mockResolvedValue([])
      mockPrisma.todoTombstone.findMany.mockResolvedValue([])

      await service.sync(userId, syncDto)

      const createArgs = mockPrisma.todo.create.mock.calls[0][0]
      expect(createArgs.data.dueAt.toISOString()).toBe('2026-03-08T13:00:00.000Z')
      expect(createArgs.data.remindAt.toISOString()).toBe('2026-03-08T12:30:00.000Z')
    })
  })
})
