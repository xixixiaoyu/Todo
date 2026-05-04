/**
 * AI 数据服务端同步 HTTP 层
 *
 * 同步策略: server-as-truth — 加载时 API 优先，失败回退 localStorage
 *
 * 安全边界:
 * - AISkill.runtime 不出客户端（含 API secrets）
 * - AIPreset.apiKey 不出客户端（LLM 服务商密钥）
 */

import { httpClient } from '@/api'
import {
  type ApiResponse,
  type AIMemoryData,
  type AISkillSync,
  type AIPresetSync,
  unwrapApiResponse,
} from '@lumina/shared'
import type { AISkill } from './types'
import type { AIPreset } from '@/features/ai/composables/useAIConfig/types'

// ─── HTTP helpers ──────────────────────────────────────────────────

async function safeGet<T>(url: string): Promise<T | null> {
  try {
    const { data } = await httpClient.get<ApiResponse<T>>(url)
    return unwrapApiResponse(data)
  } catch {
    return null
  }
}

async function safePut<T>(url: string, body: unknown): Promise<void> {
  try {
    await httpClient.put<ApiResponse<T>>(url, body)
  } catch {
    // 写入失败静默，下次加载时 API 优先会恢复
  }
}

// ─── Memories ──────────────────────────────────────────────────────

/**
 * 从服务端拉取记忆数据
 * @returns AIMemoryData | null — null 表示 API 不可用，调用方应回退 localStorage
 */
export async function fetchMemories(): Promise<AIMemoryData | null> {
  return safeGet<AIMemoryData>('/ai/memories')
}

/**
 * 全量推送记忆数据到服务端
 */
export async function pushMemories(data: AIMemoryData): Promise<void> {
  await safePut<AIMemoryData>('/ai/memories', data)
}

// ─── Skills ────────────────────────────────────────────────────────

/**
 * 从服务端拉取 Skills（不含 runtime secrets）
 * @returns AISkillSync[] | null
 */
export async function fetchSkills(): Promise<AISkillSync[] | null> {
  return safeGet<AISkillSync[]>('/ai/skills')
}

/**
 * 全量推送 Skills 到服务端（自动剥离 runtime）
 */
export async function pushSkills(skills: AISkill[]): Promise<void> {
  const syncData: AISkillSync[] = skills.map(({ runtime: _, ...rest }) => rest)
  await safePut<AISkillSync[]>('/ai/skills', syncData)
}

// ─── Presets ───────────────────────────────────────────────────────

/**
 * 从服务端拉取 Presets（不含 apiKey）
 * @returns AIPresetSync[] | null — 调用方需补 apiKey 字段
 */
export async function fetchPresets(): Promise<AIPresetSync[] | null> {
  return safeGet<AIPresetSync[]>('/ai/presets')
}

/**
 * 全量推送 Presets 到服务端（自动剥离 apiKey）
 */
export async function pushPresets(presets: AIPreset[]): Promise<void> {
  const syncData: AIPresetSync[] = presets.map(({ apiKey: _, ...rest }) => rest as AIPresetSync)
  await safePut<AIPresetSync[]>('/ai/presets', syncData)
}
