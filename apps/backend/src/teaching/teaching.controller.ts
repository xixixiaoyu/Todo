import { Controller, Get, Post, Put, Body, Inject } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { TeachingService } from './teaching.service'
import {
  SaveQuizRecordDto,
  BatchSaveQuizRecordDto,
  UpsertLearningProgressDto,
  BatchUpsertLearningProgressDto,
} from './dto/teaching.dto'

@ApiTags('Teaching')
@Controller('teaching')
@ApiBearerAuth()
export class TeachingController {
  constructor(@Inject(TeachingService) private readonly teachingService: TeachingService) {}

  // ---- Quiz Records ----

  @Post('quizzes')
  @ApiOperation({ summary: '保存单条测验记录' })
  saveQuizRecord(@Body() dto: SaveQuizRecordDto) {
    return this.teachingService.saveQuizRecord(0, dto)
  }

  @Post('quizzes/batch')
  @ApiOperation({ summary: '批量保存测验记录' })
  saveQuizRecords(@Body() dto: BatchSaveQuizRecordDto) {
    return this.teachingService.saveQuizRecords(0, dto.quizzes)
  }

  @Get('quizzes')
  @ApiOperation({ summary: '获取最近测验记录' })
  findQuizRecords() {
    return this.teachingService.findQuizRecords(0)
  }

  // ---- Learning Progress ----

  @Put('progress')
  @ApiOperation({ summary: '更新或创建学习进度' })
  upsertProgress(@Body() dto: UpsertLearningProgressDto) {
    return this.teachingService.upsertProgress(0, dto)
  }

  @Put('progress/batch')
  @ApiOperation({ summary: '批量更新学习进度' })
  upsertProgressBatch(@Body() dto: BatchUpsertLearningProgressDto) {
    return this.teachingService.upsertProgressBatch(0, dto.items)
  }

  @Get('progress')
  @ApiOperation({ summary: '获取学习进度列表' })
  findProgress() {
    return this.teachingService.findProgress(0)
  }

  // ---- Overview ----

  @Get('overview')
  @ApiOperation({ summary: '获取学习概览（测验总数、正确率、知识点）' })
  getOverview() {
    return this.teachingService.getOverview(0)
  }

  // ---- Export ----

  @Get('export')
  @ApiOperation({ summary: '导出所有教学数据' })
  exportAll() {
    return this.teachingService.exportAll(0)
  }
}
