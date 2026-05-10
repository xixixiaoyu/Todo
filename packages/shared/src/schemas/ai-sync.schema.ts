/**
 * AI 数据服务端同步 Zod Schema
 *
 * 同步策略: 多端合并，基于 updatedAt 做冲突仲裁
 * - Memories: findSimilarMemory 语义去重并集
 * - Skills/Presets: 以 id 为键并集合并，同 id 保留 updatedAt 较新者
 *
 * 安全边界:
 * - AISkill.runtime 不同步（含 API secrets）
 * - AIPreset.apiKey 不同步（LLM 服务商密钥）
 */

import { z } from 'zod'
import { ValidationKeys } from './i18n-keys'

// ─── AIMemory ──────────────────────────────────────────────────────

export const AIMemoryDataSchema = z.object({
  memories: z.array(z.string().max(200)).max(100),
  enabled: z.boolean(),
  threshold: z.number().int().min(10).max(100),
  updatedAt: z.string().datetime().optional(),
})

export type AIMemoryData = z.infer<typeof AIMemoryDataSchema>

// ─── AISkill (不含 runtime secrets) ─────────────────────────────────

export const AISkillSyncSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  prompt: z.string().max(10000),
  description: z.string().optional(),
  aliases: z.array(z.string()).optional(),
  path: z.string().optional(),
  resources: z.array(z.string()).optional(),
  allowImplicitInvocation: z.boolean().optional(),
  updatedAt: z.string().datetime(),
  // runtime 字段不同步（含 API secrets）
})

export const AISkillSyncListSchema = z.array(AISkillSyncSchema)

export type AISkillSync = z.infer<typeof AISkillSyncSchema>

// ─── AIPreset (不含 apiKey) ────────────────────────────────────────

export const AIPresetSyncSchema = z.object({
  id: z.string(),
  name: z.string().min(1, ValidationKeys.REQUIRED).max(100),
  baseUrl: z.string().url(ValidationKeys.INVALID_URL),
  model: z.string(),
  systemPrompt: z.string().default(''),
  temperature: z.number().min(0).max(2).default(0.7),
  todoAssistant: z.boolean().default(false),
  skillIds: z.array(z.string()).default([]),
  novelGenre: z
    .enum(['fantasy', 'sci_fi', 'romance', 'thriller', 'wuxia', 'literary', 'horror', 'cyberpunk'])
    .nullable()
    .optional(),
  novelTone: z.string().optional(),
  novelProtagonistHint: z.string().optional(),
  updatedAt: z.string().datetime(),
  // apiKey 不同步（LLM 服务商密钥）
})

export const AIPresetSyncListSchema = z.array(AIPresetSyncSchema)

export type AIPresetSync = z.infer<typeof AIPresetSyncSchema>
