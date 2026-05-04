import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Test, TestingModule } from '@nestjs/testing'
import { AiSkillService } from '@/ai-sync/ai-skill.service'
import { PrismaService } from '@/prisma/prisma.service'
import type { AISkillSync } from '@lumina/shared'

describe('AiSkillService', () => {
  let service: AiSkillService
  const mockTx = {
    aiSkill: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
  }
  const mockPrisma = {
    aiSkill: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    $transaction: vi.fn((cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx)),
  }

  beforeEach(async () => {
    vi.clearAllMocks()
    const module: TestingModule = await Test.createTestingModule({
      providers: [AiSkillService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile()

    service = module.get<AiSkillService>(AiSkillService)
  })

  it('should return empty array when no skills exist', async () => {
    mockPrisma.aiSkill.findMany.mockResolvedValue([])
    const result = await service.findAll(1)
    expect(result).toEqual([])
  })

  it('should return stored skills with updatedAt', async () => {
    const updatedAt = new Date('2025-06-15T10:00:00.000Z')
    mockPrisma.aiSkill.findMany.mockResolvedValue([
      { id: 's1', skillData: { id: 's1', name: 'Test', prompt: 'You are helpful' }, updatedAt },
    ])
    const result = await service.findAll(1)
    expect(result[0].id).toBe('s1')
    expect(result[0].name).toBe('Test')
    expect(result[0].updatedAt).toBe(updatedAt.toISOString())
  })

  it('should replace all skills in a transaction and return updatedAt', async () => {
    const skills: AISkillSync[] = [
      { id: 's1', name: 'Skill 1', prompt: 'Prompt 1', updatedAt: '2025-01-01T00:00:00.000Z' },
      { id: 's2', name: 'Skill 2', prompt: 'Prompt 2', updatedAt: '2025-01-01T00:00:00.000Z' },
    ]

    const updatedAt = new Date('2025-06-15T10:00:00.000Z')
    mockPrisma.aiSkill.findMany.mockResolvedValue([
      { id: 's1', skillData: { id: 's1', name: 'Skill 1', prompt: 'Prompt 1' }, updatedAt },
      { id: 's2', skillData: { id: 's2', name: 'Skill 2', prompt: 'Prompt 2' }, updatedAt },
    ])

    const result = await service.upsertAll(1, skills)

    expect(mockPrisma.$transaction).toHaveBeenCalled()
    expect(mockTx.aiSkill.deleteMany).toHaveBeenCalledWith({ where: { userId: 1 } })
    expect(mockTx.aiSkill.createMany).toHaveBeenCalled()
    expect(result).toHaveLength(2)
    expect(result[0].updatedAt).toBe(updatedAt.toISOString())
  })

  it('should handle empty skills array', async () => {
    mockPrisma.aiSkill.findMany.mockResolvedValue([])

    const result = await service.upsertAll(1, [])

    expect(mockTx.aiSkill.deleteMany).toHaveBeenCalled()
    expect(mockTx.aiSkill.createMany).not.toHaveBeenCalled()
    expect(result).toEqual([])
  })
})
