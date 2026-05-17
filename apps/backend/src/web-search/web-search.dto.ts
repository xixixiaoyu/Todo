import { IsString, IsInt, Min, Max, IsOptional, IsIn } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

/**
 * 支持的搜索 Provider
 */
export const SEARCH_PROVIDERS = ['tavily', 'serper', 'brave'] as const
export type SearchProvider = (typeof SEARCH_PROVIDERS)[number]

/**
 * Provider 元数据
 */
export const SEARCH_PROVIDER_META: Record<
  SearchProvider,
  { requiresApiKey: boolean; label: string }
> = {
  tavily: { requiresApiKey: true, label: 'Tavily' },
  serper: { requiresApiKey: true, label: 'Serper (Google)' },
  brave: { requiresApiKey: true, label: 'Brave Search' },
}

/**
 * 搜索结果条目
 */
export interface SearchResultItem {
  title: string
  url: string
  content: string
  rank: number | null
  score: number | null
  metadata: Record<string, unknown>
}

/**
 * 搜索响应
 */
export interface SearchResponse {
  query: string
  provider: string
  source_type: 'api' | 'scrape'
  results: SearchResultItem[]
  diagnostics: Record<string, unknown>
}

/**
 * 搜索请求 DTO
 */
export class SearchWebDto {
  @ApiProperty({ description: 'Search query' })
  @IsString()
  query!: string

  @ApiProperty({ description: 'Search provider', enum: SEARCH_PROVIDERS, default: 'tavily' })
  @IsString()
  @IsIn(SEARCH_PROVIDERS)
  provider: SearchProvider = 'tavily'

  @ApiProperty({ description: 'Max results (1-10)', default: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  maxResults?: number

  @ApiProperty({
    description: 'Provider API key (required for tavily/serper/brave)',
  })
  @IsOptional()
  @IsString()
  apiKey?: string
}

/**
 * 验证 API Key DTO
 */
export class VerifySearchKeyDto {
  @ApiProperty({ description: 'Search provider', enum: SEARCH_PROVIDERS })
  @IsString()
  @IsIn(SEARCH_PROVIDERS)
  provider!: SearchProvider

  @ApiProperty({
    description: 'API key to verify',
  })
  @IsOptional()
  @IsString()
  apiKey?: string
}
