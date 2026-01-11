import { ref, computed } from 'vue'
import i18n from '@/i18n'
import {
  getAIStreamResponse,
  getMultiModelDiscussionStream,
  getAIStaticResponse,
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

const { t } = i18n.global

/**
 * 聊天功能 composable
 */
export function useChat(options: AIRequestOptions = {}) {
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
    addMemories,
    isMemoryEnabled,
    getMemoryModelOptions,
    lastError: memoryError,
  } = useMemory()
  const messageCounterSinceLastExtraction = ref(0)

  /**
   * 提取并存储记忆
   */
  async function extractAndStoreMemories(history: ChatMessage[]) {
    if (!isMemoryEnabled.value) return

    // 策略：每 3 轮对话（6 条消息）提取一次，或者在会话刚开始的前 2 轮提取
    messageCounterSinceLastExtraction.value++
    const totalMessages = history.length
    const shouldExtract = totalMessages <= 4 || messageCounterSinceLastExtraction.value >= 3

    if (!shouldExtract) return

    // 重置计数器
    messageCounterSinceLastExtraction.value = 0
    memoryError.value = null

    // 提取最后几轮对话作为上下文（最多 3 轮）
    const lastMessages = history.slice(-6)
    if (lastMessages.length < 2) return

    const prompt = `你是一个记忆提取专家。请从以下对话片段中提取关于用户的关键偏好、技术栈、背景信息或习惯。
规则：
1. 以 JSON 数组格式返回（如 ["用户偏好使用 TypeScript", "用户正在开发一个 Todo 应用"]）。
2. 只提取事实，不要解释。
3. 如果没有发现任何有价值的新信息，请返回空数组 []。
4. 提取的信息应简洁有力，每条不超过 20 字。
5. 必须只返回 JSON，不要包含 Markdown 代码块。

对话片段：
${lastMessages.map((m) => `${m.role === 'user' ? '用户' : '助手'}: ${m.content}`).join('\n')}`

    try {
      const options = getMemoryModelOptions()
      const result = await getAIStaticResponse([{ role: 'user', content: prompt }], options)

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
   * 发送消息
   */
  async function sendMessage(content: string, isRetry = false): Promise<void> {
    if (!content.trim() || isGenerating.value) return

    error.value = null

    // 清理上一轮的临时状态（无论是新发送还是重试）
    currentAIResponse.value = ''
    currentThinkingContent.value = ''
    currentDiscussionSteps.value = []

    if (!isRetry) {
      retryCount.value = 0
      // 创建用户消息
      const userMessage: ChatMessage = {
        id: generateId(),
        role: 'user',
        content: content.trim(),
        createdAt: new Date(),
      }
      // 使用 setter 触发更新逻辑（包括标题生成）
      chatHistory.value = [...chatHistory.value, userMessage]
    }

    isGenerating.value = true
    currentAssistantMessageId.value = generateId()
    const aiConfig = getAIConfig()

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
        await sendMessage(content, true)
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

    // 删除最后一条用户消息及其之后的所有消息
    const newHistory = chatHistory.value.slice(0, lastUserMsgIndex)
    chatHistory.value = newHistory

    // 重新发送
    await sendMessage(userContent)
  }

  /**
   * 编辑并重新发送消息
   */
  async function editAndResendMessage(messageId: string, newContent: string): Promise<void> {
    if (isGenerating.value || !newContent.trim()) return

    const index = chatHistory.value.findIndex((msg) => msg.id === messageId)
    if (index === -1) return

    // 更新消息内容并删除后续所有消息
    const newHistory = [...chatHistory.value.slice(0, index)]
    chatHistory.value = newHistory

    // 重新发送新内容
    await sendMessage(newContent)
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
    stopGenerating,
    clearHistory,
    deleteMessage,
    regenerateLastResponse,
    editAndResendMessage,
  }
}
