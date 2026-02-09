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
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { StorageService, type UploadResult, type UploadedFile } from './storage.service'
import { FileParsingService } from './file-parsing.service'

type MultipartFile = {
  fieldname: string
  filename: string
  mimetype: string
  toBuffer: () => Promise<Buffer>
}

type MultipartRequest = {
  file: () => Promise<MultipartFile | undefined>
  files: () => AsyncIterableIterator<MultipartFile>
}

/**
 * 文件上传控制器
 */
@ApiTags('上传')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('upload')
export class UploadController {
  constructor(
    private readonly storageService: StorageService,
    private readonly fileParsingService: FileParsingService,
  ) {}

  private ensureAllowedFile(originalname: string, mimetype: string) {
    const allowedMimes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/markdown',
      'application/json',
      'text/csv',
    ]

    if (
      allowedMimes.includes(mimetype) ||
      mimetype.startsWith('text/') ||
      originalname.match(/\.(ts|js|py|go|java|c|cpp|h|hpp|rs|json|md|txt)$/i)
    ) {
      return
    }

    throw new BadRequestException(`不支持的文件类型: ${mimetype}`)
  }

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
   * 上传单个文件
   */
  @Post('single')
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
  async uploadSingle(@Req() req: MultipartRequest): Promise<UploadResult> {
    const part = await req.file()
    if (!part || part.fieldname !== 'file') {
      throw new BadRequestException('upload.FILE_REQUIRED')
    }

    const file = await this.toUploadedFile(part)
    return this.storageService.upload(file)
  }

  /**
   * 解析文件内容
   * 上传文件并直接返回提取出的文本，不保存到存储服务
   */
  @Post('parse')
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
  async parseFile(@Req() req: MultipartRequest): Promise<{ content: string }> {
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
  async uploadMultiple(@Req() req: MultipartRequest): Promise<UploadResult[]> {
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
