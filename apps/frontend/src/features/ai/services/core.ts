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
import { buildApiUrl, getHeaders, injectSystemPrompts, sanitizeRequestMessages } from './utils'

const t = i18n.global.t

// 当前请求的 AbortController
let abortController: AbortController | null = null

function asReasoningText(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }

  if (Array.isArray(value)) {
    return value.map((item) => asReasoningText(item)).join('')
  }

  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const text =
      asReasoningText(obj.text) || asReasoningText(obj.output_text) || asReasoningText(obj.content)
    if (text) {
      return text
    }
    return asReasoningText(obj.summary)
  }

  return ''
}

function normalizeReasoningDetails(reasoning: unknown): string | undefined {
  if (typeof reasoning === 'string') {
    return reasoning
  }

  if (Array.isArray(reasoning)) {
    const items = reasoning as ReasoningDetailItem[]
    const detailText = items
      .filter(
        (item) => item.type === 'reasoning.text' || item.text || item.content || item.output_text,
      )
      .map((item) => asReasoningText(item.text ?? item.content ?? item.output_text))
      .join('')

    if (detailText) {
      return detailText
    }

    const summaryText = items
      .filter((item) => item.type === 'reasoning.summary' || item.summary)
      .map((item) => asReasoningText(item.summary))
      .join('')

    return summaryText || undefined
  }

  if (reasoning && typeof reasoning === 'object') {
    const obj = reasoning as Record<string, unknown>
    const text =
      asReasoningText(obj.text) || asReasoningText(obj.output_text) || asReasoningText(obj.content)
    if (text) {
      return text
    }
    const summary = asReasoningText(obj.summary)
    return summary || undefined
  }

  return undefined
}

function resolveReasoningDetails(...candidates: unknown[]): string | undefined {
  for (const candidate of candidates) {
    const normalized = normalizeReasoningDetails(candidate)
    if (normalized) {
      return normalized
    }
  }
  return undefined
}

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
    assistantMode = aiConfig.assistantMode,
    thinkingMode = aiConfig.thinkingMode,
    thinkingEffort = aiConfig.thinkingEffort,
    contextSummary,
    memorySnapshot,
    skills,
    activeSkills,
    skillRuntimeAvailability,
    tools,
    toolChoice,
    abortSignal,
  } = options

  const usesExternalSignal = !!abortSignal
  const signal = abortSignal || getAbortSignal()

  // 构建消息列表（添加系统提示和 Todo 列表）
  const messagesWithSystemPrompts = injectSystemPrompts(
    messages,
    systemPrompt,
    aiConfig.todoAssistant,
    assistantMode,
    contextSummary,
    memorySnapshot,
    skills,
    activeSkills,
    skillRuntimeAvailability,
    aiConfig.novelGenre,
    aiConfig.novelTone,
    aiConfig.novelProtagonistHint,
    options.agentToolsEnabled,
  )
  const sanitizedMessages = sanitizeRequestMessages(messagesWithSystemPrompts)

  try {
    // 构建请求体
    const requestBody: Record<string, unknown> = {
      model,
      messages: sanitizedMessages,
      temperature,
      top_p,
      stream: true,
    }

    // 添加工具配置
    if (tools && tools.length > 0) {
      requestBody.tools = tools
      requestBody.tool_choice = toolChoice || 'auto'
    }

    // 推理参数：DeepSeek 原生 reasoning_effort（顶层）+ OpenRouter reasoning（兼容）
    if (thinkingMode === 'enabled') {
      requestBody.reasoning_effort = options.thinkingEffort || thinkingEffort || 'high'
      requestBody.reasoning = {
        enabled: true,
        effort: options.thinkingEffort || thinkingEffort || 'high',
      }
    }

    // DeepSeek 模型的 thinking 参数（仅在启用时发送）
    if (thinkingMode === 'enabled') {
      requestBody.thinking = { type: 'enabled' }
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

          const reasoningDetails = resolveReasoningDetails(
            delta?.reasoning_details,
            delta?.reasoning,
            parsedData.choices?.[0]?.message?.reasoning_details,
            parsedData.choices?.[0]?.message?.reasoning,
          )

          if (reasoningDetails && onReasoningDetails) {
            onReasoningDetails(reasoningDetails)
          }

          const reasoningContent = delta?.reasoning_content
          if (!reasoningDetails && reasoningContent && onThinking) {
            onThinking(reasoningContent)
          }
        } catch {
          console.warn('Failed to parse AI stream chunk')
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
    if (!usesExternalSignal && abortController?.signal === signal) {
      abortController = null
    }
  }
}

/**
 * 发送非流式 AI 请求的通用工具函数
 */
export async function fetchNonStreamResponse(
  config: {
    baseUrl: string
    apiKey: string
    model: string
    temperature?: number
    top_p?: number
    thinkingEffort?: 'high' | 'max'
  },
  messages: AIChatCompletionMessage[],
  thinkingMode?: string,
  signal?: AbortSignal,
): Promise<{ content: string; reasoning_details?: string }> {
  const sanitizedMessages = sanitizeRequestMessages(messages)
  const requestBody: Record<string, unknown> = {
    model: config.model,
    messages: sanitizedMessages,
    temperature: config.temperature ?? 0.6,
    top_p: config.top_p ?? 0.95,
    stream: false,
  }

  if (thinkingMode === 'enabled') {
    requestBody.reasoning_effort = config.thinkingEffort || 'high'
    requestBody.reasoning = {
      enabled: true,
      effort: config.thinkingEffort || 'high',
    }
  }

  // DeepSeek 模型的 thinking 参数（仅在启用时发送）
  if (thinkingMode === 'enabled') {
    requestBody.thinking = { type: 'enabled' }
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

  const reasoning = resolveReasoningDetails(
    message?.reasoning_details,
    message?.reasoning,
    message?.reasoning_content,
  )

  return {
    content: message?.content || '',
    reasoning_details: reasoning,
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
    temperature = aiConfig.temperature,
    top_p = 0.95,
    thinkingEffort = aiConfig.thinkingEffort,
  } = options

  return fetchNonStreamResponse(
    { baseUrl, apiKey, model, temperature, top_p, thinkingEffort },
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
