/**
 * AI 服务核心请求逻辑
 */

import { getAIConfig } from '@/features/ai/composables/useAIConfig'
import i18n from '@/i18n'
import type {
  ChatMessage,
  AIRequestOptions,
  ReasoningDetailItem,
  ToolCall,
  AIChatCompletionMessage,
} from './types'
import { buildApiUrl, getHeaders, injectSystemPrompts } from './utils'

const t = i18n.global.t

// 当前请求的 AbortController
let abortController: AbortController | null = null

/**
 * 获取当前请求的 AbortSignal，如果没有则创建新的
 */
export function getAbortSignal(): AbortSignal {
  if (!abortController) {
    abortController = new AbortController()
  }
  return abortController.signal
}

/**
 * 重置并获取新的 AbortSignal
 */
export function resetAbortSignal(): AbortSignal {
  abortCurrentRequest()
  abortController = new AbortController()
  return abortController.signal
}

/**
 * 发送流式 AI 请求
 */
export async function getAIStreamResponse(
  messages: ChatMessage[],
  onChunk: (chunk: string) => void,
  onThinking?: (thinking: string) => void,
  onReasoningDetails?: (details: string) => void,
  options: AIRequestOptions = {},
  onToolCall?: (toolCall: ToolCall) => void,
): Promise<void> {
  const aiConfig = getAIConfig()
  const {
    model = aiConfig.model,
    baseUrl = aiConfig.baseUrl,
    apiKey = aiConfig.apiKey,
    temperature = aiConfig.temperature,
    top_p = 0.95,
    systemPrompt = aiConfig.systemPrompt,
    thinkingMode = aiConfig.thinkingMode,
    contextSummary,
    tools,
    toolChoice,
  } = options

  const signal = getAbortSignal()

  // 构建消息列表（添加系统提示和 Todo 列表）
  const messagesWithSystemPrompts = injectSystemPrompts(
    messages,
    systemPrompt,
    aiConfig.todoAssistant,
    contextSummary,
  )

  try {
    // 构建请求体
    const requestBody: Record<string, unknown> = {
      model,
      messages: messagesWithSystemPrompts,
      temperature,
      top_p,
      stream: true,
    }

    // 添加工具配置
    if (tools && tools.length > 0) {
      requestBody.tools = tools
      requestBody.tool_choice = toolChoice || 'auto'
    }

    // 适配 OpenRouter 的推理参数
    if (thinkingMode === 'enabled') {
      requestBody.reasoning = { enabled: true }
    }

    // 兼容 DeepSeek 等模型的 thinking 参数
    requestBody.thinking = {
      type: thinkingMode,
    }

    const response = await fetch(buildApiUrl(baseUrl), {
      method: 'POST',
      headers: getHeaders(apiKey),
      body: JSON.stringify(requestBody),
      signal,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(
        t('ai.apiError', {
          status: response.status,
          error: errorText,
        }),
      )
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error(t('ai.noStream'))
    }

    const textDecoder = new TextDecoder()
    let buffer = ''
    let isReading = true
    let doneReceived = false

    // 累积 tool_calls
    const toolCallsMap = new Map<number, ToolCall>()

    /**
     * 处理单行数据的辅助函数
     */
    const processPayload = (payload: string) => {
      const trimmed = payload.trim()
      if (!trimmed) return

      let data = trimmed
      if (trimmed.startsWith('data:')) {
        data = trimmed.substring(5).trim()
      }

      // 流结束标志
      if (data === '[DONE]') {
        onChunk('[DONE]')
        doneReceived = true
        // 如果有工具调用且未完成，触发回调
        for (const toolCall of toolCallsMap.values()) {
          if (onToolCall) onToolCall(toolCall)
        }
        return
      }

      // 尝试解析 JSON
      if (data.startsWith('{')) {
        try {
          const parsedData = JSON.parse(data)
          const delta = parsedData.choices?.[0]?.delta

          // 处理正文内容
          const content = delta?.content
          if (content) {
            onChunk(content)
          }

          // 处理工具调用 (Tool Calls)
          const tool_calls = delta?.tool_calls
          if (tool_calls && Array.isArray(tool_calls)) {
            for (const call of tool_calls) {
              const index = call.index
              if (!toolCallsMap.has(index)) {
                toolCallsMap.set(index, {
                  id: call.id || '',
                  type: 'function',
                  function: { name: call.function?.name || '', arguments: '' },
                })
              }
              const existingCall = toolCallsMap.get(index)!
              if (call.id) existingCall.id = call.id
              if (call.function?.name) existingCall.function.name = call.function.name
              if (call.function?.arguments)
                existingCall.function.arguments += call.function.arguments
            }
          }

          // 处理思考过程（如 DeepSeek-R1 模型）
          const reasoningContent = delta?.reasoning_content
          if (reasoningContent && onThinking) {
            onThinking(reasoningContent)
          }

          // 处理 OpenRouter 的 reasoning_details (支持字符串或数组)
          let reasoningDetails =
            delta?.reasoning_details ||
            delta?.reasoning ||
            parsedData.choices?.[0]?.message?.reasoning_details ||
            parsedData.choices?.[0]?.message?.reasoning

          // 如果是数组格式（例如 Gemini 模型的响应），提取其中的 text 部分
          if (Array.isArray(reasoningDetails)) {
            reasoningDetails = (reasoningDetails as ReasoningDetailItem[])
              .filter((item) => item.type === 'reasoning.text' || item.text)
              .map((item) => item.text || '')
              .join('')
          }

          if (reasoningDetails && onReasoningDetails) {
            onReasoningDetails(reasoningDetails)
          }
        } catch (e) {
          console.warn('Failed to parse AI stream chunk:', e, data)
        }
      }
    }

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
        processPayload(line)
      }
    }

    // 处理最后剩余的 buffer
    if (buffer.trim()) {
      processPayload(buffer)
    }

    // 如果正常结束但没有收到 [DONE]
    if (!doneReceived) {
      onChunk('[DONE]')
      for (const toolCall of toolCallsMap.values()) {
        if (onToolCall) onToolCall(toolCall)
      }
    }
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
 * 发送非流式 AI 请求的通用工具函数
 */
export async function fetchNonStreamResponse(
  config: { baseUrl: string; apiKey: string; model: string; temperature?: number; top_p?: number },
  messages: AIChatCompletionMessage[],
  thinkingMode?: string,
  signal?: AbortSignal,
): Promise<{ content: string; reasoning_details?: string }> {
  const requestBody: Record<string, unknown> = {
    model: config.model,
    messages,
    temperature: config.temperature ?? 0.7,
    top_p: config.top_p ?? 0.95,
    stream: false,
  }

  if (thinkingMode === 'enabled') {
    requestBody.reasoning = { enabled: true }
  }

  if (thinkingMode) {
    requestBody.thinking = { type: thinkingMode }
  }

  const response = await fetch(buildApiUrl(config.baseUrl), {
    method: 'POST',
    headers: getHeaders(config.apiKey),
    body: JSON.stringify(requestBody),
    signal,
  })

  if (!response.ok) {
    throw new Error(`AI API Error: ${response.status} ${await response.text()}`)
  }

  const data = await response.json()
  const message = data.choices[0]?.message

  // 归一化提取思考内容
  let reasoning = message?.reasoning_details || message?.reasoning || message?.reasoning_content

  // 如果是数组格式（部分 provider 的格式），提取其中的 text 部分
  if (Array.isArray(reasoning)) {
    reasoning = (reasoning as ReasoningDetailItem[])
      .filter((item) => item.type === 'reasoning.text' || item.text)
      .map((item) => item.text || '')
      .join('')
  }

  return {
    content: message?.content || '',
    reasoning_details: typeof reasoning === 'string' ? reasoning : undefined,
  }
}

/**
 * 获取非流式 AI 响应
 */
export async function getAIStaticResponse(
  messages: AIChatCompletionMessage[],
  options: AIRequestOptions = {},
): Promise<{ content: string; reasoning_details?: string }> {
  const aiConfig = getAIConfig()
  const {
    model = aiConfig.model,
    baseUrl = aiConfig.baseUrl,
    apiKey = aiConfig.apiKey,
    temperature = 0.3,
    top_p = 0.95,
  } = options

  return fetchNonStreamResponse(
    { baseUrl, apiKey, model, temperature, top_p },
    messages,
    aiConfig.thinkingMode,
  )
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
