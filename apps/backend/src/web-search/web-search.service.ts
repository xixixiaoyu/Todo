import { Injectable, Logger, BadGatewayException } from '@nestjs/common'
import type { SearchProvider, SearchResponse, SearchResultItem } from './web-search.dto'

/**
 * Web Search Service
 * 支持多个搜索 Provider：Tavily / Serper(Google) / Brave / DuckDuckGo
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

    const isFreeProvider = provider === 'duckduckgo'
    if (!isFreeProvider && !apiKey) {
      throw new BadGatewayException(`API key is required for provider "${provider}"`)
    }

    const searchFn = this.getSearchFn(provider)
    const results = await searchFn(query, apiKey ?? '', maxResults)

    return {
      query,
      provider,
      source_type: isFreeProvider ? 'scrape' : 'api',
      results,
      diagnostics: {},
    }
  }

  /**
   * 验证 API Key 是否有效
   */
  async verifyKey(provider: SearchProvider, apiKey?: string): Promise<boolean> {
    const isFreeProvider = provider === 'duckduckgo'
    if (isFreeProvider) return true

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
      case 'brave':
        return this.searchBrave.bind(this)
      case 'duckduckgo':
        return this.searchDuckDuckGo.bind(this)
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

  // ── Brave Search ──

  private async searchBrave(
    query: string,
    apiKey: string,
    maxResults: number,
  ): Promise<SearchResultItem[]> {
    const params = new URLSearchParams({ q: query, count: String(maxResults) })
    const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': apiKey,
      },
      signal: AbortSignal.timeout(30_000),
    })

    if (!res.ok) {
      const errorText = await res.text().catch(() => '')
      throw new BadGatewayException(
        `Brave API returned HTTP ${res.status}: ${errorText.slice(0, 200)}`,
      )
    }

    const data = (await res.json()) as {
      web?: { results?: Array<{ title?: string; url?: string; description?: string }> }
    }
    return (data.web?.results || []).slice(0, maxResults).map((r, i) => ({
      title: r.title || '',
      url: r.url || '',
      content: r.description || '',
      rank: i + 1,
      score: null,
      metadata: {},
    }))
  }

  // ── DuckDuckGo (免 API Key) ──

  private async searchDuckDuckGo(
    query: string,
    _apiKey: string,
    maxResults: number,
  ): Promise<SearchResultItem[]> {
    const res = await fetch('https://html.duckduckgo.com/html/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      },
      body: new URLSearchParams({ q: query }),
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) {
      throw new BadGatewayException(`DuckDuckGo returned HTTP ${res.status}`)
    }

    const html = await res.text()
    const results: SearchResultItem[] = []

    // 通过 class 名称提取链接和摘要，按顺序配对，不依赖 DOM 结构
    const linkMatches = html.matchAll(
      /<a\s[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g,
    )

    for (const linkMatch of linkMatches) {
      if (results.length >= maxResults) break

      const title = linkMatch[2].replace(/<[^>]+>/g, '').trim()
      if (!title) continue

      let url = linkMatch[1]
      const redirectParam = url.match(/uddg=([^&]+)/)
      if (redirectParam) {
        try {
          url = decodeURIComponent(redirectParam[1])
        } catch {
          // 保留原始 URL
        }
      }

      results.push({
        title,
        url,
        content: '', // 稍后通过 snippet regex 填充
        rank: results.length + 1,
        score: null,
        metadata: {},
      })
    }

    // 提取所有 snippet，按顺序配对
    const snippetMatches = html.matchAll(
      /<a\s[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/g,
    )
    let idx = 0
    for (const snippetMatch of snippetMatches) {
      if (idx >= results.length) break
      results[idx].content = snippetMatch[1].replace(/<[^>]+>/g, '').trim()
      idx++
    }

    return results
  }
}
