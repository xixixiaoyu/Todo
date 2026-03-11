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
  })
})
