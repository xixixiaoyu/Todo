import { Module } from '@nestjs/common'
import { NovelService } from './novel.service'
import { NovelController } from './novel.controller'

@Module({
  controllers: [NovelController],
  providers: [NovelService],
  exports: [NovelService],
})
export class NovelModule {}
