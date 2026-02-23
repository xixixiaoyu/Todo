import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Test, TestingModule } from '@nestjs/testing'
import { TodosService } from '@/todos/todos.service'
import { PrismaService } from '@/prisma/prisma.service'

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
    todoTombstone: {
      upsert: vi.fn(),
      createMany: vi.fn(),
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

  describe('findTrash', () => {
    it('should return all deleted todos for a user', async () => {
      const userId = 1
      const mockTrash = [{ id: '1', title: 'Deleted 1', userId, deletedAt: new Date() }]
      mockPrisma.todo.findMany.mockResolvedValue(mockTrash)

      const result = await service.findTrash(userId)

      expect(mockPrisma.todo.findMany).toHaveBeenCalledWith({
        where: { userId, deletedAt: { not: null } },
        select: expect.any(Object),
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
        select: expect.any(Object),
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
      mockPrisma.todoTombstone.upsert.mockResolvedValue({ userId, todoId })

      await service.deletePermanently(userId, todoId)

      expect(mockPrisma.todo.findFirst).toHaveBeenCalledWith({
        where: { id: todoId, userId },
      })
      expect(mockPrisma.todoTombstone.upsert).toHaveBeenCalledWith({
        where: { userId_todoId: { userId, todoId } },
        update: { deletedAt: expect.any(Date) },
        create: { userId, todoId },
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
      mockPrisma.todo.findMany.mockResolvedValue([{ id: '1' }, { id: '2' }])
      mockPrisma.todoTombstone.createMany.mockResolvedValue({ count: 2 })
      mockPrisma.todo.deleteMany = vi.fn().mockResolvedValue({ count: 2 })

      await service.clearTrash(userId)

      expect(mockPrisma.todo.findMany).toHaveBeenCalledWith({
        where: { userId, deletedAt: { not: null } },
        select: { id: true },
      })
      expect(mockPrisma.todoTombstone.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ userId, todoId: '1', deletedAt: expect.any(Date) }),
          expect.objectContaining({ userId, todoId: '2', deletedAt: expect.any(Date) }),
        ]),
        skipDuplicates: true,
      })
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
        select: expect.any(Object),
        orderBy: [{ isPinned: 'desc' }, { order: 'asc' }, { createdAt: 'desc' }],
      })
      expect(result).toEqual(mockTodos)
    })
  })
})
