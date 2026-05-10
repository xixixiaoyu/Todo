import { Controller, Post, Body, Get, UseGuards, Res, Inject } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { AuthService } from './auth.service'
import { JwtAuthGuard } from './jwt-auth.guard'
import { CurrentUser } from './current-user.decorator'
import { LoginDto, RegisterDto, RefreshTokenDto, LogoutDto } from './auth.dto'
import type { User, AuthResponse } from '@lumina/shared'
import { AUTH_LOGIN_THROTTLE, AUTH_REFRESH_THROTTLE, AUTH_REGISTER_THROTTLE } from '../common'
import type { FastifyReplyWithCookie } from '../common'

/**
 * 用户认证控制器
 */
@ApiTags('认证')
@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  /**
   * 用户登录
   */
  @Post('login')
  @Throttle(AUTH_LOGIN_THROTTLE)
  @ApiOperation({ summary: '用户登录' })
  async login(@Body() loginDto: LoginDto): Promise<AuthResponse> {
    return this.authService.login(loginDto)
  }

  /**
   * 用户注册
   */
  @Post('register')
  @Throttle(AUTH_REGISTER_THROTTLE)
  @ApiOperation({ summary: '用户注册' })
  async register(@Body() registerDto: RegisterDto): Promise<AuthResponse> {
    return this.authService.register(registerDto)
  }

  /**
   * 刷新访问令牌
   */
  @Post('refresh')
  @Throttle(AUTH_REFRESH_THROTTLE)
  @ApiOperation({ summary: '刷新访问令牌' })
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto): Promise<AuthResponse> {
    return this.authService.refreshToken(refreshTokenDto.refreshToken)
  }

  /**
   * 获取当前用户信息
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取当前用户信息' })
  async getMe(@CurrentUser() user: User): Promise<User> {
    return user
  }

  /**
   * 用户登出
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '用户登出' })
  async logout(
    @Body() logoutDto: LogoutDto,
    @Res({ passthrough: true }) res: FastifyReplyWithCookie,
  ): Promise<{ message: string }> {
    await this.authService.logout(logoutDto.refreshToken)

    // 清除 Cookie
    res.clearCookie('accessToken')
    res.clearCookie('refreshToken')

    return { message: '登出成功' }
  }
}
