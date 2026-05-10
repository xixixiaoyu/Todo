import { describe, it, expect } from 'vitest'
import {
  AIMemoryDataSchema,
  AISkillSyncSchema,
  AISkillSyncListSchema,
  AIPresetSyncSchema,
  AIPresetSyncListSchema,
} from './ai-sync.schema'

describe('AIMemoryDataSchema', () => {
  it('should accept valid memory data without updatedAt (backward compat)', () => {
    const result = AIMemoryDataSchema.safeParse({
      memories: ['User likes TypeScript'],
      enabled: true,
      threshold: 30,
    })
    expect(result.success).toBe(true)
  })

  it('should accept valid memory data with updatedAt', () => {
    const result = AIMemoryDataSchema.safeParse({
      memories: ['Preference A'],
      enabled: false,
      threshold: 50,
      updatedAt: '2025-01-01T00:00:00.000Z',
    })
    expect(result.success).toBe(true)
  })

  it('should reject invalid updatedAt format', () => {
    const result = AIMemoryDataSchema.safeParse({
      memories: [],
      enabled: true,
      threshold: 30,
      updatedAt: 'not-a-date',
    })
    expect(result.success).toBe(false)
  })

  it('should reject threshold out of range', () => {
    const result = AIMemoryDataSchema.safeParse({
      memories: [],
      enabled: true,
      threshold: 200,
    })
    expect(result.success).toBe(false)
  })
})

describe('AISkillSyncSchema', () => {
  const validSkill = {
    id: 'skill-1',
    name: 'Test Skill',
    prompt: 'You are a helpful assistant',
    updatedAt: '2025-01-01T00:00:00.000Z',
  }

  it('should accept valid skill with updatedAt', () => {
    const result = AISkillSyncSchema.safeParse(validSkill)
    expect(result.success).toBe(true)
  })

  it('should reject skill without updatedAt', () => {
    const { updatedAt: _updatedAt, ...withoutUpdatedAt } = validSkill
    void _updatedAt
    const result = AISkillSyncSchema.safeParse(withoutUpdatedAt)
    expect(result.success).toBe(false)
  })

  it('should reject skill with invalid updatedAt', () => {
    const result = AISkillSyncSchema.safeParse({ ...validSkill, updatedAt: 'invalid' })
    expect(result.success).toBe(false)
  })

  it('should accept skill with optional fields', () => {
    const result = AISkillSyncSchema.safeParse({
      ...validSkill,
      description: 'Optional description',
      aliases: ['ts', 'typescript'],
      path: '/skills/test',
    })
    expect(result.success).toBe(true)
  })
})

describe('AISkillSyncListSchema', () => {
  it('should accept array of valid skills', () => {
    const result = AISkillSyncListSchema.safeParse([
      { id: 's1', name: 'Skill 1', prompt: 'Prompt 1', updatedAt: '2025-01-01T00:00:00.000Z' },
      { id: 's2', name: 'Skill 2', prompt: 'Prompt 2', updatedAt: '2025-01-02T00:00:00.000Z' },
    ])
    expect(result.success).toBe(true)
  })

  it('should reject array containing skill without updatedAt', () => {
    const result = AISkillSyncListSchema.safeParse([
      { id: 's1', name: 'Skill 1', prompt: 'Prompt 1', updatedAt: '2025-01-01T00:00:00.000Z' },
      { id: 's2', name: 'Skill 2', prompt: 'Prompt 2' },
    ])
    expect(result.success).toBe(false)
  })
})

describe('AIPresetSyncSchema', () => {
  const validPreset = {
    id: 'preset-1',
    name: 'GPT-4',
    baseUrl: 'https://api.openai.com',
    model: 'gpt-4',
    updatedAt: '2025-01-01T00:00:00.000Z',
  }

  it('should accept valid preset with updatedAt', () => {
    const result = AIPresetSyncSchema.safeParse(validPreset)
    expect(result.success).toBe(true)
  })

  it('should reject preset without updatedAt', () => {
    const { updatedAt: _updatedAt2, ...withoutUpdatedAt } = validPreset
    void _updatedAt2
    const result = AIPresetSyncSchema.safeParse(withoutUpdatedAt)
    expect(result.success).toBe(false)
  })

  it('should reject preset with invalid updatedAt', () => {
    const result = AIPresetSyncSchema.safeParse({ ...validPreset, updatedAt: 'invalid' })
    expect(result.success).toBe(false)
  })

  it('should reject preset with invalid baseUrl', () => {
    const result = AIPresetSyncSchema.safeParse({ ...validPreset, baseUrl: 'not-a-url' })
    expect(result.success).toBe(false)
  })

  it('should accept preset with all optional fields', () => {
    const result = AIPresetSyncSchema.safeParse({
      ...validPreset,
      systemPrompt: 'You are helpful',
      temperature: 0.9,
      todoAssistant: true,
      skillIds: ['skill-1'],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.temperature).toBe(0.9)
      expect(result.data.todoAssistant).toBe(true)
    }
  })
})

describe('AIPresetSyncListSchema', () => {
  it('should accept array of valid presets', () => {
    const result = AIPresetSyncListSchema.safeParse([
      {
        id: 'p1',
        name: 'GPT-4',
        baseUrl: 'https://api.openai.com',
        model: 'gpt-4',
        updatedAt: '2025-01-01T00:00:00.000Z',
      },
    ])
    expect(result.success).toBe(true)
  })

  it('should reject array containing preset without updatedAt', () => {
    const result = AIPresetSyncListSchema.safeParse([
      {
        id: 'p1',
        name: 'GPT-4',
        baseUrl: 'https://api.openai.com',
        model: 'gpt-4',
        updatedAt: '2025-01-01T00:00:00.000Z',
      },
      { id: 'p2', name: 'Claude', baseUrl: 'https://api.anthropic.com', model: 'claude-3' },
    ])
    expect(result.success).toBe(false)
  })
})
