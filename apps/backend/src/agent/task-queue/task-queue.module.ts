import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { EventsModule } from '../../events/events.module'
import { AgentTaskProcessor } from './agent-task.processor'
import { DeferredResultStore } from './deferred-result.store'

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'agent-tasks',
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 2,
        backoff: { type: 'exponential', delay: 1000 },
      },
    }),
    EventsModule,
  ],
  providers: [AgentTaskProcessor, DeferredResultStore],
  exports: [DeferredResultStore, BullModule],
})
export class TaskQueueModule {}
