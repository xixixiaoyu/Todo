/**
 * AI 服务层 - 处理流式 API 请求
 */

import { getAIConfig, getAIPresets, type AIPreset } from '@/composables/useAIConfig'
import { useTodoStore } from '@/features/todo/stores/todo'
import { useMemory } from '@/composables/useMemory'
import i18n from '@/i18n'

const t = i18n.global.t

interface ReasoningDetailItem {
  type?: string
  text?: string
  [key: string]: unknown
}

export interface DiscussionStep {
  modelId: string
  modelName: string
  content: string
  status: 'thinking' | 'done' | 'error'
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  images?: string[] // 图片 URL 或 base64
  thinkingContent?: string
  reasoning_details?: string
  discussionSteps?: DiscussionStep[]
  isStreaming?: boolean
  createdAt?: Date
}

export interface AIRequestOptions {
  model?: string
  baseUrl?: string
  apiKey?: string
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
function getHeaders(apiKeyOverride?: string): Record<string, string> {
  const { apiKey } = getAIConfig()
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKeyOverride || apiKey}`,
  }
}

/**
 * 生成唯一 ID
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 11)
}

interface MultiModalContent {
  type: 'text' | 'image_url'
  text?: string
  image_url?: {
    url: string
  }
}

/**
 * 注入系统提示和上下文信息（待办事项、记忆等）
 */
function injectSystemPrompts(
  messages: ChatMessage[],
  systemPrompt: string,
  todoAssistant: boolean,
): Array<{ role: string; content: string | MultiModalContent[] }> {
  const result: Array<{ role: string; content: string | MultiModalContent[] }> = []

  // 1. 基础系统提示词
  if (systemPrompt) {
    result.push({
      role: 'system',
      content: systemPrompt,
    })
  }

  // 2. 记忆功能：注入用户已知信息记录
  const { memories, isMemoryEnabled } = useMemory()
  if (isMemoryEnabled.value && memories.value.length > 0) {
    result.push({
      role: 'system',
      content: `[用户已知信息记录]\n${memories.value.map((m) => `- ${m}`).join('\n')}`,
    })
  }

  // 3. Todo 助手：注入未完成的 Todo 列表
  if (todoAssistant) {
    const todoStore = useTodoStore()
    const pendingTodos = todoStore.todos.filter((t) => !t.completed)
    if (pendingTodos.length > 0) {
      const todoList = pendingTodos.map((t) => `- ${t.title}`).join('\n')
      result.push({
        role: 'system',
        content: t('ai.todoAssistantPrompt', {
          count: pendingTodos.length,
          todoList,
        }),
      })
    }
  }

  result.push(
    ...messages.map((msg) => {
      // 如果有图片，使用多模态格式
      if (msg.images && msg.images.length > 0) {
        const content: MultiModalContent[] = [{ type: 'text', text: msg.content }]
        msg.images.forEach((url) => {
          content.push({
            type: 'image_url',
            image_url: { url },
          })
        })
        return {
          role: msg.role,
          content,
        }
      }
      return {
        role: msg.role,
        content: msg.content,
      }
    }),
  )

  return result
}

/**
 * 发送流式 AI 请求
 * @param messages 消息历史
 * @param onChunk 内容块回调
 * @param onThinking 思考过程回调（可选）
 * @param onReasoningDetails 推理详情回调（可选，用于 OpenRouter）
 * @param options 请求选项
 */
export async function getAIStreamResponse(
  messages: ChatMessage[],
  onChunk: (chunk: string) => void,
  onThinking?: (thinking: string) => void,
  onReasoningDetails?: (details: string) => void,
  options: AIRequestOptions = {},
): Promise<void> {
  const aiConfig = getAIConfig()
  const {
    model = aiConfig.model,
    baseUrl = aiConfig.baseUrl,
    apiKey = aiConfig.apiKey,
    temperature = aiConfig.temperature,
    systemPrompt = aiConfig.systemPrompt,
    thinkingMode = aiConfig.thinkingMode,
  } = options

  // 仅在没有活跃的 AbortController 时创建新的
  if (!abortController) {
    abortController = new AbortController()
  }
  const { signal } = abortController

  // 构建消息列表（添加系统提示和 Todo 列表）
  const messagesWithSystemPrompts = injectSystemPrompts(
    messages,
    systemPrompt,
    aiConfig.todoAssistant,
  )

  try {
    // 构建请求体
    const requestBody: Record<string, unknown> = {
      model,
      messages: messagesWithSystemPrompts,
      temperature,
      stream: true,
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
async function fetchNonStreamResponse(
  config: { baseUrl: string; apiKey: string; model: string; temperature?: number },
  messages: Array<{
    role: string
    content: string | MultiModalContent[]
    reasoning_details?: string
  }>,
  thinkingMode?: string,
  signal?: AbortSignal,
): Promise<{ content: string; reasoning_details?: string }> {
  const requestBody: Record<string, unknown> = {
    model: config.model,
    messages,
    temperature: config.temperature ?? 0.7,
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
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
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
 * 发送多模型协同讨论请求
 */
export async function getMultiModelDiscussionStream(
  messages: ChatMessage[],
  onStepUpdate: (steps: DiscussionStep[]) => void,
  onFinalChunk: (chunk: string) => void,
  onThinking?: (thinking: string) => void,
  onReasoningDetails?: (details: string) => void,
  options: AIRequestOptions = {},
): Promise<void> {
  const aiConfig = getAIConfig()
  const { discussionModelIds = [], discussionPrimaryModelId, thinkingMode } = aiConfig

  // 确保先中止之前的请求
  abortCurrentRequest()

  // 创建新的 AbortController
  abortController = new AbortController()
  const { signal } = abortController

  // 1. 获取所有参与讨论的模型配置
  const presets = getAIPresets()

  // 确定主模型配置 (强制使用选中的讨论主模型预设)
  const primaryPreset = discussionPrimaryModelId
    ? presets.find((p) => p.id === discussionPrimaryModelId)
    : null

  // 获取选中的副模型
  const selectedPresets = presets.filter((p) => {
    return discussionModelIds.includes(p.id)
  })

  // 如果没有选择主模型或副模型，回退到普通单模型请求
  if (!primaryPreset || selectedPresets.length === 0) {
    return getAIStreamResponse(messages, onFinalChunk, onThinking, onReasoningDetails, options)
  }

  const primaryConfig = {
    baseUrl: primaryPreset.baseUrl,
    apiKey: primaryPreset.apiKey,
    model: primaryPreset.model,
    temperature: primaryPreset.temperature,
  }

  const lastMsg = messages[messages.length - 1]
  const userQuery =
    lastMsg.content || (lastMsg.images?.length ? t('ai.visionQueryPlaceholder') : '')

  // 初始化步骤列表
  const steps: DiscussionStep[] = []
  steps.push(
    ...selectedPresets.map((p) => ({
      modelId: p.id,
      modelName: p.name,
      content: '',
      status: 'thinking' as const,
    })),
  )
  onStepUpdate([...steps])

  const fetchModelResponse = async (preset: AIPreset, index: number) => {
    try {
      // 副模型仅使用其自身定义的系统提示词（如果不定义则不注入），不回退到全局设置
      const modelSystemPrompt = preset.systemPrompt || ''
      const messagesForModel = injectSystemPrompts(
        messages,
        modelSystemPrompt,
        aiConfig.todoAssistant,
      )

      const response = await fetchNonStreamResponse(
        preset,
        messagesForModel,
        thinkingMode, // 思考模式统一使用全局配置
        signal,
      )
      steps[index].content = response.content
      steps[index].status = 'done'
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        steps[index].content = 'Aborted'
        steps[index].status = 'error'
        throw err
      }
      steps[index].content = err instanceof Error ? err.message : 'Generation failed'
      steps[index].status = 'error'
    } finally {
      onStepUpdate([...steps])
    }
  }

  try {
    await Promise.all(selectedPresets.map((p, i) => fetchModelResponse(p, i)))
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      onFinalChunk('[ABORTED]')
      return
    }
  }

  if (signal.aborted) {
    onFinalChunk('[ABORTED]')
    return
  }

  // 汇总结果
  const discussionSummary = steps
    .filter((s) => s.status === 'done')
    .map((s) => `【${s.modelName} 的回答】：\n${s.content}`)
    .join('\n\n')

  const synthesisPrompt = t('ai.parallelSynthesisPrompt', {
    originalQuery: userQuery,
    discussionData: discussionSummary,
  })

  const lastUserMessage = messages[messages.length - 1]
  const synthesisMessages: ChatMessage[] = [
    ...messages.slice(0, -1),
    {
      id: generateId(),
      role: 'user',
      content: synthesisPrompt,
      images: lastUserMessage.images,
    },
  ]

  return getAIStreamResponse(synthesisMessages, onFinalChunk, onThinking, onReasoningDetails, {
    ...options,
    ...primaryConfig,
  })
}

/**
 * 获取非流式 AI 响应
 */
export async function getAIStaticResponse(
  messages: Array<{
    role: string
    content: string | MultiModalContent[]
    reasoning_details?: string
  }>,
  options: AIRequestOptions = {},
): Promise<{ content: string; reasoning_details?: string }> {
  const aiConfig = getAIConfig()
  const {
    model = aiConfig.model,
    baseUrl = aiConfig.baseUrl,
    apiKey = aiConfig.apiKey,
    temperature = 0.3,
  } = options

  return fetchNonStreamResponse(
    { baseUrl, apiKey, model, temperature },
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
