import { buildApiUrl, getHeaders } from './utils/http'
import type { AIConfig } from '../composables/useAIConfig'

export function detectLanguage(text: string): 'zh' | 'non-zh' {
  return /[\u4e00-\u9fff]/.test(text) ? 'zh' : 'non-zh'
}

export async function translateText(
  text: string,
  targetLang: 'zh' | 'en',
  config: AIConfig,
  signal?: AbortSignal,
): Promise<string> {
  const url = buildApiUrl(config.baseUrl)
  const targetName = targetLang === 'zh' ? 'Chinese' : 'English'

  const response = await fetch(url, {
    method: 'POST',
    headers: getHeaders(config.apiKey),
    body: JSON.stringify({
      model: config.model,
      messages: [
        {
          role: 'system',
          content: `You are a professional translator. Translate the following text to ${targetName}. Preserve the original formatting, tone, and style. Output ONLY the translation, no explanations.`,
        },
        { role: 'user', content: text },
      ],
      temperature: 0.3,
      stream: false,
    }),
    signal,
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    // 尝试从 OpenAI 兼容格式中提取错误信息，避免原始 body 泄露给用户
    let message = `Translation API error (${response.status})`
    try {
      const parsed = JSON.parse(body) as { error?: { message?: string } }
      if (parsed.error?.message) {
        message = parsed.error.message
      }
    } catch {
      // 非 JSON 响应，使用安全消息
    }
    console.warn('[translation] API error:', { status: response.status, body })
    throw new Error(message)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content ?? ''
}
