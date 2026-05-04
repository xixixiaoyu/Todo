import { Module } from '@nestjs/common'
import { AiSyncController } from './ai-sync.controller'
import { AiMemoryService } from './ai-memory.service'
import { AiSkillService } from './ai-skill.service'
import { AiPresetService } from './ai-preset.service'

/**
 * AI 数据同步模块
 * 提供 Memory、Skill、Preset 的服务端持久化与同步
 */
@Module({
  controllers: [AiSyncController],
  providers: [AiMemoryService, AiSkillService, AiPresetService],
  exports: [AiMemoryService, AiSkillService, AiPresetService],
})
export class AiSyncModule {}
