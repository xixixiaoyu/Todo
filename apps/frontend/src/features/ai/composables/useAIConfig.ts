import { ref, watch, readonly, computed } from 'vue'
import i18n from '@/i18n'
import { generateId } from '@/features/ai/services/aiService'

export type ThinkingMode = 'enabled' | 'disabled'
export type AssistantMode = 'default' | 'teaching'

export interface AIConfig {
  assistantMode: AssistantMode
  baseUrl: string
  apiKey: string
  model: string
  temperature: number
  systemPrompt: string
  thinkingMode: ThinkingMode
  thinkingEffort: 'low' | 'medium' | 'high'
  todoAssistant: boolean
  discussionMode: boolean
  discussionModelIds: readonly string[]
  discussionPrimaryModelId: string | null
  memoryModelId: string | null
  enableImageGeneration: boolean
  mcpEnabled: boolean
  contextCompressionEnabled: boolean
  contextCompressionTriggerChars: number
  contextCompressionModelId: string | null
}

export interface AIPreset {
  id: string
  name: string
  baseUrl: string
  apiKey: string
  model: string
  systemPrompt: string
  temperature: number
  thinkingEffort?: 'low' | 'medium' | 'high'
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
  assistantMode: 'default',
  baseUrl: 'https://api.deepseek.com',
  apiKey: '',
  model: 'deepseek-chat',
  temperature: 0.6,
  systemPrompt: i18n.global.t('ai.defaultSystemPrompt'),
  thinkingMode: aiThinkingMode.value, // 使用初始值
  thinkingEffort: 'high',
  todoAssistant: false,
  discussionMode: false,
  discussionModelIds: [],
  discussionPrimaryModelId: null,
  memoryModelId: null,
  enableImageGeneration: false,
  mcpEnabled: false,
  contextCompressionEnabled: false,
  contextCompressionTriggerChars: 24000,
  contextCompressionModelId: null,
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

  // 默认预设
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

/**
 * 检查配置是否匹配预设
 */
function isConfigMatchPreset(cfg: AIConfig, preset: AIPreset): boolean {
  return (
    preset.baseUrl === cfg.baseUrl &&
    preset.apiKey === cfg.apiKey &&
    preset.model === cfg.model &&
    preset.systemPrompt === cfg.systemPrompt &&
    Math.abs(preset.temperature - cfg.temperature) < 0.001 &&
    (preset.thinkingEffort || 'high') === cfg.thinkingEffort
  )
}

/**
 * 查找匹配的预设 ID
 */
function findMatchingPreset(cfg: AIConfig, presetList: AIPreset[]): string | null {
  const match = presetList.find((p) => isConfigMatchPreset(cfg, p))
  return match ? match.id : null
}

// 监听配置变化自动保存
watch(config, (newConfig) => saveConfig(newConfig), { deep: true })
watch(presets, (newPresets) => savePresets(newPresets), { deep: true })
watch(activePresetId, (id) => saveActivePresetId(id))

// 监听配置或预设变化，自动同步激活状态
watch(
  [config, presets],
  ([newConfig, newPresets]) => {
    // 如果当前激活的预设仍然匹配，保持不变（解决相同配置预设无法切换的问题）
    if (activePresetId.value) {
      const currentPreset = (newPresets as AIPreset[]).find((p) => p.id === activePresetId.value)
      if (currentPreset && isConfigMatchPreset(newConfig as AIConfig, currentPreset)) {
        return
      }
    }

    const matchingId = findMatchingPreset(newConfig as AIConfig, newPresets as AIPreset[])
    if (activePresetId.value !== matchingId) {
      activePresetId.value = matchingId
    }
  },
  { deep: true },
)

/**
 * 导出重置函数用于测试
 */
export function _resetAIConfig() {
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
      ...config.value,
      baseUrl: preset.baseUrl,
      apiKey: preset.apiKey,
      model: preset.model,
      systemPrompt: preset.systemPrompt,
      temperature: preset.temperature,
      thinkingEffort: preset.thinkingEffort || 'high',
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
      const updatedPreset = { ...presets.value[index], ...updates }
      // 使用 splice 确保触发 Vue 3 的响应式更新
      presets.value.splice(index, 1, updatedPreset)

      // 如果更新的是当前激活的预设，同步更新配置
      if (activePresetId.value === presetId) {
        config.value = {
          ...config.value,
          baseUrl: updatedPreset.baseUrl,
          apiKey: updatedPreset.apiKey,
          model: updatedPreset.model,
          systemPrompt: updatedPreset.systemPrompt,
          temperature: updatedPreset.temperature,
          thinkingEffort: updatedPreset.thinkingEffort || 'high',
          todoAssistant: updatedPreset.todoAssistant,
        }
      }
    }
  }

  /**
   * 将当前配置同步到指定预设（默认同步到当前激活预设）
   */
  function syncConfigToPreset(presetId: string | null = activePresetId.value): boolean {
    if (!presetId) return false

    const preset = presets.value.find((p) => p.id === presetId)
    if (!preset) return false

    updatePreset(presetId, {
      baseUrl: config.value.baseUrl,
      apiKey: config.value.apiKey,
      model: config.value.model,
      systemPrompt: config.value.systemPrompt,
      temperature: config.value.temperature,
      thinkingEffort: config.value.thinkingEffort,
      todoAssistant: config.value.todoAssistant,
    })

    activePresetId.value = presetId
    return true
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
   * 复制预设
   */
  function duplicatePreset(presetId: string): AIPreset | null {
    const preset = presets.value.find((p) => p.id === presetId)
    if (!preset) return null

    const newPreset: AIPreset = {
      ...preset,
      id: generateId(),
      name: `${preset.name}${i18n.global.t('ai.copySuffix')}`,
    }
    presets.value.push(newPreset)
    return newPreset
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
      thinkingEffort: config.value.thinkingEffort,
      todoAssistant: config.value.todoAssistant,
    }
  }

  /**
   * 导出所有预设为 JSON 字符串
   */
  function exportPresets(): string {
    return JSON.stringify(presets.value, null, 2)
  }

  /**
   * 导入预设
   * @param jsonStr JSON 字符串
   * @param mode 导入模式：'merge' 合并（默认），'replace' 替换
   */
  function importPresets(jsonStr: string, mode: 'merge' | 'replace' = 'merge'): void {
    try {
      const imported = JSON.parse(jsonStr) as unknown
      if (!Array.isArray(imported)) {
        throw new Error('Invalid presets format: expected an array')
      }

      // 基础验证：每个项都应该有必要的字段
      const validPresets = (imported as unknown[]).filter((p): p is AIPreset => {
        if (typeof p !== 'object' || p === null) return false
        const item = p as Record<string, unknown>
        return (
          typeof item.name === 'string' &&
          typeof item.baseUrl === 'string' &&
          typeof item.model === 'string'
        )
      })

      if (validPresets.length === 0 && (imported as unknown[]).length > 0) {
        throw new Error('No valid presets found in the imported data')
      }

      // 为导入的预设生成新 ID，避免冲突
      const processedPresets = validPresets.map((p) => ({
        ...p,
        id: generateId(), // 总是生成新 ID 确保唯一性
      }))

      if (mode === 'replace') {
        presets.value = processedPresets
        activePresetId.value = null
      } else {
        presets.value = [...presets.value, ...processedPresets]
      }
    } catch (error) {
      console.error('导入预设失败:', error)
      throw error
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
    duplicatePreset,
    syncConfigToPreset,
    getPresetDefaults,
    exportPresets,
    importPresets,
  }
}

/**
 * 获取当前配置（供 aiService 使用）
 */
export function getAIConfig(): AIConfig {
  return config.value
}

/**
 * 获取当前所有预设（供 aiService 使用）
 */
export function getAIPresets(): AIPreset[] {
  return presets.value
}
