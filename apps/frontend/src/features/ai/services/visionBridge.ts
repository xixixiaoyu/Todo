/**
 * Vision Bridge — 文本模型图片识别辅助
 *
 * 当主模型不支持图片输入时，使用配置的视觉模型分析图片内容，
 * 将分析结果转换为结构化文本注入对话。
 */

import type { ChatMessage } from './types'

// ─── 常量 ──────────────────────────────────────────────────────────

const VISION_CONTEXT_START = '<vision-context>'
const VISION_CONTEXT_END = '</vision-context>'
const VISION_ANALYSIS_TIMEOUT_MS = 30_000
const MAX_VISION_NOTE_CHARS = 3_200

// ─── 内存缓存 ──────────────────────────────────────────────────────

const analysisCache = new Map<string, string>()
const MAX_CACHE_ENTRIES = 128

function cacheKey(imageUrl: string, userPrompt: string, model: string): string {
  // 对 base64 图片取前 200 字符做摘要，避免 key 过长
  const imageDigest = imageUrl.length > 200 ? imageUrl.slice(-200) : imageUrl
  return `${model}::${imageDigest}::${userPrompt.slice(0, 200)}`
}

// ─── 公开 API ──────────────────────────────────────────────────────

export interface VisionConfig {
  model: string
  baseUrl: string
  apiKey: string
}

export interface AIPresetLike {
  id: string
  baseUrl: string
  apiKey: string
  model: string
}

/**
 * 从预设列表中解析视觉模型配置。
 * 若 presetId 匹配到有效预设则返回其配置，否则返回 null。
 */
export function resolveVisionConfig(
  presetId: string | null | undefined,
  presets: readonly AIPresetLike[],
): VisionConfig | null {
  if (!presetId) return null
  const preset = presets.find((p) => p.id === presetId)
  if (!preset?.baseUrl || !preset.apiKey || !preset.model) return null
  return { model: preset.model, baseUrl: preset.baseUrl, apiKey: preset.apiKey }
}

/**
 * 调用视觉模型分析单张图片。
 * @returns 图片的文本描述，失败时返回简短回退文本
 */
export async function analyzeImageWithVision(
  imageUrl: string,
  userPrompt: string,
  config: VisionConfig,
): Promise<string> {
  const key = cacheKey(imageUrl, userPrompt, config.model)
  const cached = analysisCache.get(key)
  if (cached) return cached

  const systemPrompt = [
    '你是一个图片分析助手。请仔细观察用户提供的图片，并根据用户的问题给出准确、详细的描述。',
    '',
    '请按以下结构输出分析结果：',
    '1. **图片概述**：简要描述图片的整体内容',
    '2. **可见文字**：逐字转录图片中的所有文字（如有）',
    '3. **物体与布局**：描述图片中的主要物体、人物及其空间关系',
    '4. **数据/图表分析**：如果图片包含图表、表格或数据可视化，详细解读',
    '',
    '注意事项：',
    '- 使用与用户问题相同的语言回复',
    '- 对于无法确定的内容，标注 "(不确定)"',
    '- 输出控制在 500 字以内，聚焦与用户问题最相关的信息',
  ].join('\n')

  const base = config.baseUrl.replace(/\/+$/, '')
  const url = `${base}/chat/completions`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), VISION_ANALYSIS_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: userPrompt || '请详细描述这张图片的内容。' },
              { type: 'image_url', image_url: { url: imageUrl } },
            ],
          },
        ],
        temperature: 0.3,
        stream: false,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.warn(`[VisionBridge] 视觉模型请求失败 (${response.status}): ${errorText}`)
      return fallbackNote(userPrompt)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''
    const note = truncate(content, MAX_VISION_NOTE_CHARS)

    // 缓存结果
    if (analysisCache.size >= MAX_CACHE_ENTRIES) {
      const firstKey = analysisCache.keys().next().value
      if (firstKey) analysisCache.delete(firstKey)
    }
    analysisCache.set(key, note)

    return note
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      console.warn('[VisionBridge] 视觉分析超时')
    } else {
      console.warn('[VisionBridge] 视觉分析异常:', err)
    }
    return fallbackNote(userPrompt)
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * 预处理消息列表：对包含图片的消息用视觉模型分析，注入 <vision-context> 文本块。
 * 处理后消息的 images 数组会被清空。
 */
export async function prepareVisionContext(
  messages: ChatMessage[],
  config: VisionConfig,
): Promise<ChatMessage[]> {
  const result: ChatMessage[] = []

  for (const msg of messages) {
    if (!msg.images || msg.images.length === 0) {
      result.push(msg)
      continue
    }

    const userPrompt = extractPromptText(msg.content)
    const visionNotes: string[] = []

    for (let i = 0; i < msg.images.length; i++) {
      const imageUrl = msg.images[i]
      const note = await analyzeImageWithVision(imageUrl, userPrompt, config)
      const label = msg.images.length > 1 ? `image_${i + 1}` : 'image'
      visionNotes.push(`${label}: ${note}`)
    }

    const visionBlock = [VISION_CONTEXT_START, ...visionNotes, VISION_CONTEXT_END].join('\n')
    const newContent = msg.content ? `${visionBlock}\n\n${msg.content}` : visionBlock

    result.push({
      ...msg,
      content: newContent,
      images: [], // 清空图片，避免后续转为 MultiModalContent
    })
  }

  return result
}

// ─── 内部工具函数 ──────────────────────────────────────────────────

function extractPromptText(content: string): string {
  if (!content) return ''
  return content.replace(/<vision-context>[\s\S]*?<\/vision-context>/g, '').trim()
}

function truncate(text: string, max: number): string {
  const s = String(text || '').trim()
  return s.length > max ? `${s.slice(0, max - 20)}\n...[truncated]` : s
}

function fallbackNote(userPrompt: string): string {
  const base = '(Vision analysis is temporarily unavailable / 视觉分析暂时不可用)'
  return userPrompt ? `${base}\nUser question: ${userPrompt}` : base
}
