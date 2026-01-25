import { Module, forwardRef } from '@nestjs/common'
import { TodosService } from './todos.service'
import { TodosController } from './todos.controller'
import { PrismaModule } from '../prisma/prisma.module'
import { EventsModule } from '../events/events.module'

@Module({
  imports: [PrismaModule, forwardRef(() => EventsModule)],
  controllers: [TodosController],
  providers: [TodosService],
  exports: [TodosService],
})
export class TodosModule {}
