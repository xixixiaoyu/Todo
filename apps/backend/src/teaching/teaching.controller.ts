import { Controller, Get, Post, Put, Body, UseGuards, Inject } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CurrentUser } from '../auth/current-user.decorator'
import type { User } from '@lumina/shared'
import { TeachingService } from './teaching.service'
import {
  SaveQuizRecordDto,
  BatchSaveQuizRecordDto,
  UpsertLearningProgressDto,
  BatchUpsertLearningProgressDto,
} from './dto/teaching.dto'

@ApiTags('Teaching')
@Controller('teaching')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TeachingController {
  constructor(@Inject(TeachingService) private readonly teachingService: TeachingService) {}

  // ---- Quiz Records ----

  @Post('quizzes')
  @ApiOperation({ summary: '保存单条测验记录' })
  saveQuizRecord(@CurrentUser() user: User, @Body() dto: SaveQuizRecordDto) {
    return this.teachingService.saveQuizRecord(user.id, dto)
  }

  @Post('quizzes/batch')
  @ApiOperation({ summary: '批量保存测验记录' })
  saveQuizRecords(@CurrentUser() user: User, @Body() dto: BatchSaveQuizRecordDto) {
    return this.teachingService.saveQuizRecords(user.id, dto.quizzes)
  }

  @Get('quizzes')
  @ApiOperation({ summary: '获取最近测验记录' })
  findQuizRecords(@CurrentUser() user: User) {
    return this.teachingService.findQuizRecords(user.id)
  }

  // ---- Learning Progress ----

  @Put('progress')
  @ApiOperation({ summary: '更新或创建学习进度' })
  upsertProgress(@CurrentUser() user: User, @Body() dto: UpsertLearningProgressDto) {
    return this.teachingService.upsertProgress(user.id, dto)
  }

  @Put('progress/batch')
  @ApiOperation({ summary: '批量更新学习进度' })
  upsertProgressBatch(@CurrentUser() user: User, @Body() dto: BatchUpsertLearningProgressDto) {
    return this.teachingService.upsertProgressBatch(user.id, dto.items)
  }

  @Get('progress')
  @ApiOperation({ summary: '获取学习进度列表' })
  findProgress(@CurrentUser() user: User) {
    return this.teachingService.findProgress(user.id)
  }

  // ---- Overview ----

  @Get('overview')
  @ApiOperation({ summary: '获取学习概览（测验总数、正确率、知识点）' })
  getOverview(@CurrentUser() user: User) {
    return this.teachingService.getOverview(user.id)
  }

  // ---- Export ----

  @Get('export')
  @ApiOperation({ summary: '导出所有教学数据' })
  exportAll(@CurrentUser() user: User) {
    return this.teachingService.exportAll(user.id)
  }
}
