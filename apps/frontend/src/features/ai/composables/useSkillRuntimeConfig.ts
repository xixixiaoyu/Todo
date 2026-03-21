import { readonly, ref, watch } from 'vue'

export interface SkillRuntimeConfig {
  secrets: Record<string, string>
}

const SKILL_RUNTIME_STORAGE_KEY = 'ai-skill-runtime-config'

export const DEFAULT_SKILL_RUNTIME_CONFIG: SkillRuntimeConfig = {
  secrets: {},
}

function normalizeSecretValues(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

  const entries = Object.entries(value as Record<string, unknown>)
  const normalized: Record<string, string> = {}

  for (const [key, raw] of entries) {
    const secretKey = key.trim()
    if (!secretKey || typeof raw !== 'string') continue
    normalized[secretKey] = raw
  }

  return normalized
}

function loadSkillRuntimeConfig(): SkillRuntimeConfig {
  try {
    const saved = localStorage.getItem(SKILL_RUNTIME_STORAGE_KEY)
    if (!saved) return { ...DEFAULT_SKILL_RUNTIME_CONFIG }

    const parsed = JSON.parse(saved) as Record<string, unknown>
    const secrets = normalizeSecretValues(parsed.secrets)

    if (Object.keys(secrets).length > 0) {
      return { secrets }
    }

    const legacyTavilyApiKey = typeof parsed.tavilyApiKey === 'string' ? parsed.tavilyApiKey : ''
    const normalized: SkillRuntimeConfig = {
      secrets: legacyTavilyApiKey ? { tavilyApiKey: legacyTavilyApiKey } : {},
    }

    if (legacyTavilyApiKey) {
      localStorage.setItem(SKILL_RUNTIME_STORAGE_KEY, JSON.stringify(normalized))
    }

    return normalized
  } catch {
    console.warn('加载技能运行时配置失败')
    return { ...DEFAULT_SKILL_RUNTIME_CONFIG }
  }
}

function saveSkillRuntimeConfig(config: SkillRuntimeConfig): void {
  try {
    localStorage.setItem(SKILL_RUNTIME_STORAGE_KEY, JSON.stringify(config))
  } catch {
    console.warn('保存技能运行时配置失败')
  }
}

const skillRuntimeConfig = ref<SkillRuntimeConfig>(loadSkillRuntimeConfig())

watch(skillRuntimeConfig, (value) => saveSkillRuntimeConfig(value), { deep: true })

export function getSkillRuntimeConfig(): SkillRuntimeConfig {
  return skillRuntimeConfig.value
}

export function _resetSkillRuntimeConfig() {
  skillRuntimeConfig.value = loadSkillRuntimeConfig()
}

export function useSkillRuntimeConfig() {
  function setSkillRuntimeSecret(secretKey: string, value: string): void {
    const key = secretKey.trim()
    if (!key) return

    const nextSecrets = { ...skillRuntimeConfig.value.secrets }
    if (value) {
      nextSecrets[key] = value
    } else {
      delete nextSecrets[key]
    }

    skillRuntimeConfig.value = {
      ...skillRuntimeConfig.value,
      secrets: nextSecrets,
    }
  }

  return {
    skillRuntimeConfig: readonly(skillRuntimeConfig),
    setSkillRuntimeSecret,
    DEFAULT_SKILL_RUNTIME_CONFIG,
  }
}
