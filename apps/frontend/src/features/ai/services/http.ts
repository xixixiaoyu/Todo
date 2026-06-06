import { getAIConfig } from '@/features/ai/composables/useAIConfig'

export function buildApiUrl(baseUrl: string): string {
  const base = baseUrl.replace(/\/+$/, '')
  return `${base}/chat/completions`
}

export function getHeaders(apiKeyOverride?: string): Record<string, string> {
  const { apiKey } = getAIConfig()
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKeyOverride || apiKey}`,
  }
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 11)
}
