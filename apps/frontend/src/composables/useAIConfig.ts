import { ref, watch, readonly, computed } from 'vue'
import { generateId } from '@/services/aiService'

export type ThinkingMode = 'enabled' | 'disabled'

export interface AIConfig {
  baseUrl: string
  apiKey: string
  model: string
  temperature: number
  systemPrompt: string
  thinkingMode: ThinkingMode
  todoAssistant: boolean
}

export interface AIPreset {
  id: string
  name: string
  baseUrl: string
  apiKey: string
  model: string
  systemPrompt: string
  temperature: number
  thinkingMode: ThinkingMode
  todoAssistant: boolean
}

const STORAGE_KEY = 'ai-config'
const PRESETS_STORAGE_KEY = 'ai-presets'
const ACTIVE_PRESET_KEY = 'ai-active-preset'
const AI_THINKING_MODE_STORAGE_KEY = 'ai_thinking_mode'

/**
 * AI 思考模式状态
 */
export const aiThinkingMode = ref<'enabled' | 'disabled'>(
  (localStorage.getItem(AI_THINKING_MODE_STORAGE_KEY) as 'enabled' | 'disabled') || 'enabled',
)

/**
 * 获取 AI 思考模式
 */
export function getAIThinkingMode(): 'enabled' | 'disabled' {
  return aiThinkingMode.value
}

/**
 * 保存 AI 思考模式
 */
export function saveAIThinkingMode(mode: 'enabled' | 'disabled'): void {
  aiThinkingMode.value = mode
}

// 默认配置
const DEFAULT_CONFIG: AIConfig = {
  baseUrl: import.meta.env.VITE_AI_API_URL || 'https://api.deepseek.com',
  apiKey: import.meta.env.VITE_AI_API_KEY || '',
  model: import.meta.env.VITE_AI_MODEL || 'deepseek-chat',
  temperature: 0.3,
  systemPrompt: '你是一个友好的 AI 助手，请用简洁明了的中文回答用户的问题。',
  thinkingMode: aiThinkingMode.value, // 使用初始值
  todoAssistant: false,
}

// 全局配置状态（单例）
const config = ref<AIConfig>(loadConfig())
const presets = ref<AIPreset[]>(loadPresets())
const activePresetId = ref<string | null>(loadActivePresetId())

// 监听思考模式变化并同步
watch(aiThinkingMode, (val) => {
  localStorage.setItem(AI_THINKING_MODE_STORAGE_KEY, val)
  if (config.value.thinkingMode !== val) {
    config.value.thinkingMode = val
  }
})

watch(
  () => config.value.thinkingMode,
  (val) => {
    if (aiThinkingMode.value !== val) {
      aiThinkingMode.value = val
    }
  },
)

/**
 * 从 localStorage 加载配置
 */
function loadConfig(): AIConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      return { ...DEFAULT_CONFIG, ...parsed }
    }
  } catch {
    console.warn('加载 AI 配置失败')
  }
  return { ...DEFAULT_CONFIG }
}

/**
 * 加载预设
 */
function loadPresets(): AIPreset[] {
  try {
    const saved = localStorage.getItem(PRESETS_STORAGE_KEY)
    if (saved) return JSON.parse(saved)
  } catch {
    console.warn('加载预设失败')
  }
  return []
}

/**
 * 加载当前激活的预设 ID
 */
function loadActivePresetId(): string | null {
  return localStorage.getItem(ACTIVE_PRESET_KEY)
}

/**
 * 保存配置到 localStorage
 */
function saveConfig(cfg: AIConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg))
  } catch {
    console.warn('保存 AI 配置失败')
  }
}

/**
 * 保存预设
 */
function savePresets(data: AIPreset[]): void {
  try {
    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(data))
  } catch {
    console.warn('保存预设失败')
  }
}

/**
 * 保存当前激活的预设 ID
 */
function saveActivePresetId(id: string | null): void {
  if (id) {
    localStorage.setItem(ACTIVE_PRESET_KEY, id)
  } else {
    localStorage.removeItem(ACTIVE_PRESET_KEY)
  }
}

// 监听配置变化自动保存
watch(config, (newConfig) => saveConfig(newConfig), { deep: true })
watch(presets, (newPresets) => savePresets(newPresets), { deep: true })
watch(activePresetId, (id) => saveActivePresetId(id))

/**
 * 导出重置函数用于测试
 */
export function _reset() {
  aiThinkingMode.value =
    (localStorage.getItem(AI_THINKING_MODE_STORAGE_KEY) as 'enabled' | 'disabled') || 'enabled'
  config.value = loadConfig()
  presets.value = loadPresets()
  activePresetId.value = loadActivePresetId()
}

/**
 * AI 配置管理 composable
 */
export function useAIConfig() {
  // 当前激活的预设
  const activePreset = computed(
    () => presets.value.find((p) => p.id === activePresetId.value) ?? null,
  )

  /**
   * 更新配置
   */
  function updateConfig(partial: Partial<AIConfig>): void {
    config.value = { ...config.value, ...partial }
  }

  /**
   * 重置为默认配置
   */
  function resetConfig(): void {
    config.value = { ...DEFAULT_CONFIG }
  }

  /**
   * 验证配置是否有效
   */
  function isConfigValid(): boolean {
    return !!(config.value.baseUrl && config.value.apiKey && config.value.model)
  }

  /**
   * 切换预设
   */
  function switchPreset(presetId: string): void {
    const preset = presets.value.find((p) => p.id === presetId)
    if (!preset) return

    activePresetId.value = presetId
    config.value = {
      baseUrl: preset.baseUrl,
      apiKey: preset.apiKey,
      model: preset.model,
      systemPrompt: preset.systemPrompt,
      temperature: preset.temperature,
      thinkingMode: preset.thinkingMode,
      todoAssistant: preset.todoAssistant,
    }
  }

  /**
   * 添加预设
   */
  function addPreset(preset: Omit<AIPreset, 'id'>): AIPreset {
    const newPreset: AIPreset = {
      ...preset,
      id: generateId(),
    }
    presets.value.push(newPreset)
    return newPreset
  }

  /**
   * 更新预设
   */
  function updatePreset(presetId: string, updates: Partial<Omit<AIPreset, 'id'>>): void {
    const index = presets.value.findIndex((p) => p.id === presetId)
    if (index !== -1) {
      presets.value[index] = { ...presets.value[index], ...updates }
    }
  }

  /**
   * 删除预设
   */
  function deletePreset(presetId: string): void {
    const index = presets.value.findIndex((p) => p.id === presetId)
    if (index !== -1) {
      presets.value.splice(index, 1)
      if (activePresetId.value === presetId) {
        activePresetId.value = null
      }
    }
  }

  /**
   * 从当前配置创建预设默认值
   */
  function getPresetDefaults(): Omit<AIPreset, 'id' | 'name'> {
    return {
      baseUrl: config.value.baseUrl,
      apiKey: config.value.apiKey,
      model: config.value.model,
      systemPrompt: config.value.systemPrompt,
      temperature: config.value.temperature,
      thinkingMode: config.value.thinkingMode,
      todoAssistant: config.value.todoAssistant,
    }
  }

  return {
    config: readonly(config),
    updateConfig,
    resetConfig,
    isConfigValid,
    DEFAULT_CONFIG,
    // 预设相关
    presets,
    activePreset,
    activePresetId: readonly(activePresetId),
    switchPreset,
    addPreset,
    updatePreset,
    deletePreset,
    getPresetDefaults,
  }
}

/**
 * 获取当前配置（供 aiService 使用）
 */
export function getAIConfig(): AIConfig {
  return config.value
}
