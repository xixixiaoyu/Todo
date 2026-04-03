/**
 * 图片任务提取服务
 * 用于从图片中解析并提取待办任务列表
 */

import { getAIConfig } from '@/features/ai/composables/useAIConfig'
import { buildApiUrl, getHeaders } from './utils/http'
import type { MultiModalContent, AIChatCompletionMessage } from './types'

/**
 * 图片任务提取的系统提示词
 */
const IMAGE_TASK_EXTRACTION_PROMPT = `你是一个专业的任务提取助手。你的任务是分析用户提供的图片，从中识别出可执行的待办任务。

请仔细分析图片内容，提取出所有可以作为待办事项的任务。任务应该是具体、可执行的行动项。

要求：
1. 每个任务应该简洁明了，通常不超过50个字符
2. 任务应该是可执行的行动项，而不是描述性的内容
3. 如果图片中包含清单、列表或待办事项，直接提取它们
4. 如果图片是会议记录、笔记等，提取其中的行动项
5. 如果图片中没有明确的任务，尝试从内容中推断合理的任务

请以 JSON 数组格式返回任务列表，格式如下：
["任务1", "任务2", "任务3"]

如果无法从图片中识别出任何任务，返回空数组：[]

只返回 JSON 数组，不要包含其他解释文字。`

export interface ExtractTasksOptions {
  baseUrl?: string
  apiKey?: string
  model?: string
  signal?: AbortSignal
}

/**
 * 从图片中提取任务列表
 * @param imageBase64 图片的 base64 编码（包含 data:image/... 前缀）
 * @param options 可选的 API 配置
 * @returns 提取出的任务列表
 */
export async function extractTasksFromImage(
  imageBase64: string,
  options: ExtractTasksOptions = {},
): Promise<string[]> {
  const aiConfig = getAIConfig()
  const { baseUrl = aiConfig.baseUrl, apiKey = aiConfig.apiKey, model = aiConfig.model } = options

  // 构建多模态消息内容
  const content: MultiModalContent[] = [
    { type: 'text', text: '请分析这张图片，提取其中的待办任务。' },
    {
      type: 'image_url',
      image_url: { url: imageBase64 },
    },
  ]

  const messages: AIChatCompletionMessage[] = [
    {
      role: 'system',
      content: IMAGE_TASK_EXTRACTION_PROMPT,
    },
    {
      role: 'user',
      content,
    },
  ]

  const response = await fetch(buildApiUrl(baseUrl), {
    method: 'POST',
    headers: getHeaders(apiKey),
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.6, // 使用较低温度以获得更稳定的输出
      top_p: 0.95,
      stream: false,
      thinking: { type: 'disabled' },
    }),
    signal: options.signal,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`AI API Error: ${response.status} ${errorText}`)
  }

  const data = await response.json()
  const messageContent = data.choices?.[0]?.message?.content || ''

  // 解析 JSON 响应
  return parseTasksFromResponse(messageContent)
}

/**
 * 从 AI 响应中解析任务列表
 */
function parseTasksFromResponse(content: string): string[] {
  // 尝试直接解析 JSON
  try {
    const trimmed = content.trim()

    // 尝试提取 JSON 数组部分
    const jsonMatch = trimmed.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      if (Array.isArray(parsed)) {
        return parsed
          .filter((item): item is string => typeof item === 'string')
          .map((task) => task.trim())
          .filter((task) => task.length > 0)
      }
    }

    // 如果整体是 JSON 数组
    const parsed = JSON.parse(trimmed)
    if (Array.isArray(parsed)) {
      return parsed
        .filter((item): item is string => typeof item === 'string')
        .map((task) => task.trim())
        .filter((task) => task.length > 0)
    }
  } catch {
    // JSON 解析失败，尝试其他方式
  }

  // 如果无法解析 JSON，尝试按行分割
  const lines = content
    .split('\n')
    .map((line) => line.replace(/^[-*\d.)\]]+\s*/, '').trim())
    .filter((line) => line.length > 0 && line.length < 200)

  // 如果有合理的行，返回它们
  if (lines.length > 0 && lines.length <= 20) {
    return lines
  }

  return []
}

/**
 * 检查图片大小是否在允许范围内
 * @param base64 图片的 base64 编码
 * @param maxSizeMB 最大允许的文件大小（MB）
 */
export function isImageSizeValid(base64: string, maxSizeMB: number = 10): boolean {
  // base64 字符串大小约为原文件大小的 4/3
  const base64Length = base64.length
  const sizeInBytes = (base64Length * 3) / 4
  const sizeInMB = sizeInBytes / (1024 * 1024)
  return sizeInMB <= maxSizeMB
}
