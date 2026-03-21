import { Module } from '@nestjs/common'
import { SkillSourcesController } from './skill-sources.controller'

@Module({
  controllers: [SkillSourcesController],
})
export class SkillSourcesModule {}
