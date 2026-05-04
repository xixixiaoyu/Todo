import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Test, TestingModule } from '@nestjs/testing'
import { AiMemoryService } from '@/ai-sync/ai-memory.service'
import { PrismaService } from '@/prisma/prisma.service'

describe('AiMemoryService', () => {
  let service: AiMemoryService
  const mockPrisma = {
    aiMemory: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  }

  beforeEach(async () => {
    vi.clearAllMocks()
    const module: TestingModule = await Test.createTestingModule({
      providers: [AiMemoryService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile()

    service = module.get<AiMemoryService>(AiMemoryService)
  })

  it('should return default values when no record exists', async () => {
    mockPrisma.aiMemory.findUnique.mockResolvedValue(null)

    const result = await service.get(1)

    expect(result).toEqual({ memories: [], enabled: false, threshold: 30, updatedAt: undefined })
  })

  it('should return stored memory data with updatedAt', async () => {
    const updatedAt = new Date('2025-06-15T10:00:00.000Z')
    const stored = {
      memories: ['User likes TypeScript'],
      enabled: true,
      threshold: 50,
      updatedAt,
    }
    mockPrisma.aiMemory.findUnique.mockResolvedValue(stored)

    const result = await service.get(1)

    expect(result).toEqual({
      memories: ['User likes TypeScript'],
      enabled: true,
      threshold: 50,
      updatedAt: updatedAt.toISOString(),
    })
  })

  it('should create new memory record on upsert and return updatedAt', async () => {
    const updatedAt = new Date('2025-06-15T10:00:00.000Z')
    const data = { memories: ['New memory'], enabled: true, threshold: 40 }
    mockPrisma.aiMemory.upsert.mockResolvedValue({ ...data, updatedAt })

    const result = await service.upsert(1, data)

    expect(mockPrisma.aiMemory.upsert).toHaveBeenCalledWith({
      where: { userId: 1 },
      create: { userId: 1, ...data },
      update: data,
      select: { memories: true, enabled: true, threshold: true, updatedAt: true },
    })
    expect(result).toEqual({ ...data, updatedAt: updatedAt.toISOString() })
  })

  it('should update existing memory record and return updatedAt', async () => {
    const updatedAt = new Date('2025-06-15T10:00:00.000Z')
    const data = { memories: ['Updated'], enabled: false, threshold: 20 }
    mockPrisma.aiMemory.upsert.mockResolvedValue({ ...data, updatedAt })

    const result = await service.upsert(1, data)

    expect(result).toEqual({ ...data, updatedAt: updatedAt.toISOString() })
  })
})
