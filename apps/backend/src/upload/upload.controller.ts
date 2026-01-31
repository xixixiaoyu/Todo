import {
  Controller,
  Post,
  Delete,
  Param,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  BadRequestException,
  UseGuards,
} from '@nestjs/common'
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express'
import { ApiTags, ApiOperation, ApiConsumes, ApiBody, ApiBearerAuth } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth'
import { StorageService, UploadResult } from './storage.service'
import { FileParsingService } from './file-parsing.service'

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
  @UseInterceptors(FileInterceptor('file'))
  async uploadSingle(@UploadedFile() file: Express.Multer.File): Promise<UploadResult> {
    if (!file) {
      throw new BadRequestException('upload.FILE_REQUIRED')
    }
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
  @UseInterceptors(FileInterceptor('file'))
  async parseFile(@UploadedFile() file: Express.Multer.File): Promise<{ content: string }> {
    if (!file) {
      throw new BadRequestException('upload.FILE_REQUIRED')
    }
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
  @UseInterceptors(FilesInterceptor('files', 10))
  async uploadMultiple(@UploadedFiles() files: Express.Multer.File[]): Promise<UploadResult[]> {
    if (!files || files.length === 0) {
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
