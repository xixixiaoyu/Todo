import { ref, computed, watch } from 'vue'
import {
  getAIStreamResponse,
  abortCurrentRequest,
  generateId,
  type ChatMessage,
  type AIRequestOptions,
} from '@/services/aiService'

export type { ChatMessage }

const STORAGE_KEY = 'ai-chat-history'
const MAX_RETRIES = 3
const SAVE_THROTTLE_MS = 500

/**
 * 聊天功能 composable
 */
export function useChat(options: AIRequestOptions = {}) {
  // 聊天历史
  const chatHistory = ref<ChatMessage[]>([])

  // 流式响应状态
  const currentAIResponse = ref('')
  const currentThinkingContent = ref('')

  // 加载/生成状态
  const isGenerating = ref(false)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // 重试计数
  const retryCount = ref(0)

  // 节流保存定时器
  let saveTimer: ReturnType<typeof setTimeout> | null = null

  /**
   * 从 localStorage 加载聊天历史
   */
  function loadHistory(): void {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        chatHistory.value = parsed.map((msg: ChatMessage) => ({
          ...msg,
          createdAt: msg.createdAt ? new Date(msg.createdAt) : undefined,
        }))
      }
    } catch {
      console.warn('加载聊天历史失败')
    }
  }

  /**
   * 保存聊天历史到 localStorage（节流）
   */
  function saveHistory(): void {
    if (saveTimer) {
      clearTimeout(saveTimer)
    }
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(chatHistory.value))
      } catch {
        console.warn('保存聊天历史失败')
      }
    }, SAVE_THROTTLE_MS)
  }

  // 监听历史变化自动保存
  watch(
    chatHistory,
    () => {
      saveHistory()
    },
    { deep: true },
  )

  /**
   * 发送消息
   */
  async function sendMessage(content: string): Promise<void> {
    if (!content.trim() || isGenerating.value) return

    error.value = null
    retryCount.value = 0

    // 创建用户消息
    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: content.trim(),
      createdAt: new Date(),
    }

    chatHistory.value.push(userMessage)
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
              chatHistory.value.push(aiMessage)
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
                content: currentAIResponse.value + '\n\n*（已中断）*',
                thinkingContent: currentThinkingContent.value || undefined,
                createdAt: new Date(),
              }
              chatHistory.value.push(aiMessage)
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
        options,
      )
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '请求失败'
      error.value = errorMessage

      // 自动重试
      if (retryCount.value < MAX_RETRIES) {
        retryCount.value++
        console.log(`重试第 ${retryCount.value} 次...`)
        // 移除失败的用户消息，重新发送
        chatHistory.value.pop()
        await sendMessage(content)
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
   * 清空聊天历史
   */
  function clearHistory(): void {
    chatHistory.value = []
    currentAIResponse.value = ''
    currentThinkingContent.value = ''
    error.value = null
    localStorage.removeItem(STORAGE_KEY)
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

    // 删除最后一条用户消息之后的所有 AI 消息
    chatHistory.value = chatHistory.value.slice(0, lastUserMsgIndex)

    // 重新发送
    await sendMessage(userContent)
  }

  // 合并的消息列表（包含流式响应）
  const messages = computed(() => {
    const allMessages = [...chatHistory.value]

    // 如果有正在生成的内容，添加流式消息
    if (currentAIResponse.value || currentThinkingContent.value) {
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

  // 初始化加载历史
  loadHistory()

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
    loadHistory,
  }
}
