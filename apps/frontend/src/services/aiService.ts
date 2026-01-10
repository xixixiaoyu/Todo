/**
 * AI 服务层 - 处理流式 API 请求
 */

import { getAIConfig } from '@/composables/useAIConfig'
import { useTodoStore } from '@/features/todo/stores/todo'
import i18n from '@/i18n'

const { t } = i18n.global

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
  thinkingContent?: string
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
    baseUrl = aiConfig.baseUrl,
    apiKey = aiConfig.apiKey,
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
        content: t('ai.todoAssistantPrompt', {
          count: pendingTodos.length,
          todoList,
        }),
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
 * 发送非流式 AI 请求的通用工具函数
 */
async function fetchNonStreamResponse(
  config: { baseUrl: string; apiKey: string; model: string; temperature?: number },
  messages: any[],
  thinkingMode?: string,
): Promise<string> {
  const response = await fetch(buildApiUrl(config.baseUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: config.temperature ?? 0.7,
      stream: false,
      thinking: thinkingMode ? { type: thinkingMode } : undefined,
    }),
  })

  if (!response.ok) {
    throw new Error(`AI API Error: ${response.status} ${await response.text()}`)
  }

  const data = await response.json()
  return data.choices[0]?.message?.content || ''
}

/**
 * 发送多模型协同讨论请求
 */
export async function getMultiModelDiscussionStream(
  messages: ChatMessage[],
  onStepUpdate: (steps: DiscussionStep[]) => void,
  onFinalChunk: (chunk: string) => void,
  options: AIRequestOptions = {},
): Promise<void> {
  const aiConfig = getAIConfig()
  const { discussionModelIds = [], discussionPrimaryModelId, thinkingMode } = aiConfig

  // 1. 获取所有参与讨论的模型配置
  const presets = JSON.parse(localStorage.getItem('ai-presets') || '[]') as any[]

  // 确定主模型配置
  const primaryPreset = discussionPrimaryModelId
    ? presets.find((p) => p.id === discussionPrimaryModelId)
    : null

  const primaryConfig = {
    baseUrl: primaryPreset?.baseUrl ?? aiConfig.baseUrl,
    apiKey: primaryPreset?.apiKey ?? aiConfig.apiKey,
    model: primaryPreset?.model ?? aiConfig.model,
    temperature: primaryPreset?.temperature ?? aiConfig.temperature,
  }

  // 过滤副模型：排除主模型，避免冗余评审
  const selectedPresets = presets.filter((p) => {
    const isSelected = discussionModelIds.includes(p.id)
    const isPrimary =
      p.id === primaryPreset?.id || (p.model === aiConfig.model && p.baseUrl === aiConfig.baseUrl)
    return isSelected && !isPrimary
  })

  const primaryModelName = primaryPreset?.name ?? t('ai.primaryModel')

  // 如果没有选择副模型，回退到普通单模型请求
  if (selectedPresets.length === 0) {
    return getAIStreamResponse(messages, onFinalChunk, undefined, options)
  }

  // 初始化步骤列表
  const steps: DiscussionStep[] = [
    {
      modelId: 'primary-draft',
      modelName: primaryModelName,
      content: '',
      status: 'thinking' as const,
    },
    ...selectedPresets.map((p) => ({
      modelId: p.id,
      modelName: p.name,
      content: '',
      status: 'thinking' as const,
    })),
  ]

  onStepUpdate([...steps])

  const userQuery = messages[messages.length - 1].content

  // 2. 第一阶段：主模型生成草案
  let draftContent = ''
  try {
    draftContent = await fetchNonStreamResponse(
      primaryConfig,
      messages.map((m) => ({ role: m.role, content: m.content })),
      thinkingMode,
    )
    steps[0].content = draftContent
    steps[0].status = 'done'
  } catch (err) {
    steps[0].content = err instanceof Error ? err.message : 'Draft generation failed'
    steps[0].status = 'error'
    return getAIStreamResponse(messages, onFinalChunk, undefined, options)
  } finally {
    onStepUpdate([...steps])
  }

  // 3. 第二阶段：副模型评审草案
  const fetchModelReview = async (preset: any, index: number) => {
    const stepIndex = index + 1
    try {
      const reviewPrompt = t('ai.reviewPrompt', {
        originalQuery: userQuery,
        draftContent,
      })

      steps[stepIndex].content = await fetchNonStreamResponse(
        preset,
        [
          ...messages.slice(0, -1).map((m) => ({ role: m.role, content: m.content })),
          { role: 'user', content: reviewPrompt },
        ],
        thinkingMode,
      )
      steps[stepIndex].status = 'done'
    } catch (err) {
      steps[stepIndex].content = err instanceof Error ? err.message : 'Review failed'
      steps[stepIndex].status = 'error'
    } finally {
      onStepUpdate([...steps])
    }
  }

  await Promise.all(selectedPresets.map((p, i) => fetchModelReview(p, i)))

  // 4. 第三阶段：汇总讨论结果，由主模型生成最终回复
  const discussionSummary = steps
    .slice(1)
    .filter((s) => s.status === 'done')
    .map((s) => `【${s.modelName} 的评审意见】：\n${s.content}`)
    .join('\n\n')

  const synthesisPrompt = t('ai.synthesisPrompt', {
    originalQuery: userQuery,
    draftContent,
    discussionData: discussionSummary,
  })

  const synthesisMessages: ChatMessage[] = [
    ...messages.slice(0, -1),
    {
      id: generateId(),
      role: 'user',
      content: synthesisPrompt,
    },
  ]

  return getAIStreamResponse(synthesisMessages, onFinalChunk, undefined, {
    ...options,
    ...primaryConfig,
  })
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
