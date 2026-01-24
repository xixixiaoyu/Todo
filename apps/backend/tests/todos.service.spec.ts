import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Test, TestingModule } from '@nestjs/testing'
import { TodosService } from '@/todos/todos.service'
import { PrismaService } from '@/prisma/prisma.service'
import { SyncMergeDto } from '@/todos/todos.dto'

describe('TodosService', () => {
  let service: TodosService
  const mockPrisma = {
    todo: {
      upsert: vi.fn(),
      findMany: vi.fn(),
    },
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TodosService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
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
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        lastSyncAt: new Date(0).toISOString(),
      }

      mockPrisma.todo.upsert.mockResolvedValue({})
      mockPrisma.todo.findMany.mockResolvedValue([
        {
          id: 'server-uuid',
          title: 'Server Todo',
          updatedAt: new Date(),
        },
      ])

      const result = await service.sync(userId, syncDto)

      expect(mockPrisma.todo.upsert).toHaveBeenCalled()
      expect(mockPrisma.todo.findMany).toHaveBeenCalled()
      expect(result.synced).toHaveLength(1)
      expect(result.synced[0].id).toBe('server-uuid')
      expect(result.serverTime).toBeDefined()
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
