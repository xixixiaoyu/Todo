import { Module } from '@nestjs/common'
import { SessionFileController } from './session-file.controller'
import { SessionFileRegistry } from './session-file.registry'

@Module({
  controllers: [SessionFileController],
  providers: [SessionFileRegistry],
  exports: [SessionFileRegistry],
})
export class SessionFileModule {}
