import { Module } from '@nestjs/common'
import { TeachingService } from './teaching.service'
import { TeachingController } from './teaching.controller'

@Module({
  controllers: [TeachingController],
  providers: [TeachingService],
  exports: [TeachingService],
})
export class TeachingModule {}
