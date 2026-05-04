import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Test, TestingModule } from '@nestjs/testing'
import { BadRequestException } from '@nestjs/common'
import { AiPresetService } from '@/ai-sync/ai-preset.service'
import { PrismaService } from '@/prisma/prisma.service'
import type { AIPresetSync } from '@lumina/shared'

describe('AiPresetService', () => {
  let service: AiPresetService
  const mockTx = {
    aiPreset: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
  }
  const mockPrisma = {
    aiPreset: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    $transaction: vi.fn((cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx)),
  }

  beforeEach(async () => {
    vi.clearAllMocks()
    const module: TestingModule = await Test.createTestingModule({
      providers: [AiPresetService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile()

    service = module.get<AiPresetService>(AiPresetService)
  })

  it('should return empty array when no presets exist', async () => {
    mockPrisma.aiPreset.findMany.mockResolvedValue([])
    const result = await service.findAll(1)
    expect(result).toEqual([])
  })

  it('should return stored presets', async () => {
    const preset: AIPresetSync = {
      id: 'p1',
      name: 'GPT-4',
      baseUrl: 'https://api.openai.com',
      model: 'gpt-4',
      systemPrompt: '',
      temperature: 0.7,
      thinkingEffort: 'max',
      todoAssistant: false,
      skillIds: [],
    }
    mockPrisma.aiPreset.findMany.mockResolvedValue([{ id: 'p1', presetData: preset }])
    const result = await service.findAll(1)
    expect(result).toEqual([preset])
  })

  it('should reject presets containing apiKey field', async () => {
    const presets = [{ id: 'p1', name: 'Test', apiKey: 'sk-secret' }] as unknown as AIPresetSync[]
    await expect(service.upsertAll(1, presets)).rejects.toThrow(BadRequestException)
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  it('should replace all presets in a transaction', async () => {
    const presets: AIPresetSync[] = [
      {
        id: 'p1',
        name: 'GPT-4',
        baseUrl: 'https://api.openai.com',
        model: 'gpt-4',
        systemPrompt: '',
        temperature: 0.7,
        thinkingEffort: 'max',
        todoAssistant: false,
        skillIds: [],
      },
    ]

    const result = await service.upsertAll(1, presets)

    expect(mockPrisma.$transaction).toHaveBeenCalled()
    expect(mockTx.aiPreset.deleteMany).toHaveBeenCalledWith({ where: { userId: 1 } })
    expect(result).toHaveLength(1)
  })
})
