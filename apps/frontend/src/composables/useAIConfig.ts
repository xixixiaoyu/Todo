import { ref, watch, readonly } from 'vue'

export type ThinkingMode = 'enabled' | 'disabled'

export interface AIConfig {
  baseUrl: string
  apiKey: string
  model: string
  temperature: number
  systemPrompt: string
  thinkingMode: ThinkingMode
}

const STORAGE_KEY = 'ai-config'

// 默认配置
const DEFAULT_CONFIG: AIConfig = {
  baseUrl: import.meta.env.VITE_AI_API_URL || 'https://api.deepseek.com',
  apiKey: import.meta.env.VITE_AI_API_KEY || '',
  model: import.meta.env.VITE_AI_MODEL || 'deepseek-chat',
  temperature: 0.7,
  systemPrompt: '你是一个友好的 AI 助手，请用简洁明了的中文回答用户的问题。',
  thinkingMode: 'enabled',
}

// 全局配置状态（单例）
const config = ref<AIConfig>(loadConfig())

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
 * 保存配置到 localStorage
 */
function saveConfig(cfg: AIConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg))
  } catch {
    console.warn('保存 AI 配置失败')
  }
}

// 监听配置变化自动保存
watch(config, (newConfig) => saveConfig(newConfig), { deep: true })

/**
 * AI 配置管理 composable
 */
export function useAIConfig() {
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

  return {
    config: readonly(config),
    updateConfig,
    resetConfig,
    isConfigValid,
    DEFAULT_CONFIG,
  }
}

/**
 * 获取当前配置（供 aiService 使用）
 */
export function getAIConfig(): AIConfig {
  return config.value
}
