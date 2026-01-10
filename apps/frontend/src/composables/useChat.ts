import { ref, computed } from 'vue'
import i18n from '@/i18n'
import {
  getAIStreamResponse,
  abortCurrentRequest,
  generateId,
  type ChatMessage,
  type AIRequestOptions,
} from '@/services/aiService'
import { useChatHistory } from './useChatHistory'
import { getAIThinkingMode } from './useAIConfig'

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

  // 加载/生成状态
  const isGenerating = ref(false)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // 重试计数
  const retryCount = ref(0)

  /**
   * 发送消息
   */
  async function sendMessage(content: string, isRetry = false): Promise<void> {
    if (!content.trim() || isGenerating.value) return

    error.value = null
    if (!isRetry) {
      retryCount.value = 0
    }

    // 创建用户消息
    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: content.trim(),
      createdAt: new Date(),
    }

    // 使用 setter 触发更新逻辑（包括标题生成）
    chatHistory.value = [...chatHistory.value, userMessage]
    isGenerating.value = true

    try {
      await getAIStreamResponse(
        chatHistory.value,
        // 处理内容块
        (chunk: string) => {
          if (chunk === '[DONE]') {
            // 流式结束，将临时内容合并为完整消息
            if (currentAIResponse.value) {
              const aiMessage: ChatMessage = {
                id: generateId(),
                role: 'assistant',
                content: currentAIResponse.value,
                thinkingContent: currentThinkingContent.value || undefined,
                createdAt: new Date(),
              }
              chatHistory.value = [...chatHistory.value, aiMessage]
            }
            currentAIResponse.value = ''
            currentThinkingContent.value = ''
            isGenerating.value = false
          } else if (chunk === '[ABORTED]') {
            // 用户中断 - 保留已生成的内容
            if (currentAIResponse.value) {
              const aiMessage: ChatMessage = {
                id: generateId(),
                role: 'assistant',
                content: currentAIResponse.value + `\n\n*${t('ai.aborted')}*`,
                thinkingContent: currentThinkingContent.value || undefined,
                createdAt: new Date(),
              }
              chatHistory.value = [...chatHistory.value, aiMessage]
            }
            currentAIResponse.value = ''
            currentThinkingContent.value = ''
            isGenerating.value = false
          } else {
            // 累积内容
            currentAIResponse.value += chunk
          }
        },
        // 处理思考过程
        (thinking: string) => {
          currentThinkingContent.value += thinking
        },
        {
          ...options,
          thinkingMode: getAIThinkingMode(),
        },
      )
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('ai.requestFailed')
      error.value = errorMessage

      // 自动重试
      if (retryCount.value < MAX_RETRIES) {
        retryCount.value++
        console.warn(`Retrying ${retryCount.value}/${MAX_RETRIES}...`)
        // 移除失败的用户消息，允许重新发送
        chatHistory.value.pop()
        isGenerating.value = false
        await sendMessage(content, true)
      } else {
        isGenerating.value = false
        currentAIResponse.value = ''
        currentThinkingContent.value = ''
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
    const index = chatHistory.value.findIndex((msg) => msg.id === messageId)
    if (index !== -1) {
      chatHistory.value.splice(index, 1)
    }
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

  // 合并的消息列表（包含流式响应）
  const messages = computed(() => {
    const allMessages = [...chatHistory.value]

    // 如果正在生成，添加流式消息占位
    if (isGenerating.value) {
      allMessages.push({
        id: 'streaming-response',
        role: 'assistant',
        content: currentAIResponse.value,
        thinkingContent: currentThinkingContent.value,
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
    isGenerating,
    isLoading,
    error,

    // 方法
    sendMessage,
    stopGenerating,
    clearHistory,
    deleteMessage,
    regenerateLastResponse,
  }
}
