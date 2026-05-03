import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Inject,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CurrentUser } from '../auth/current-user.decorator'
import type { User } from '@lumina/shared'
import { NovelService } from './novel.service'
import {
  CreateNovelDraftDto,
  UpdateNovelDraftDto,
  CreateNovelChapterDto,
  UpdateNovelChapterDto,
  UpsertNovelCharacterDto,
  UpsertNovelWorldviewDto,
} from './dto/novel.dto'

@ApiTags('Novel')
@Controller('novel')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NovelController {
  constructor(@Inject(NovelService) private readonly novelService: NovelService) {}

  // ---- Drafts ----

  @Post('drafts')
  @ApiOperation({ summary: '创建小说草稿' })
  createDraft(@CurrentUser() user: User, @Body() dto: CreateNovelDraftDto) {
    return this.novelService.createDraft(user.id, dto)
  }

  @Get('drafts')
  @ApiOperation({ summary: '获取所有小说草稿' })
  findAllDrafts(@CurrentUser() user: User) {
    return this.novelService.findAllDrafts(user.id)
  }

  @Get('drafts/:id')
  @ApiOperation({ summary: '获取单个小说草稿' })
  findDraft(@CurrentUser() user: User, @Param('id') id: string) {
    return this.novelService.findDraft(user.id, id)
  }

  @Patch('drafts/:id')
  @ApiOperation({ summary: '更新小说草稿' })
  updateDraft(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateNovelDraftDto,
  ) {
    return this.novelService.updateDraft(user.id, id, dto as unknown as Record<string, unknown>)
  }

  @Delete('drafts/:id')
  @ApiOperation({ summary: '删除小说草稿' })
  deleteDraft(@CurrentUser() user: User, @Param('id') id: string) {
    return this.novelService.deleteDraft(user.id, id)
  }

  @Get('drafts/:id/export')
  @ApiOperation({ summary: '导出小说草稿（含章节、角色、世界观）' })
  exportDraft(@CurrentUser() user: User, @Param('id') _id: string) {
    return this.novelService.exportAll(user.id)
  }

  // ---- Chapters ----

  @Post('drafts/:draftId/chapters')
  @ApiOperation({ summary: '创建章节' })
  createChapter(
    @CurrentUser() user: User,
    @Param('draftId') draftId: string,
    @Body() dto: CreateNovelChapterDto,
  ) {
    return this.novelService.createChapter(draftId, user.id, dto)
  }

  @Put('drafts/:draftId/chapters')
  @ApiOperation({ summary: '创建或更新章节 (upsert)' })
  upsertChapter(
    @CurrentUser() user: User,
    @Param('draftId') draftId: string,
    @Body() dto: CreateNovelChapterDto,
  ) {
    return this.novelService.upsertChapter(draftId, user.id, dto)
  }

  @Get('drafts/:draftId/chapters')
  @ApiOperation({ summary: '获取所有章节' })
  findChapters(@CurrentUser() user: User, @Param('draftId') draftId: string) {
    return this.novelService.findChapters(user.id, draftId)
  }

  @Get('drafts/:draftId/chapters/:chapterId')
  @ApiOperation({ summary: '获取单个章节' })
  findChapter(
    @CurrentUser() user: User,
    @Param('draftId') draftId: string,
    @Param('chapterId') chapterId: string,
  ) {
    return this.novelService.findChapter(user.id, draftId, chapterId)
  }

  @Patch('drafts/:draftId/chapters/:chapterId')
  @ApiOperation({ summary: '更新章节' })
  updateChapter(
    @CurrentUser() user: User,
    @Param('draftId') draftId: string,
    @Param('chapterId') chapterId: string,
    @Body() dto: UpdateNovelChapterDto,
  ) {
    return this.novelService.updateChapter(
      user.id,
      draftId,
      chapterId,
      dto as Record<string, unknown>,
    )
  }

  @Delete('drafts/:draftId/chapters/:chapterId')
  @ApiOperation({ summary: '删除章节' })
  deleteChapter(
    @CurrentUser() user: User,
    @Param('draftId') draftId: string,
    @Param('chapterId') chapterId: string,
  ) {
    return this.novelService.deleteChapter(user.id, draftId, chapterId)
  }

  // ---- Characters ----

  @Put('drafts/:draftId/characters')
  @ApiOperation({ summary: '创建或更新角色 (upsert)' })
  upsertCharacter(
    @CurrentUser() user: User,
    @Param('draftId') draftId: string,
    @Body() dto: UpsertNovelCharacterDto,
  ) {
    return this.novelService.upsertCharacter(draftId, user.id, dto)
  }

  @Get('drafts/:draftId/characters')
  @ApiOperation({ summary: '获取所有角色' })
  findCharacters(@CurrentUser() user: User, @Param('draftId') draftId: string) {
    return this.novelService.findCharacters(user.id, draftId)
  }

  @Delete('drafts/:draftId/characters/:characterId')
  @ApiOperation({ summary: '删除角色' })
  deleteCharacter(
    @CurrentUser() user: User,
    @Param('draftId') draftId: string,
    @Param('characterId') characterId: string,
  ) {
    return this.novelService.deleteCharacter(user.id, draftId, characterId)
  }

  // ---- Worldviews ----

  @Put('drafts/:draftId/worldviews')
  @ApiOperation({ summary: '创建或更新世界观 (upsert)' })
  upsertWorldview(
    @CurrentUser() user: User,
    @Param('draftId') draftId: string,
    @Body() dto: UpsertNovelWorldviewDto,
  ) {
    return this.novelService.upsertWorldview(draftId, user.id, dto)
  }

  @Get('drafts/:draftId/worldviews')
  @ApiOperation({ summary: '获取所有世界观' })
  findWorldviews(@CurrentUser() user: User, @Param('draftId') draftId: string) {
    return this.novelService.findWorldviews(user.id, draftId)
  }

  @Delete('drafts/:draftId/worldviews/:settingId')
  @ApiOperation({ summary: '删除世界观' })
  deleteWorldview(
    @CurrentUser() user: User,
    @Param('draftId') draftId: string,
    @Param('settingId') settingId: string,
  ) {
    return this.novelService.deleteWorldview(user.id, draftId, settingId)
  }
}
