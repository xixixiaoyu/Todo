import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger'
import { UsersService } from './users.service'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RegisterDto } from '../auth/auth.dto'
import { CurrentUser } from '../auth/current-user.decorator'
import { StorageService } from '../upload/storage.service'
import { ALLOWED_UPLOAD_EXTENSIONS, ALLOWED_UPLOAD_MIME_TYPES } from '../upload/upload.constants'
import type { FastifyRequestWithMultipart } from '../common'
import type { User } from '@lumina/shared'

/**
 * 用户控制器
 * 处理用户相关的 HTTP 请求
 */
@ApiTags('用户')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly storageService: StorageService,
  ) {}

  /**
   * 获取所有用户（需要认证）
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取所有用户' })
  async findAll(): Promise<User[]> {
    return this.usersService.findAll()
  }

  /**
   * 获取当前登录用户信息
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取当前登录用户信息' })
  async findMe(@CurrentUser() user: User): Promise<User> {
    return user
  }

  /**
   * 上传用户头像
   */
  @Post('avatar')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '上传用户头像' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  async uploadAvatar(
    @Req() req: FastifyRequestWithMultipart,
    @CurrentUser() user: User,
  ): Promise<User> {
    const part = await req.file()
    if (!part || part.fieldname !== 'file') {
      throw new BadRequestException('upload.FILE_REQUIRED')
    }

    const buffer = await part.toBuffer()
    const fileName = part.filename.trim().toLowerCase()
    const mimetype = part.mimetype

    const hasAllowedExt = ALLOWED_UPLOAD_EXTENSIONS.some((ext) => fileName.endsWith(`.${ext}`))
    const isAllowedMime = ALLOWED_UPLOAD_MIME_TYPES.includes(
      mimetype as (typeof ALLOWED_UPLOAD_MIME_TYPES)[number],
    )

    if (!hasAllowedExt && !isAllowedMime) {
      throw new BadRequestException('upload.UNSUPPORTED_FILE_TYPE')
    }

    // 如果用户已有头像且是本地存储，先尝试删除旧头像以节省空间
    if (user.avatar && user.avatar.startsWith('/api/public/avatars/')) {
      const oldKey = user.avatar.replace('/api/public/', '')
      await this.storageService.deleteLocal(oldKey)
    }

    const result = await this.storageService.uploadLocal(
      {
        originalname: part.filename,
        mimetype: part.mimetype,
        size: buffer.length,
        buffer,
      },
      'avatars',
    )

    return this.usersService.updateAvatar(user.id, result.url)
  }

  /**
   * 根据 ID 获取单个用户（需要认证）
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取单个用户' })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<User> {
    return this.usersService.findOne(id)
  }

  /**
   * 创建新用户（注册）
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '创建新用户' })
  async create(@Body() createUserDto: RegisterDto): Promise<User> {
    return this.usersService.create(createUserDto)
  }
}
