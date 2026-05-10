import {
  Controller,
  Post,
  Delete,
  Param,
  BadRequestException,
  UseGuards,
  Req,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiConsumes, ApiBody, ApiBearerAuth } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { StorageService } from './storage.service'
import type { UploadResult, UploadedFile } from './storage.service'
import { FileParsingService } from './file-parsing.service'
import { ALLOWED_UPLOAD_EXTENSIONS, ALLOWED_UPLOAD_MIME_TYPES } from './upload.constants'
import type { FastifyRequestWithMultipart, MultipartFile } from '../common'
import { FILE_PARSE_THROTTLE, FILE_UPLOAD_THROTTLE } from '../common'

/**
 * 文件上传控制器
 */
@ApiTags('上传')
@Controller('upload')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UploadController {
  constructor(
    private readonly storageService: StorageService,
    private readonly fileParsingService: FileParsingService,
  ) {}

  /**
   * 将 Fastify MultipartFile 转换为通用 UploadedFile 格式
   */
  private async toUploadedFile(part: MultipartFile): Promise<UploadedFile> {
    const buffer = await part.toBuffer()
    const originalname = part.filename
    const mimetype = part.mimetype

    this.ensureAllowedFile(originalname, mimetype)

    return {
      originalname,
      mimetype,
      size: buffer.length,
      buffer,
    }
  }

  /**
   * 检查文件类型是否允许
   */
  private ensureAllowedFile(originalname: string, mimetype: string) {
    const fileName = originalname.trim().toLowerCase()
    const hasAllowedExt = ALLOWED_UPLOAD_EXTENSIONS.some((ext) => fileName.endsWith(`.${ext}`))

    if (
      ALLOWED_UPLOAD_MIME_TYPES.includes(mimetype as (typeof ALLOWED_UPLOAD_MIME_TYPES)[number]) ||
      hasAllowedExt
    ) {
      return
    }

    throw new BadRequestException('upload.UNSUPPORTED_FILE_TYPE')
  }

  /**
   * 上传单个文件
   */
  @Post('single')
  @Throttle(FILE_UPLOAD_THROTTLE)
  @ApiOperation({ summary: '上传单个文件' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  async uploadSingle(@Req() req: FastifyRequestWithMultipart): Promise<UploadResult> {
    const part = await req.file()
    if (!part || part.fieldname !== 'file') {
      throw new BadRequestException('upload.FILE_REQUIRED')
    }

    const file = await this.toUploadedFile(part)
    return this.storageService.upload(file)
  }

  /**
   * 解析文件内容
   */
  @Post('parse')
  @Throttle(FILE_PARSE_THROTTLE)
  @ApiOperation({ summary: '解析文件内容' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  async parseFile(@Req() req: FastifyRequestWithMultipart): Promise<{ content: string }> {
    const part = await req.file()
    if (!part || part.fieldname !== 'file') {
      throw new BadRequestException('upload.FILE_REQUIRED')
    }

    const file = await this.toUploadedFile(part)
    const content = await this.fileParsingService.parseFile(file)
    return { content }
  }

  /**
   * 上传多个文件
   */
  @Post('multiple')
  @Throttle(FILE_UPLOAD_THROTTLE)
  @ApiOperation({ summary: '上传多个文件（最多 10 个）' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  async uploadMultiple(@Req() req: FastifyRequestWithMultipart): Promise<UploadResult[]> {
    const files: UploadedFile[] = []

    for await (const part of req.files()) {
      if (part.fieldname !== 'files') continue
      files.push(await this.toUploadedFile(part))
    }

    if (files.length === 0) {
      throw new BadRequestException('upload.FILE_REQUIRED')
    }

    return this.storageService.uploadMany(files)
  }

  /**
   * 删除文件
   */
  @Delete(':key')
  @ApiOperation({ summary: '删除文件' })
  async delete(@Param('key') key: string): Promise<{ success: boolean }> {
    await this.storageService.delete(key)
    return { success: true }
  }
}
