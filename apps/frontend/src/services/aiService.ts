/**
 * AI 服务层 - 处理流式 API 请求
 */

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
}

// 当前请求的 AbortController
let abortController: AbortController | null = null

/**
 * 获取 API 配置
 * TODO: 后续可以从环境变量或配置中心获取
 */
function getApiConfig() {
  return {
    apiUrl: import.meta.env.VITE_AI_API_URL || 'https://api.deepseek.com/chat/completions',
    apiKey: import.meta.env.VITE_AI_API_KEY || '',
    defaultModel: import.meta.env.VITE_AI_MODEL || 'deepseek-chat',
  }
}

/**
 * 构建请求头
 */
function getHeaders(): Record<string, string> {
  const { apiKey } = getApiConfig()
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
  const { apiUrl, defaultModel } = getApiConfig()
  const { model = defaultModel, temperature = 0.7, systemPrompt } = options

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

  messagesWithSystemPrompts.push(
    ...messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    })),
  )

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        model,
        messages: messagesWithSystemPrompts,
        temperature,
        stream: true,
      }),
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
