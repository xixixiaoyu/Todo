import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus, Logger } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { WebSearchService } from './web-search.service'
import { SearchWebDto, VerifySearchKeyDto, SEARCH_PROVIDER_META } from './web-search.dto'
import type { SearchResponse } from './web-search.dto'
import { SEARCH_WEB_THROTTLE } from '../common'

@ApiTags('Web Search')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('web-search')
export class WebSearchController {
  private readonly logger = new Logger(WebSearchController.name)

  constructor(private readonly searchService: WebSearchService) {}

  /**
   * 执行联网搜索
   */
  @Post('search')
  @Throttle(SEARCH_WEB_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Search the web using configured provider' })
  async search(@Body() dto: SearchWebDto): Promise<SearchResponse> {
    this.logger.log(`Web search: provider=${dto.provider}, query="${dto.query.slice(0, 50)}"`)
    return this.searchService.search(dto.query, dto.provider, dto.apiKey, dto.maxResults ?? 5)
  }

  /**
   * 获取支持的 Provider 列表
   */
  @Post('providers')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List supported search providers' })
  getProviders(): Record<string, { label: string; requiresApiKey: boolean }> {
    return SEARCH_PROVIDER_META
  }

  /**
   * 验证 API Key
   */
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify search provider API key' })
  async verifyKey(@Body() dto: VerifySearchKeyDto): Promise<{ valid: boolean; error?: string }> {
    try {
      await this.searchService.verifyKey(dto.provider, dto.apiKey)
      return { valid: true }
    } catch (error) {
      this.logger.warn(`Key verification failed for ${dto.provider}: ${(error as Error).message}`)
      return { valid: false, error: (error as Error).message }
    }
  }
}
