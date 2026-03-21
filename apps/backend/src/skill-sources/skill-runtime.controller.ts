import { Body, Controller, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { SkillRuntimeService } from './skill-runtime.service'
import { ExecuteHttpSkillRuntimeDto } from './skill-runtime.dto'

@ApiTags('技能运行时')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('skills/runtime')
export class SkillRuntimeController {
  constructor(private readonly skillRuntimeService: SkillRuntimeService) {}

  @Post('http')
  @ApiOperation({ summary: '执行通用 HTTP 技能运行时' })
  async executeHttpRuntime(@Body() dto: ExecuteHttpSkillRuntimeDto): Promise<unknown> {
    return this.skillRuntimeService.executeHttpRuntime(dto)
  }
}
