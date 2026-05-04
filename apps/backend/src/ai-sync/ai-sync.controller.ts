import { Controller, Get, Put, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CurrentUser } from '../auth/current-user.decorator'
import { ZodValidationPipe } from 'nestjs-zod'
import {
  AIMemoryDataSchema,
  AISkillSyncListSchema,
  AIPresetSyncListSchema,
  type AIMemoryData,
  type AISkillSync,
  type AIPresetSync,
} from '@lumina/shared'
import type { User } from '@lumina/shared'
import { AiMemoryService } from './ai-memory.service'
import { AiSkillService } from './ai-skill.service'
import { AiPresetService } from './ai-preset.service'

@ApiTags('AI Sync')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiSyncController {
  constructor(
    private readonly memoryService: AiMemoryService,
    private readonly skillService: AiSkillService,
    private readonly presetService: AiPresetService,
  ) {}

  // ─── Memories ────────────────────────────────────────────────────

  @Get('memories')
  @ApiOperation({ summary: 'Get AI memories for current user' })
  async getMemories(@CurrentUser() user: User): Promise<AIMemoryData> {
    return this.memoryService.get(user.id)
  }

  @Put('memories')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upsert AI memories for current user' })
  async upsertMemories(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(AIMemoryDataSchema)) data: AIMemoryData,
  ): Promise<AIMemoryData> {
    return this.memoryService.upsert(user.id, data)
  }

  // ─── Skills ──────────────────────────────────────────────────────

  @Get('skills')
  @ApiOperation({ summary: 'Get all AI skills for current user' })
  async getSkills(@CurrentUser() user: User): Promise<AISkillSync[]> {
    return this.skillService.findAll(user.id)
  }

  @Put('skills')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Replace all AI skills for current user' })
  async upsertSkills(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(AISkillSyncListSchema)) data: AISkillSync[],
  ): Promise<AISkillSync[]> {
    return this.skillService.upsertAll(user.id, data)
  }

  // ─── Presets ─────────────────────────────────────────────────────

  @Get('presets')
  @ApiOperation({ summary: 'Get all AI presets for current user' })
  async getPresets(@CurrentUser() user: User): Promise<AIPresetSync[]> {
    return this.presetService.findAll(user.id)
  }

  @Put('presets')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Replace all AI presets for current user' })
  async upsertPresets(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(AIPresetSyncListSchema)) data: AIPresetSync[],
  ): Promise<AIPresetSync[]> {
    return this.presetService.upsertAll(user.id, data)
  }
}
