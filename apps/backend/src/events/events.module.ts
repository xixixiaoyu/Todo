import { Module, forwardRef } from '@nestjs/common'
import { EventsGateway } from './events.gateway'
import { TodosModule } from '../todos/todos.module'
import { AuthModule } from '../auth/auth.module'

/**
 * WebSocket 事件模块
 * 提供实时通信能力
 */
@Module({
  imports: [forwardRef(() => TodosModule), AuthModule],
  providers: [EventsGateway],
  exports: [EventsGateway],
})
export class EventsModule {}
