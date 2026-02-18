/**
 * AI 服务扩展功能（生图、多模型讨论）
 */

import { getAIConfig, getAIPresets, type AIPreset } from '@/features/ai/composables/useAIConfig'
import i18n from '@/i18n'
import type { ChatMessage, AIRequestOptions, DiscussionStep, MultiModalContent } from './types'
import { buildApiUrl, getHeaders, generateId, injectSystemPrompts } from './utils'
import { getAIStreamResponse, fetchNonStreamResponse, resetAbortSignal } from './core'

const t = i18n.global.t

/**
 * 发送 AI 生图请求
 * @param prompt 提示词
 * @param images 可选的参考图片列表
 * @param options 请求选项
 */
export async function getAIImageResponse(
  prompt: string,
  images: string[] = [],
  options: AIRequestOptions = {},
): Promise<string[]> {
  const aiConfig = getAIConfig()
  const {
    model = aiConfig.model,
    baseUrl = aiConfig.baseUrl,
    apiKey = aiConfig.apiKey,
    top_p = 0.95,
  } = options

  // 构建多模态内容
  const content: MultiModalContent[] = [{ type: 'text', text: prompt }]
  if (images && images.length > 0) {
    images.forEach((url) => {
      content.push({
        type: 'image_url',
        image_url: { url },
      })
    })
  }

  const response = await fetch(buildApiUrl(baseUrl), {
    method: 'POST',
    headers: getHeaders(apiKey),
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'user',
          content,
        },
      ],
      top_p,
      // 开启图片生成能力 (针对 Gemini 2.0+ 或其他支持 modalities 的模型)
      modalities: ['image', 'text'],
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`AI Image Generation Error: ${response.status} ${errorText}`)
  }

  const result = await response.json()
  const generatedImages: string[] = []

  if (result.choices) {
    const message = result.choices[0].message
    if (message.images) {
      message.images.forEach((image: { image_url: { url: string } }) => {
        generatedImages.push(image.image_url.url)
      })
    } else if (message.content && message.content.includes('image_url')) {
      // 兼容某些模型可能在 content 中返回图片 URL 的情况
      try {
        const content = JSON.parse(message.content)
        if (Array.isArray(content)) {
          content.forEach((item) => {
            if (item.type === 'image_url' && item.image_url?.url) {
              generatedImages.push(item.image_url.url)
            }
          })
        }
      } catch {
        // 非 JSON 格式，忽略
      }
    }
  }

  return generatedImages
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

  // 确保先中止之前的请求并获取新的 signal
  const signal = resetAbortSignal()

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
        aiConfig.assistantMode,
        options.contextSummary,
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
