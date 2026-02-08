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

      const result = await service.sync(userId, syncDto)

      expect(mockPrisma.$transaction).toHaveBeenCalled()
      expect(mockPrisma.todo.upsert).toHaveBeenCalled()
      expect(mockPrisma.todo.findMany).toHaveBeenCalled()
      expect(result.synced).toHaveLength(2)
      expect(result.synced).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: 'server-uuid' })]),
      )
      expect(result.deletedIds).toHaveLength(0)
      expect(result.serverTime).toBeDefined()
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

      const result = await service.sync(userId, syncDto)

      expect(result.synced).toHaveLength(1)
      expect(result.synced[0].id).toBe('deleted-todo')
      expect(result.synced[0].deletedAt).toBeDefined()
    })
  })
})
