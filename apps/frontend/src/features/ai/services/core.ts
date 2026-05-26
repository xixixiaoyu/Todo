/**
 * AI 服务核心请求逻辑
 */

import { getAIConfig, getAIPresets } from '@/features/ai/composables/useAIConfig'
import i18n from '@/i18n'
import type {
  ChatMessage,
  AIRequestOptions,
  ReasoningDetailItem,
  ToolCall,
  AIChatCompletionMessage,
} from './types'
import { buildApiUrl, getHeaders, injectSystemPrompts, sanitizeRequestMessages } from './utils'
import { prepareVisionContext, resolveVisionConfig } from './visionBridge'

const t = i18n.global.t

// 每会话独立的 AbortController
const sessionControllers = new Map<string, AbortController>()
// 兼容旧 API：全局 controller（abortCurrentRequest 会清空所有）
let globalController: AbortController | null = null

// ---------- <tool_call> XML 文本过滤 ----------
// 部分模型（如 GLM）会在 delta.content 中输出文本形式的工具调用标记，
// 需要在流式渲染前过滤掉，避免用户看到原始 XML。
// 同时支持从 XML 解析工具调用，作为不支持原生 function calling 模型的 fallback。

interface ParsedXmlToolCall {
  name: string
  arguments: Record<string, string>
}

function parseXmlToolCallContent(inner: string): ParsedXmlToolCall | null {
  const firstTagIdx = inner.indexOf('<arg_key>')
  if (firstTagIdx === -1) return null

  const name = inner.slice(0, firstTagIdx).trim()
  if (!name) return null

  const args: Record<string, string> = {}
  const kvRegex = /<arg_key>(.*?)<\/arg_key>\s*<arg_value>(.*?)<\/arg_value>/g
  let kvMatch: RegExpExecArray | null

  while ((kvMatch = kvRegex.exec(inner)) !== null) {
    const key = kvMatch[1].trim()
    if (key) {
      args[key] = kvMatch[2].trim()
    }
  }

  return { name, arguments: args }
}

const MAX_XML_BUFFER = 8192

function filterAndParseXmlToolCalls(
  chunk: string,
  buffer: { value: string },
): { cleanText: string; toolCalls: ParsedXmlToolCall[] } {
  // 防止未闭合的 <tool_call> 标签导致缓冲区无限增长
  if (buffer.value.length > MAX_XML_BUFFER) {
    const flushed = buffer.value
    buffer.value = ''
    return { cleanText: flushed + chunk, toolCalls: [] }
  }

  const combined = buffer.value + chunk
  buffer.value = ''

  const toolCalls: ParsedXmlToolCall[] = []
  let cleanText = ''
  let lastIndex = 0

  const blockRegex = /<tool_call>([\s\S]*?)<\/tool_call>/g
  let match: RegExpExecArray | null

  while ((match = blockRegex.exec(combined)) !== null) {
    cleanText += combined.slice(lastIndex, match.index)
    lastIndex = blockRegex.lastIndex

    const parsed = parseXmlToolCallContent(match[1])
    if (parsed) {
      toolCalls.push(parsed)
    }
  }

  const remaining = combined.slice(lastIndex)
  const openTagIdx = remaining.lastIndexOf('<tool_call>')

  if (openTagIdx !== -1) {
    cleanText += remaining.slice(0, openTagIdx)
    buffer.value = remaining.slice(openTagIdx)
  } else {
    cleanText += remaining
  }

  return { cleanText, toolCalls }
}

function flushXmlToolCallBuffer(buffer: { value: string }): string {
  const flushed = buffer.value.replace(/<tool_call>[\s\S]*$/, '')
  buffer.value = ''
  return flushed
}

function emitXmlFallbackToolCalls(
  toolCallsMap: Map<number, ToolCall>,
  parsedXmlToolCalls: ParsedXmlToolCall[],
  onToolCall?: (toolCall: ToolCall) => void,
): void {
  if (toolCallsMap.size > 0 || parsedXmlToolCalls.length === 0 || !onToolCall) return

  let fallbackId = 0
  for (const xmlCall of parsedXmlToolCalls) {
    onToolCall({
      id: `xml_fallback_${fallbackId++}`,
      type: 'function',
      function: {
        name: xmlCall.name,
        arguments: JSON.stringify(xmlCall.arguments),
      },
    })
  }
}

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
  if (!globalController) {
    globalController = new AbortController()
  }
  return globalController.signal
}

export function getSessionAbortSignal(sessionId: string): AbortSignal {
  let entry = sessionControllers.get(sessionId)
  if (!entry) {
    entry = new AbortController()
    sessionControllers.set(sessionId, entry)
  }
  return entry.signal
}

export function resetAbortSignal(): AbortSignal {
  abortCurrentRequest()
  globalController = new AbortController()
  return globalController.signal
}

export function resetSessionAbortSignal(sessionId: string): AbortSignal {
  abortSessionRequest(sessionId)
  const ctrl = new AbortController()
  sessionControllers.set(sessionId, ctrl)
  return ctrl.signal
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

  // 视觉辅助：已启用且消息含图片时，用视觉模型分析并替换为文本描述
  let processedMessages = messages
  if (aiConfig.visionEnabled && aiConfig.visionPresetId) {
    const visionConfig = resolveVisionConfig(aiConfig.visionPresetId, getAIPresets())
    if (visionConfig) {
      processedMessages = await prepareVisionContext(messages, visionConfig)
    }
  }

  // 构建消息列表（添加系统提示和 Todo 列表）
  const messagesWithSystemPrompts = injectSystemPrompts(
    processedMessages,
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
    options.agentWorkspacePath,
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

    // 推理参数：根据思考级别映射 API 参数
    const effectiveLevel = thinkingMode || 'auto'

    // thinking 开关：off 显式禁用，其余启用
    requestBody.thinking = { type: effectiveLevel === 'off' ? 'disabled' : 'enabled' }

    // reasoning.effort / reasoning_effort 仅在显式指定强度时发送
    if (effectiveLevel === 'high' || effectiveLevel === 'xhigh') {
      requestBody.reasoning_effort = effectiveLevel
      requestBody.reasoning = { effort: effectiveLevel }
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

    // <tool_call> XML 文本过滤缓冲区（跨 chunk 拼接）
    const xmlToolCallBuffer = { value: '' }
    // 从 XML 文本中解析出的工具调用（作为 fallback）
    const parsedXmlToolCalls: ParsedXmlToolCall[] = []

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
        // 刷新缓冲区中残留的 <tool_call> XML 文本
        const flushed = flushXmlToolCallBuffer(xmlToolCallBuffer)
        if (flushed) {
          onChunk(flushed)
        }
        // 如果没有结构化的 tool_calls 但解析到了 XML 格式的，作为 fallback 触发
        emitXmlFallbackToolCalls(toolCallsMap, parsedXmlToolCalls, onToolCall)
        onChunk('[DONE]')
        doneReceived = true
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

          // 处理正文内容（过滤 <tool_call> XML 文本）
          const content = delta?.content
          if (content) {
            const { cleanText, toolCalls: xmlCalls } = filterAndParseXmlToolCalls(
              content,
              xmlToolCallBuffer,
            )
            for (const xmlCall of xmlCalls) {
              parsedXmlToolCalls.push(xmlCall)
            }
            if (cleanText) {
              onChunk(cleanText)
            }
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
              if (call.function?.arguments) {
                const raw = call.function.arguments
                const argStr = typeof raw === 'string' ? raw : JSON.stringify(raw)
                existingCall.function.arguments += argStr
              }
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
      // 刷新残留的 <tool_call> XML 文本
      const flushed = flushXmlToolCallBuffer(xmlToolCallBuffer)
      if (flushed) {
        onChunk(flushed)
      }
      // XML fallback：没有结构化 tool_calls 但有 XML 解析结果
      emitXmlFallbackToolCalls(toolCallsMap, parsedXmlToolCalls, onToolCall)
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
    if (!usesExternalSignal && globalController?.signal === signal) {
      globalController = null
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

  if (thinkingMode) {
    requestBody.thinking = { type: thinkingMode === 'off' ? 'disabled' : 'enabled' }

    if (thinkingMode === 'high' || thinkingMode === 'xhigh') {
      requestBody.reasoning_effort = thinkingMode
      requestBody.reasoning = { effort: thinkingMode }
    }
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
  if (globalController) {
    globalController.abort()
    globalController = null
  }
  for (const [, ctrl] of sessionControllers) {
    ctrl.abort()
  }
  sessionControllers.clear()
}

export function abortSessionRequest(sessionId: string): void {
  const ctrl = sessionControllers.get(sessionId)
  if (ctrl) {
    ctrl.abort()
    sessionControllers.delete(sessionId)
  }
}

export function isRequestInProgress(): boolean {
  return globalController !== null || sessionControllers.size > 0
}
