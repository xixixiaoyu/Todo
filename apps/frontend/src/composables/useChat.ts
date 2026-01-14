import { ref, computed } from 'vue'
import i18n from '@/i18n'
import {
  getAIStreamResponse,
  getMultiModelDiscussionStream,
  getAIStaticResponse,
  getAIImageResponse,
  abortCurrentRequest,
  generateId,
  type ChatMessage,
  type AIRequestOptions,
  type DiscussionStep,
} from '@/services/aiService'
import { useChatHistory } from './useChatHistory'
import { getAIThinkingMode, getAIConfig } from './useAIConfig'
import { useMemory } from './useMemory'
import { useToast } from './useToast'

export type { ChatMessage }

const MAX_RETRIES = 3

/**
 * 聊天功能 composable
 */
export function useChat(options: AIRequestOptions = {}) {
  const t = i18n.global.t
  const { currentSession, getOrCreateCurrentSession, updateSessionMessages, createSession } =
    useChatHistory()

  // 聊天历史（从当前会话获取）
  const chatHistory = computed({
    get: () => currentSession.value?.messages ?? [],
    set: (messages: ChatMessage[]) => {
      const session = getOrCreateCurrentSession()
      updateSessionMessages(session.id, messages)
    },
  })

  // 流式响应状态
  const currentAIResponse = ref('')
  const currentThinkingContent = ref('')
  const currentReasoningDetails = ref('')
  const currentDiscussionSteps = ref<DiscussionStep[]>([])
  const currentAssistantMessageId = ref<string | null>(null)

  // 加载/生成状态
  const isGenerating = ref(false)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const { error: toastError } = useToast()

  // 重试计数
  const retryCount = ref(0)

  // 记忆功能
  const {
    memories,
    addMemories,
    isMemoryEnabled,
    getMemoryModelOptions,
    lastError: memoryError,
  } = useMemory()
  const messageCounterSinceLastExtraction = ref(0)

  /**
   * 检查是否包含暗示需要记忆的语义关键词
   */
  function hasMemoryKeywords(history: ChatMessage[]) {
    const lastUserMsg = [...history].reverse().find((m) => m.role === 'user')
    if (!lastUserMsg) return false

    const keywords = [
      '我喜欢',
      '我不喜欢',
      '习惯',
      '偏好',
      '我的技术栈',
      '常用',
      '记住',
      '记得',
      '以后都',
      '总是',
      'i like',
      'i prefer',
      'my stack',
      'remember',
      'always',
    ]
    const content = lastUserMsg.content.toLowerCase()
    return keywords.some((k) => content.includes(k))
  }

  /**
   * 提取并存储记忆
   */
  async function extractAndStoreMemories(history: ChatMessage[]) {
    if (!isMemoryEnabled.value) return

    // 策略：
    // 1. 语义触发：如果用户提到了明显的偏好关键词，立即提取
    // 2. 周期触发：对话初期（前 10 条消息）每轮提取，之后每 2 轮提取一次
    const hasKeywords = hasMemoryKeywords(history)
    messageCounterSinceLastExtraction.value++
    const totalMessages = history.length
    const shouldExtract =
      hasKeywords || totalMessages <= 10 || messageCounterSinceLastExtraction.value >= 2

    if (!shouldExtract) return

    // 重置计数器
    messageCounterSinceLastExtraction.value = 0
    memoryError.value = null

    try {
      // 仅取最近 10 条消息作为上下文，减少 Token 消耗并提高聚焦度
      const recentHistory = history.slice(-10)
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

  /**
   * 生成 AI 图片
   */
  async function generateImage(prompt: string, images?: string[]): Promise<void> {
    if (!prompt.trim() || isGenerating.value) return

    error.value = null
    isGenerating.value = true

    // 创建用户消息
    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: prompt,
      images,
      createdAt: new Date(),
    }
    chatHistory.value = [...chatHistory.value, userMessage]

    currentAssistantMessageId.value = generateId()
    currentAIResponse.value = t('ai.generatingImage')

    try {
      const aiConfig = getAIConfig()
      const imageUrls = await getAIImageResponse(prompt, images, {
        model: aiConfig.model,
        baseUrl: aiConfig.baseUrl,
        apiKey: aiConfig.apiKey,
      })

      if (imageUrls.length > 0) {
        const aiMessage: ChatMessage = {
          id: currentAssistantMessageId.value!,
          role: 'assistant',
          content: t('ai.imageGenerated'),
          images: imageUrls,
          createdAt: new Date(),
        }
        // 直接更新 chatHistory.value 以触发持久化
        chatHistory.value = [...chatHistory.value, aiMessage]
      } else {
        throw new Error(t('ai.noImageGenerated'))
      }
    } catch (err) {
      let errorMessage = err instanceof Error ? err.message : String(err)

      // 针对生图失败的特殊引导
      if (
        errorMessage.toLowerCase().includes('modalities') ||
        errorMessage.toLowerCase().includes('not support') ||
        errorMessage.includes('400')
      ) {
        errorMessage = t('ai.noImageGenerated')
      }

      error.value = errorMessage
    } finally {
      isGenerating.value = false
      currentAssistantMessageId.value = null
    }
  }

  /**
   * 发送消息
   */
  async function sendMessage(content: string, images?: string[], isRetry = false): Promise<void> {
    if ((!content.trim() && (!images || images.length === 0)) || isGenerating.value) return

    const aiConfig = getAIConfig()

    // 绘图模式处理：如果开启了绘图模式，或者输入以指令开头
    const drawMatch = content.match(/^\s*\/(draw|image|画|生图|绘图)\s+(.+)/i)
    if (aiConfig.enableImageGeneration || drawMatch) {
      const prompt = drawMatch ? drawMatch[2].trim() : content.trim()
      return generateImage(prompt, images)
    }

    error.value = null

    // 清理上一轮的临时状态（无论是新发送还是重试）
    currentAIResponse.value = ''
    currentThinkingContent.value = ''
    currentReasoningDetails.value = ''
    currentDiscussionSteps.value = []

    if (!isRetry) {
      retryCount.value = 0
      // 创建用户消息
      const userMessage: ChatMessage = {
        id: generateId(),
        role: 'user',
        content: content.trim(),
        images: images,
        createdAt: new Date(),
      }
      // 使用 setter 触发更新逻辑（包括标题生成）
      chatHistory.value = [...chatHistory.value, userMessage]
    }

    isGenerating.value = true
    currentAssistantMessageId.value = generateId()

    try {
      const handleChunk = (chunk: string) => {
        if (chunk === '[DONE]') {
          // 流式结束，将临时内容合并为完整消息
          if (currentAIResponse.value) {
            const aiMessage: ChatMessage = {
              id: currentAssistantMessageId.value!,
              role: 'assistant',
              content: currentAIResponse.value,
              thinkingContent: currentThinkingContent.value || undefined,
              reasoning_details: currentReasoningDetails.value || undefined,
              discussionSteps:
                currentDiscussionSteps.value.length > 0
                  ? [...currentDiscussionSteps.value]
                  : undefined,
              createdAt: new Date(),
            }
            const newHistory = [...chatHistory.value, aiMessage]
            chatHistory.value = newHistory

            // 异步提取记忆
            if (isMemoryEnabled.value) {
              void extractAndStoreMemories(newHistory)
            }
          }
          currentAIResponse.value = ''
          currentThinkingContent.value = ''
          currentReasoningDetails.value = ''
          currentDiscussionSteps.value = []
          currentAssistantMessageId.value = null
          isGenerating.value = false
        } else if (chunk === '[ABORTED]') {
          // 用户中断 - 保留已生成的内容
          if (currentAIResponse.value) {
            const aiMessage: ChatMessage = {
              id: currentAssistantMessageId.value!,
              role: 'assistant',
              content: currentAIResponse.value + `\n\n*${t('ai.aborted')}*`,
              thinkingContent: currentThinkingContent.value || undefined,
              reasoning_details: currentReasoningDetails.value || undefined,
              discussionSteps:
                currentDiscussionSteps.value.length > 0
                  ? [...currentDiscussionSteps.value]
                  : undefined,
              createdAt: new Date(),
            }
            chatHistory.value = [...chatHistory.value, aiMessage]
          }
          currentAIResponse.value = ''
          currentThinkingContent.value = ''
          currentReasoningDetails.value = ''
          currentDiscussionSteps.value = []
          currentAssistantMessageId.value = null
          isGenerating.value = false
        } else {
          // 累积内容
          currentAIResponse.value += chunk
        }
      }

      if (aiConfig.discussionMode && aiConfig.discussionModelIds.length > 0) {
        await getMultiModelDiscussionStream(
          chatHistory.value,
          (steps) => {
            currentDiscussionSteps.value = steps
          },
          handleChunk,
          (thinking: string) => {
            currentThinkingContent.value += thinking
          },
          // 处理推理详情 (OpenRouter)
          (details: string) => {
            currentReasoningDetails.value += details
          },
          {
            ...options,
            thinkingMode: getAIThinkingMode(),
          },
        )
      } else {
        await getAIStreamResponse(
          chatHistory.value,
          handleChunk,
          // 处理思考过程
          (thinking: string) => {
            currentThinkingContent.value += thinking
          },
          // 处理推理详情 (OpenRouter)
          (details: string) => {
            currentReasoningDetails.value += details
          },
          {
            ...options,
            thinkingMode: getAIThinkingMode(),
          },
        )
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('ai.requestFailed')
      error.value = errorMessage

      // 自动重试
      if (retryCount.value < MAX_RETRIES) {
        retryCount.value++
        console.warn(`Retrying ${retryCount.value}/${MAX_RETRIES}...`)
        // 重试时不删除消息，而是直接再次调用
        isGenerating.value = false
        await sendMessage(content, images, true)
      } else {
        isGenerating.value = false
        currentAIResponse.value = ''
        currentThinkingContent.value = ''
        currentDiscussionSteps.value = []
        currentAssistantMessageId.value = null
      }
    }
  }

  /**
   * 停止生成
   */
  function stopGenerating(): void {
    abortCurrentRequest()
  }

  /**
   * 清空当前会话（创建新对话）
   */
  function clearHistory(): void {
    createSession()
    currentAIResponse.value = ''
    currentThinkingContent.value = ''
    error.value = null
  }

  /**
   * 删除指定消息
   */
  function deleteMessage(messageId: string): void {
    chatHistory.value = chatHistory.value.filter((msg) => msg.id !== messageId)
  }

  /**
   * 重新生成最后一条 AI 回复
   */
  async function regenerateLastResponse(): Promise<void> {
    if (isGenerating.value) return

    // 找到最后一条用户消息
    let lastUserMsgIndex = -1
    for (let i = chatHistory.value.length - 1; i >= 0; i--) {
      if (chatHistory.value[i].role === 'user') {
        lastUserMsgIndex = i
        break
      }
    }
    if (lastUserMsgIndex === -1) return

    const userContent = chatHistory.value[lastUserMsgIndex].content
    const userImages = chatHistory.value[lastUserMsgIndex].images

    // 删除最后一条用户消息及其之后的所有消息
    const newHistory = chatHistory.value.slice(0, lastUserMsgIndex)
    chatHistory.value = newHistory

    // 重新发送
    await sendMessage(userContent, userImages)
  }

  /**
   * 编辑并重新发送消息
   */
  async function editAndResendMessage(
    messageId: string,
    newContent: string,
    newImages?: string[],
  ): Promise<void> {
    if (isGenerating.value || (!newContent.trim() && (!newImages || newImages.length === 0))) return

    const index = chatHistory.value.findIndex((msg) => msg.id === messageId)
    if (index === -1) return

    // 如果没有传入新图片，则尝试保留原有的图片
    const imagesToUse = newImages !== undefined ? newImages : chatHistory.value[index].images

    // 更新消息内容并删除后续所有消息
    const newHistory = [...chatHistory.value.slice(0, index)]
    chatHistory.value = newHistory

    // 重新发送新内容
    await sendMessage(newContent, imagesToUse)
  }

  // 合并的消息列表（包含流式响应）
  const messages = computed(() => {
    const allMessages = [...chatHistory.value]

    // 如果正在生成，添加流式消息占位
    if (isGenerating.value) {
      allMessages.push({
        id: currentAssistantMessageId.value || 'streaming-response',
        role: 'assistant',
        content: currentAIResponse.value,
        thinkingContent: currentThinkingContent.value,
        discussionSteps:
          currentDiscussionSteps.value.length > 0 ? [...currentDiscussionSteps.value] : undefined,
        isStreaming: true,
      })
    }

    return allMessages
  })

  return {
    // 状态
    messages,
    chatHistory,
    currentAIResponse,
    currentThinkingContent,
    currentDiscussionSteps,
    isGenerating,
    isLoading,
    error,

    // 方法
    sendMessage,
    generateImage,
    stopGenerating,
    clearHistory,
    deleteMessage,
    regenerateLastResponse,
    editAndResendMessage,
  }
}
