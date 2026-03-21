import { Module } from '@nestjs/common'
import { SkillSourcesController } from './skill-sources.controller'
import { SkillRuntimeController } from './skill-runtime.controller'
import { SkillRuntimeService } from './skill-runtime.service'

@Module({
  controllers: [SkillSourcesController, SkillRuntimeController],
  providers: [SkillRuntimeService],
})
export class SkillSourcesModule {}
