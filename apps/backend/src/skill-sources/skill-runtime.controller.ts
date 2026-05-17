import { Body, Controller, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { SkillRuntimeService } from './skill-runtime.service'
import { ExecuteHttpSkillRuntimeDto } from './skill-runtime.dto'
import { SKILL_RUNTIME_THROTTLE } from '../common'

@ApiTags('技能运行时')
@ApiBearerAuth()
@Controller('skills/runtime')
export class SkillRuntimeController {
  constructor(private readonly skillRuntimeService: SkillRuntimeService) {}

  @Post('http')
  @Throttle(SKILL_RUNTIME_THROTTLE)
  @ApiOperation({ summary: '执行通用 HTTP 技能运行时' })
  async executeHttpRuntime(@Body() dto: ExecuteHttpSkillRuntimeDto): Promise<unknown> {
    return this.skillRuntimeService.executeHttpRuntime(dto)
  }
}
