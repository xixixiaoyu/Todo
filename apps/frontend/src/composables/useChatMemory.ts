import { ref } from 'vue'
import i18n from '@/i18n'
import { getAIStaticResponse, type ChatMessage } from '@/services/aiService'
import { useMemory } from './useMemory'
import { useToast } from './useToast'

// 全局单例状态
const messageCounterSinceLastExtraction = ref(0)

/**
 * 聊天记忆提取逻辑 composable
 */
export function useChatMemory() {
  const t = i18n.global.t
  const { error: toastError } = useToast()
  const {
    memories,
    addMemories,
    isMemoryEnabled,
    getMemoryModelOptions,
    lastError: memoryError,
  } = useMemory()

  /**
   * 检查是否包含暗示需要记忆的语义关键词
   */
  function hasMemoryKeywords(history: ChatMessage[]) {
    const lastUserMsg = [...history].reverse().find((m) => m.role === 'user')
    if (!lastUserMsg) return false

    // 提高字数阈值，短句通常不包含实质性背景
    if (lastUserMsg.content.trim().length < 8) return false

    const keywords = [
      '我常用',
      '我习惯',
      '我的技术栈',
      '偏好',
      '倾向于',
      '一直都',
      '记住',
      '记得',
      '以后都',
      '总是',
      '我的项目',
      '我在做',
      'i usually',
      'i prefer',
      'my stack',
      'remember',
      'always',
      'my project',
      'i am working on',
      '我的背景',
      'my background',
    ]
    const content = lastUserMsg.content.toLowerCase()
    return keywords.some((k) => content.includes(k))
  }

  /**
   * 提取并存储记忆
   */
  async function extractAndStoreMemories(history: ChatMessage[]) {
    if (!isMemoryEnabled.value) return

    // 策略优化：
    // 1. 语义触发：如果用户提到了明显的偏好关键词，立即提取
    // 2. 周期触发：平衡严格性与召回率，改为每 3 轮提取一次
    const hasKeywords = hasMemoryKeywords(history)
    messageCounterSinceLastExtraction.value++
    const shouldExtract = hasKeywords || messageCounterSinceLastExtraction.value >= 3

    if (!shouldExtract) return

    // 重置计数器
    messageCounterSinceLastExtraction.value = 0
    memoryError.value = null

    try {
      // 获取最近 6 条消息（约 3 轮对话）作为上下文
      const recentHistory = history.slice(-6)
      const conversation = recentHistory
        .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n')

      const memoriesStr =
        memories.value.length > 0
          ? memories.value.map((m, i) => `${i + 1}. ${m}`).join('\n')
          : t('ai.noMemories')

      const prompt = t('ai.memoryExtractionPrompt', {
        conversation,
        memories: memoriesStr,
      })
      const options = getMemoryModelOptions()
      const response = await getAIStaticResponse([{ role: 'user', content: prompt }], options)
      const result = response.content

      // 尝试解析 JSON
      let newMemories: string[] = []
      try {
        // 移除可能存在的 Markdown 代码块标记
        const jsonStr = result.replace(/```json\n?|\n?```/g, '').trim()
        newMemories = JSON.parse(jsonStr)
      } catch {
        console.warn('Failed to parse memories JSON:', result)
      }

      if (Array.isArray(newMemories) && newMemories.length > 0) {
        addMemories(newMemories)
      }
    } catch (err) {
      console.error('Failed to extract memories:', err)
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      memoryError.value = errorMsg
      toastError(`${t('ai.memoryError')}: ${errorMsg}`)
    }
  }

  return {
    extractAndStoreMemories,
    isMemoryEnabled,
  }
}
