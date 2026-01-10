/**
 * AI 服务层 - 处理流式 API 请求
 */

import { getAIConfig } from '@/composables/useAIConfig'
import { useTodoStore } from '@/features/todo/stores/todo'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  thinkingContent?: string
  isStreaming?: boolean
  createdAt?: Date
}

export interface AIRequestOptions {
  model?: string
  temperature?: number
  maxTokens?: number
  systemPrompt?: string
  thinkingMode?: 'enabled' | 'disabled'
}

// 当前请求的 AbortController
let abortController: AbortController | null = null

/**
 * 构建完整的 API URL
 */
function buildApiUrl(baseUrl: string): string {
  const base = baseUrl.replace(/\/+$/, '') // 移除末尾斜杠
  return `${base}/chat/completions`
}

/**
 * 构建请求头
 */
function getHeaders(): Record<string, string> {
  const { apiKey } = getAIConfig()
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  }
}

/**
 * 生成唯一 ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

/**
 * 发送流式 AI 请求
 * @param messages 消息历史
 * @param onChunk 内容块回调
 * @param onThinking 思考过程回调（可选）
 * @param options 请求选项
 */
export async function getAIStreamResponse(
  messages: ChatMessage[],
  onChunk: (chunk: string) => void,
  onThinking?: (thinking: string) => void,
  options: AIRequestOptions = {},
): Promise<void> {
  const aiConfig = getAIConfig()
  const {
    model = aiConfig.model,
    temperature = aiConfig.temperature,
    systemPrompt = aiConfig.systemPrompt,
    thinkingMode = aiConfig.thinkingMode,
  } = options

  // 创建新的 AbortController
  abortController = new AbortController()
  const { signal } = abortController

  // 构建消息列表（添加系统提示）
  const messagesWithSystemPrompts: Array<{ role: string; content: string }> = []

  if (systemPrompt) {
    messagesWithSystemPrompts.push({
      role: 'system',
      content: systemPrompt,
    })
  }

  // Todo 助手：注入未完成的 Todo 列表
  if (aiConfig.todoAssistant) {
    const todoStore = useTodoStore()
    const pendingTodos = todoStore.todos.filter((t) => !t.completed)
    if (pendingTodos.length > 0) {
      const todoList = pendingTodos.map((t) => `- ${t.title}`).join('\n')
      messagesWithSystemPrompts.push({
        role: 'system',
        content: `用户当前有 ${pendingTodos.length} 个未完成的待办事项：\n${todoList}`,
      })
    }
  }

  messagesWithSystemPrompts.push(
    ...messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    })),
  )

  try {
    // 构建请求体
    const requestBody: Record<string, unknown> = {
      model,
      messages: messagesWithSystemPrompts,
      temperature,
      stream: true,
      thinking: {
        type: thinkingMode,
      },
    }

    const response = await fetch(buildApiUrl(aiConfig.baseUrl), {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(requestBody),
      signal,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API 请求失败: ${response.status} - ${errorText}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('无法获取响应流')
    }

    const textDecoder = new TextDecoder()
    let buffer = ''
    let isReading = true

    while (isReading) {
      const { done, value } = await reader.read()

      if (done) {
        isReading = false
        break
      }

      buffer += textDecoder.decode(value, { stream: true })

      // 按行分割处理 SSE 数据
      const lines = buffer.split(/\r?\n/)
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.startsWith('data:')) continue

        const payload = line.substring(5).trim()

        // 流结束标志
        if (payload === '[DONE]') {
          onChunk('[DONE]')
          return
        }

        try {
          const parsedData = JSON.parse(payload)
          const delta = parsedData.choices?.[0]?.delta

          // 处理正文内容
          const content = delta?.content
          if (content) {
            onChunk(content)
          }

          // 处理思考过程（如 DeepSeek-R1 模型）
          const reasoningContent = delta?.reasoning_content
          if (reasoningContent && onThinking) {
            onThinking(reasoningContent)
          }
        } catch {
          // 解析失败，跳过该行
          continue
        }
      }
    }

    // 如果正常结束但没有收到 [DONE]
    onChunk('[DONE]')
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      onChunk('[ABORTED]')
      return
    }
    throw error
  } finally {
    abortController = null
  }
}

/**
 * 中断当前请求
 */
export function abortCurrentRequest(): void {
  if (abortController) {
    abortController.abort()
    abortController = null
  }
}

/**
 * 检查是否有正在进行的请求
 */
export function isRequestInProgress(): boolean {
  return abortController !== null
}
