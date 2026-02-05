import { Controller, Post, Body, UseGuards, Get, Headers, Param, Delete } from '@nestjs/common'
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
  async sync(
    @CurrentUser() user: User,
    @Body() syncDto: SyncMergeDto,
    @Headers('X-Socket-ID') socketId?: string,
  ) {
    return this.todosService.sync(user.id, syncDto, socketId)
  }

  @Get()
  @ApiOperation({ summary: '获取当前用户所有待办事项' })
  async findAll(@CurrentUser() user: User) {
    return this.todosService.findAll(user.id)
  }

  @Get('trash')
  @ApiOperation({ summary: '获取回收站中的待办事项' })
  async findTrash(@CurrentUser() user: User) {
    return this.todosService.findTrash(user.id)
  }

  @Post(':id/restore')
  @ApiOperation({ summary: '恢复已删除的待办事项' })
  async restore(@CurrentUser() user: User, @Param('id') id: string) {
    return this.todosService.restore(user.id, id)
  }

  @Delete(':id/permanent')
  @ApiOperation({ summary: '永久删除待办事项' })
  async deletePermanently(@CurrentUser() user: User, @Param('id') id: string) {
    return this.todosService.deletePermanently(user.id, id)
  }

  @Delete('trash/clear')
  @ApiOperation({ summary: '清空回收站' })
  async clearTrash(@CurrentUser() user: User) {
    return this.todosService.clearTrash(user.id)
  }
}
