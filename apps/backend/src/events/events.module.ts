import { Module } from '@nestjs/common'
import { EventsGateway } from './events.gateway'
import { AuthModule } from '../auth/auth.module'

/**
 * WebSocket 事件模块
 * 提供实时通信能力
 */
@Module({
  imports: [AuthModule],
  providers: [EventsGateway],
  exports: [EventsGateway],
})
export class EventsModule {}
