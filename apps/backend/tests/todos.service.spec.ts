import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Test, TestingModule } from '@nestjs/testing'
import { TodosService } from '@/todos/todos.service'
import { PrismaService } from '@/prisma/prisma.service'
import { SyncMergeDto } from '@/todos/todos.dto'

import { EventsGateway } from '@/events/events.gateway'

describe('TodosService', () => {
  let service: TodosService
  const mockPrisma = {
    todo: {
      upsert: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
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
        TodosService,
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

    service = module.get<TodosService>(TodosService)
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
      mockPrisma.todo.upsert.mockResolvedValue({})
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
      // result.synced should contain both upserted item and server changes
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

      mockPrisma.todo.findMany.mockResolvedValue([
        {
          id: 'deleted-uuid',
          title: 'Deleted Todo',
          updatedAt: new Date(),
          deletedAt: new Date(),
        },
      ])

      const result = await service.sync(userId, syncDto)

      expect(result.synced).toHaveLength(1)
      expect(result.synced[0].id).toBe('deleted-uuid')
      expect(result.deletedIds).toHaveLength(0)
    })
  })

  describe('findTrash', () => {
    it('should return all deleted todos for a user', async () => {
      const userId = 1
      const mockTrash = [{ id: '1', title: 'Deleted 1', userId, deletedAt: new Date() }]
      mockPrisma.todo.findMany.mockResolvedValue(mockTrash)

      const result = await service.findTrash(userId)

      expect(mockPrisma.todo.findMany).toHaveBeenCalledWith({
        where: { userId, deletedAt: { not: null } },
        orderBy: { deletedAt: 'desc' },
      })
      expect(result).toEqual(mockTrash)
    })
  })

  describe('restore', () => {
    it('should restore a deleted todo', async () => {
      const userId = 1
      const todoId = '1'
      const mockTodo = { id: todoId, userId, deletedAt: new Date() }
      mockPrisma.todo.findFirst = vi.fn().mockResolvedValue(mockTodo)
      mockPrisma.todo.update = vi.fn().mockResolvedValue({ ...mockTodo, deletedAt: null })

      const result = await service.restore(userId, todoId)

      expect(mockPrisma.todo.findFirst).toHaveBeenCalled()
      expect(mockPrisma.todo.update).toHaveBeenCalledWith({
        where: { id: todoId },
        data: { deletedAt: null, updatedAt: expect.any(Date), version: { increment: 1 } },
      })
      expect(result?.deletedAt).toBeNull()
      expect(mockEventsGateway.broadcastSyncNotify).toHaveBeenCalledWith(userId)
    })
  })

  describe('deletePermanently', () => {
    it('should physically delete a todo', async () => {
      const userId = 1
      const todoId = '1'
      const mockTodo = { id: todoId, userId }
      mockPrisma.todo.findFirst.mockResolvedValue(mockTodo)
      mockPrisma.todo.delete.mockResolvedValue(mockTodo)

      await service.deletePermanently(userId, todoId)

      expect(mockPrisma.todo.findFirst).toHaveBeenCalledWith({
        where: { id: todoId, userId },
      })
      expect(mockPrisma.todo.delete).toHaveBeenCalledWith({
        where: { id: todoId },
      })
      expect(mockEventsGateway.broadcastSyncNotify).toHaveBeenCalledWith(userId)
    })
  })

  describe('clearTrash', () => {
    it('should physically delete all deleted todos', async () => {
      const userId = 1
      mockPrisma.todo.deleteMany = vi.fn().mockResolvedValue({ count: 5 })

      await service.clearTrash(userId)

      expect(mockPrisma.todo.deleteMany).toHaveBeenCalledWith({
        where: { userId, deletedAt: { not: null } },
      })
      expect(mockEventsGateway.broadcastSyncNotify).toHaveBeenCalledWith(userId)
    })
  })

  describe('findAll', () => {
    it('should return all non-deleted todos for a user', async () => {
      const userId = 1
      const mockTodos = [
        { id: '1', title: 'Todo 1', userId, deletedAt: null },
        { id: '2', title: 'Todo 2', userId, deletedAt: null },
      ]

      mockPrisma.todo.findMany.mockResolvedValue(mockTodos)

      const result = await service.findAll(userId)

      expect(mockPrisma.todo.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          deletedAt: null,
        },
        orderBy: [{ isPinned: 'desc' }, { order: 'asc' }, { createdAt: 'desc' }],
      })
      expect(result).toEqual(mockTodos)
    })
  })
})
