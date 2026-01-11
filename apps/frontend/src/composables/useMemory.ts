import { ref } from 'vue'
import i18n from '@/i18n'
import { getAIStaticResponse } from '@/services/aiService'
import { getAIConfig, getAIPresets } from './useAIConfig'

const { t } = i18n.global

const MEMORY_STORAGE_KEY = 'ai-memories'
const MEMORY_ENABLED_KEY = 'ai-memory-enabled'
const MAX_MEMORIES = 100 // 扩充记忆容量至 100 条

// 定义全局状态，确保在不同组件/Composable 之间共享
const memories = ref<string[]>(JSON.parse(localStorage.getItem(MEMORY_STORAGE_KEY) || '[]'))
const isMemoryEnabled = ref(localStorage.getItem(MEMORY_ENABLED_KEY) === 'true')
const isCompressing = ref(false)
const lastError = ref<string | null>(null)

/**
 * AI 助手记忆功能 Composable
 * 负责管理记忆的读取、去重存储和开关状态
 */
export function useMemory() {
  /**
   * 获取记忆专用模型配置
   */
  function getMemoryModelOptions() {
    const config = getAIConfig()
    if (!config.memoryModelId) return {}

    const presets = getAIPresets()
    const preset = presets.find((p) => p.id === config.memoryModelId)
    if (!preset) return {}

    return {
      baseUrl: preset.baseUrl,
      apiKey: preset.apiKey,
      model: preset.model,
      temperature: 0.3, // 记忆任务通常需要较低的随机性
    }
  }

  /**
   * 添加新记忆并去重，限制最大存储量
   */
  const addMemories = (newMemories: string[]) => {
    if (!newMemories || !newMemories.length) return

    const current = new Set(memories.value)
    let hasNew = false

    newMemories.forEach((m) => {
      const trimmed = m.trim()
      if (trimmed && !current.has(trimmed)) {
        current.add(trimmed)
        hasNew = true
      }
    })

    if (hasNew) {
      // 保持数组长度不超过 MAX_MEMORIES，保留最新的
      memories.value = Array.from(current).slice(-MAX_MEMORIES)
      localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(memories.value))
    }
  }

  /**
   * 手动添加单条记忆
   */
  const addMemory = (content: string) => {
    const trimmed = content.trim()
    if (!trimmed) return
    if (memories.value.includes(trimmed)) return

    memories.value = [...memories.value, trimmed].slice(-MAX_MEMORIES)
    localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(memories.value))
  }

  /**
   * 更新指定索引的记忆
   */
  const updateMemory = (index: number, content: string) => {
    const trimmed = content.trim()
    if (!trimmed || index < 0 || index >= memories.value.length) return

    memories.value[index] = trimmed
    localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(memories.value))
  }

  /**
   * 压缩记忆
   * 调用 LLM 对记忆进行合并、去重和精简
   */
  const compressMemories = async () => {
    if (memories.value.length <= 3) return

    isCompressing.value = true
    lastError.value = null

    const memoriesStr = memories.value.map((m, i) => `${i + 1}. ${m}`).join('\n')
    const prompt = t('ai.memoryCompressionPrompt', { memories: memoriesStr })

    try {
      const options = getMemoryModelOptions()
      const response = await getAIStaticResponse([{ role: 'user', content: prompt }], options)
      const result = response.content
      const jsonStr = result.replace(/```json\n?|\n?```/g, '').trim()
      const compressed = JSON.parse(jsonStr)

      if (Array.isArray(compressed) && compressed.length > 0) {
        memories.value = compressed
        localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(memories.value))
      }
    } catch (err) {
      console.error('Failed to compress memories:', err)
      lastError.value = err instanceof Error ? err.message : 'Unknown error'
      throw err
    } finally {
      isCompressing.value = false
    }
  }

  /**
   * 删除单条记忆
   */
  const removeMemory = (index: number) => {
    memories.value.splice(index, 1)
    localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(memories.value))
  }

  /**
   * 清空所有记忆
   */
  const clearMemories = () => {
    memories.value = []
    localStorage.removeItem(MEMORY_STORAGE_KEY)
  }

  /**
   * 切换记忆功能开关
   */
  const toggleMemory = (enabled: boolean) => {
    isMemoryEnabled.value = enabled
    localStorage.setItem(MEMORY_ENABLED_KEY, String(enabled))
  }

  return {
    memories,
    isMemoryEnabled,
    isCompressing,
    lastError,
    addMemories,
    addMemory,
    updateMemory,
    compressMemories,
    removeMemory,
    clearMemories,
    toggleMemory,
    getMemoryModelOptions,
  }
}

/**
 * 导出重置函数用于测试
 */
export function _resetMemory() {
  memories.value = JSON.parse(localStorage.getItem(MEMORY_STORAGE_KEY) || '[]')
  isMemoryEnabled.value = localStorage.getItem(MEMORY_ENABLED_KEY) === 'true'
  isCompressing.value = false
}
