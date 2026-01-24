import { Controller, Post, Body, UseGuards, Get } from '@nestjs/common'
import { TodosService } from './todos.service'
import { SyncMergeDto } from './todos.dto'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CurrentUser } from '../auth/current-user.decorator'
import type { User } from '@my-app/shared'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'

@ApiTags('Todos')
@Controller('todos')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TodosController {
  constructor(private readonly todosService: TodosService) {}

  @Post('sync')
  @ApiOperation({ summary: '同步并合并待办事项 (离线优先)' })
  async sync(@CurrentUser() user: User, @Body() syncDto: SyncMergeDto) {
    return this.todosService.sync(user.id, syncDto)
  }

  @Get()
  @ApiOperation({ summary: '获取当前用户所有待办事项' })
  async findAll(@CurrentUser() user: User) {
    return this.todosService.findAll(user.id)
  }
}
