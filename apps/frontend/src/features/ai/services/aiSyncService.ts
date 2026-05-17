/**
 * AI 数据同步服务（本地模式 - 无后端）
 *
 * 原本用于服务端多端同步，现在仅保留本地存储。
 * 所有 HTTP 调用已移除，函数返回空结果或 no-op。
 */

// ─── 本地兼容类型（原 @lumina/shared 中已删除） ──────────────────

export interface AIMemoryData {
  memories: string[]
  enabled: boolean
  threshold: number
  updatedAt: string
}

export interface AISkillSync {
  id: string
  name: string
  prompt: string
  skillData?: unknown
  updatedAt: string
  createdAt?: string
  runtime?: unknown
  [key: string]: unknown
}

export interface AIPresetSync {
  id: string
  name: string
  baseUrl: string
  model: string
  systemPrompt: string
  temperature: number
  todoAssistant: boolean
  skillIds: string[]
  apiKey?: string
  presetData?: unknown
  updatedAt: string
  createdAt?: string
  [key: string]: unknown
}

// ─── 记忆 ────────────────────────────────────────────────────────

export async function fetchMemories(): Promise<AIMemoryData | null> {
  return null
}

export async function pushMemories(_data: Record<string, unknown>): Promise<void> {
  // no-op (local-only)
}

// ─── 技能 ────────────────────────────────────────────────────────

export async function fetchSkills(): Promise<AISkillSync[] | null> {
  return null
}

export async function pushSkills(_skills: unknown): Promise<void> {
  // no-op (local-only)
}

// ─── 预设 ────────────────────────────────────────────────────────

export async function fetchPresets(): Promise<AIPresetSync[] | null> {
  return null
}

export async function pushPresets(_presets: unknown): Promise<void> {
  // no-op (local-only)
}
