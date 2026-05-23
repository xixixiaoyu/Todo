import { Injectable, Logger, BadGatewayException } from '@nestjs/common'
import type { SearchProvider, SearchResponse, SearchResultItem } from './web-search.dto'

/**
 * Web Search Service
 * 支持搜索 Provider：Tavily / Serper(Google)
 */
@Injectable()
export class WebSearchService {
  private readonly logger = new Logger(WebSearchService.name)

  /**
   * 执行联网搜索
   */
  async search(
    query: string,
    provider: SearchProvider,
    apiKey: string | undefined,
    maxResults: number = 5,
  ): Promise<SearchResponse> {
    if (!query?.trim()) {
      throw new BadGatewayException('Search query is required')
    }

    if (!apiKey) {
      throw new BadGatewayException(`API key is required for provider "${provider}"`)
    }

    const searchFn = this.getSearchFn(provider)
    const results = await searchFn(query, apiKey, maxResults)

    return {
      query,
      provider,
      source_type: 'api',
      results,
      diagnostics: {},
    }
  }

  /**
   * 验证 API Key 是否有效
   */
  async verifyKey(provider: SearchProvider, apiKey?: string): Promise<boolean> {
    try {
      const searchFn = this.getSearchFn(provider)
      await searchFn('test', apiKey ?? '', 1)
      return true
    } catch {
      throw new BadGatewayException(`Invalid API key for provider "${provider}"`)
    }
  }

  private getSearchFn(
    provider: SearchProvider,
  ): (query: string, apiKey: string, maxResults: number) => Promise<SearchResultItem[]> {
    switch (provider) {
      case 'tavily':
        return this.searchTavily.bind(this)
      case 'serper':
        return this.searchSerper.bind(this)
      default:
        throw new BadGatewayException(`Unknown search provider: ${provider}`)
    }
  }

  // ── Tavily ──

  private async searchTavily(
    query: string,
    apiKey: string,
    maxResults: number,
  ): Promise<SearchResultItem[]> {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        max_results: maxResults,
        search_depth: 'basic',
      }),
      signal: AbortSignal.timeout(30_000),
    })

    if (!res.ok) {
      const errorText = await res.text().catch(() => '')
      throw new BadGatewayException(
        `Tavily API returned HTTP ${res.status}: ${errorText.slice(0, 200)}`,
      )
    }

    const data = (await res.json()) as {
      results?: Array<{ title?: string; url?: string; content?: string }>
    }
    return (data.results || []).map((r, i) => ({
      title: r.title || '',
      url: r.url || '',
      content: r.content || '',
      rank: i + 1,
      score: null,
      metadata: {},
    }))
  }

  // ── Serper (Google) ──

  private async searchSerper(
    query: string,
    apiKey: string,
    maxResults: number,
  ): Promise<SearchResultItem[]> {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey,
      },
      body: JSON.stringify({ q: query, num: maxResults }),
      signal: AbortSignal.timeout(30_000),
    })

    if (!res.ok) {
      const errorText = await res.text().catch(() => '')
      throw new BadGatewayException(
        `Serper API returned HTTP ${res.status}: ${errorText.slice(0, 200)}`,
      )
    }

    const data = (await res.json()) as {
      organic?: Array<{ title?: string; link?: string; snippet?: string }>
    }
    return (data.organic || []).slice(0, maxResults).map((r, i) => ({
      title: r.title || '',
      url: r.link || '',
      content: r.snippet || '',
      rank: i + 1,
      score: null,
      metadata: {},
    }))
  }
}
