import { httpClient } from '@/api'
import { unwrapApiResponse } from '@lumina/shared'
import type { ApiResponse } from '@lumina/shared'
import type { Tool } from '@/features/ai/services/aiService'
import { getSkillRuntimeConfig } from '@/features/ai/composables/useSkillRuntimeConfig'

/**
 * web_search 工具定义
 * 始终可用（不依赖 sidecar 或 MCP），由 AI 助手在需要联网信息时自动调用
 */
export const WEB_SEARCH_TOOL_DEFINITION: Tool = {
  type: 'function',
  function: {
    name: 'web_search',
    description:
      'Search the live web for current information, news, and real-time data. Use this when the user asks about recent events, up-to-date information, or any topic that requires internet access.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query, concise and specific in the user language.',
        },
        maxResults: {
          type: 'integer',
          minimum: 1,
          maximum: 10,
          default: 5,
          description: 'Maximum number of search results to return (1-10, default 5).',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
}

export type WebSearchResult = {
  title: string
  url: string
  content: string
}

interface WebSearchResponse {
  query: string
  provider: string
  results: WebSearchResult[]
  source_type: string
  diagnostics: Record<string, unknown>
}

/**
 * web_search 工具执行函数
 * 读取用户保存的 API Key，依次尝试已配置的 provider
 */
export async function executeWebSearch(args: Record<string, unknown>): Promise<string> {
  const query = args.query as string | undefined
  if (!query?.trim()) return 'Error: Search query is required.'

  const maxResults = Math.min(Math.max(Number(args.maxResults) || 5, 1), 10)
  const runtimeConfig = getSkillRuntimeConfig()

  // 按优先级依次尝试已配置的付费 API
  const paidProviders: Array<{ name: string; keyName: string }> = [
    { name: 'tavily', keyName: 'tavilyApiKey' },
    { name: 'serper', keyName: 'serperApiKey' },
    { name: 'brave', keyName: 'braveApiKey' },
  ]

  const errors: string[] = []
  let triedCount = 0

  for (const { name, keyName } of paidProviders) {
    const apiKey = runtimeConfig.secrets[keyName]
    if (!apiKey?.trim()) continue

    triedCount++
    try {
      const { data } = await httpClient.post<ApiResponse<WebSearchResponse>>(
        '/web-search/search',
        {
          query,
          provider: name,
          maxResults,
          apiKey,
        },
        { timeout: 30_000 },
      )

      const response = unwrapApiResponse(data)
      const results = response.results

      if (!results || results.length === 0) {
        return `No search results found via ${name}.`
      }

      const formatted = results
        .map((r, i) => `${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.content}`)
        .join('\n\n')

      return `Searched via ${name}:\n\n${formatted}`
    } catch (err) {
      const message = extractErrorMessage(err)
      console.warn(`Web search provider "${name}" failed:`, message)
      errors.push(`${name}: ${message}`)
      continue
    }
  }

  if (errors.length > 0) {
    return `Web search failed. ${errors.join('; ')}.`
  }

  return (
    'Web search is not available. Please configure an API key for one of the supported search providers ' +
    '(Tavily, Serper/Google, Brave) in the AI settings panel.'
  )
}

/** 从 Axios 错误中提取后端实际返回的错误消息，而非 Axios 的通用 "Request failed with status code 502" */
function extractErrorMessage(err: unknown): string {
  const axiosErr = err as { response?: { data?: { message?: string | string[] } } }
  const backendMessage = axiosErr.response?.data?.message
  if (typeof backendMessage === 'string') return backendMessage
  if (Array.isArray(backendMessage) && backendMessage.length > 0) return backendMessage[0]
  return (err as Error).message || String(err)
}
