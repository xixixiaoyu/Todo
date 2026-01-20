import { ref } from 'vue'
import i18n from '@/i18n'
import { getAIStaticResponse } from '@/services/aiService'
import { getAIConfig, getAIPresets } from './useAIConfig'

const { t } = i18n.global

const MEMORY_STORAGE_KEY = 'ai-memories'
const MEMORY_ENABLED_KEY = 'ai-memory-enabled'
const MEMORY_THRESHOLD_KEY = 'ai-memory-threshold'
const MAX_MEMORIES = 100 // 扩充记忆容量至 100 条
const DEFAULT_THRESHOLD = 30 // 默认触发自动压缩的阈值

// 定义全局状态，确保在不同组件/Composable 之间共享
const memories = ref<string[]>(JSON.parse(localStorage.getItem(MEMORY_STORAGE_KEY) || '[]'))
const isMemoryEnabled = ref(localStorage.getItem(MEMORY_ENABLED_KEY) === 'true')
const autoCompressThreshold = ref(
  Number(localStorage.getItem(MEMORY_THRESHOLD_KEY)) || DEFAULT_THRESHOLD,
)
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
   * 检查记忆库中是否已存在相似或相同的记忆
   * 采用大小写不敏感匹配及单词边界匹配，避免 "Memory 1" 错误匹配 "Memory 10"
   */
  const findSimilarMemory = (content: string, targetMemories?: string[]) => {
    const normalized = content.trim().toLowerCase()
    if (!normalized) return null

    const listToSearch = targetMemories || memories.value
    return listToSearch.find((m) => {
      const existingNormalized = m.trim().toLowerCase()
      if (existingNormalized === normalized) return true

      // 使用单词边界匹配，确保是完整的语义包含，而非简单的子串
      try {
        // 转义正则特殊字符
        const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const regex = new RegExp(`\\b${escaped}\\b`, 'i')
        return (
          regex.test(existingNormalized) ||
          new RegExp(
            `\\b${existingNormalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
            'i',
          ).test(normalized)
        )
      } catch {
        return false
      }
    })
  }

  /**
   * 自动触发压缩策略
   */
  const checkAutoCompress = () => {
    if (
      isMemoryEnabled.value &&
      memories.value.length >= autoCompressThreshold.value &&
      !isCompressing.value
    ) {
      compressMemories().catch((err) => {
        console.error('[Memory] Auto-compression failed:', err)
      })
    }
  }

  /**
   * 添加新记忆并去重，限制最大存储量
   */
  const addMemories = (newMemories: string[]) => {
    if (!newMemories || !newMemories.length) return

    let hasNew = false
    const currentMemories = [...memories.value]

    newMemories.forEach((m) => {
      const trimmed = m.trim()
      if (!trimmed) return

      // 检查相似性
      const isDuplicate = !!findSimilarMemory(trimmed, currentMemories)

      if (!isDuplicate) {
        currentMemories.push(trimmed)
        hasNew = true
      }
    })

    if (hasNew) {
      // 保持数组长度不超过 MAX_MEMORIES，保留最新的
      memories.value = currentMemories.slice(-MAX_MEMORIES)
      localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(memories.value))
    }

    // 只要有提取尝试且当前超过阈值，就尝试触发压缩（即便本次没有新记忆加入，也可能是之前漏掉了或手动添加导致的）
    checkAutoCompress()
  }

  /**
   * 手动添加单条记忆
   */
  const addMemory = (content: string) => {
    addMemories([content])
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

      if (!response || !response.content) {
        throw new Error('Empty response from AI')
      }

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

  /**
   * 更新自动压缩阈值
   */
  const updateAutoCompressThreshold = (value: number) => {
    autoCompressThreshold.value = value
    localStorage.setItem(MEMORY_THRESHOLD_KEY, String(value))
  }

  return {
    memories,
    isMemoryEnabled,
    autoCompressThreshold,
    isCompressing,
    lastError,
    addMemory,
    addMemories,
    removeMemory,
    updateMemory,
    clearMemories,
    toggleMemory,
    compressMemories,
    updateAutoCompressThreshold,
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
