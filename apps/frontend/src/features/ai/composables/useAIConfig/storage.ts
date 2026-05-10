import { STORAGE_KEY, PRESETS_STORAGE_KEY, SKILLS_STORAGE_KEY, ACTIVE_PRESET_KEY } from './types'
import type { AIConfig, AIPreset } from './types'
import { normalizePreset, normalizeSkill } from './skill-utils'
import type { AISkill } from '@/features/ai/services/types'

// ─── Save Functions ────────────────────────────────────────────────

export function saveConfig(cfg: AIConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg))
  } catch {
    console.warn('保存 AI 配置失败')
  }
}

export function savePresets(data: AIPreset[]): void {
  try {
    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(data))
  } catch {
    console.warn('保存预设失败')
  }
}

export function saveSkills(data: AISkill[]): void {
  try {
    localStorage.setItem(SKILLS_STORAGE_KEY, JSON.stringify(data))
  } catch {
    console.warn('保存技能失败')
  }
}

export function saveActivePresetId(id: string | null): void {
  if (id) {
    localStorage.setItem(ACTIVE_PRESET_KEY, id)
  } else {
    localStorage.removeItem(ACTIVE_PRESET_KEY)
  }
}

// ─── Load Functions ────────────────────────────────────────────────

export function loadPresets(): AIPreset[] {
  try {
    const saved = localStorage.getItem(PRESETS_STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved) as unknown
      if (!Array.isArray(parsed)) return []
      return parsed.map((item) => normalizePreset(item)).filter((item): item is AIPreset => !!item)
    }
  } catch {
    console.warn('加载预设失败')
  }

  return []
}

export function loadSkills(): AISkill[] {
  try {
    const saved = localStorage.getItem(SKILLS_STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved) as unknown
      if (!Array.isArray(parsed)) return []
      const normalizedSkills = parsed
        .map((item) => normalizeSkill(item))
        .filter((item): item is AISkill => !!item)

      const normalizedSerialized = JSON.stringify(normalizedSkills)
      if (normalizedSerialized !== saved) {
        localStorage.setItem(SKILLS_STORAGE_KEY, normalizedSerialized)
      }

      return normalizedSkills
    }
  } catch {
    console.warn('加载技能失败')
  }

  return []
}

export function loadActivePresetId(): string | null {
  return localStorage.getItem(ACTIVE_PRESET_KEY)
}
