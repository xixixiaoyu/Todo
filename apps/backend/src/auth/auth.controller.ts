import { Controller, Post, Body, Get, UseGuards, Res } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { Throttle, SkipThrottle } from '@nestjs/throttler'
import { AuthService } from './auth.service'
import { JwtAuthGuard } from './jwt-auth.guard'
import { CurrentUser } from './current-user.decorator'
import { LoginDto, RegisterDto, RefreshTokenDto, LogoutDto } from './auth.dto'
import type { User, AuthResponse } from '@my-app/shared'

type CookieReply = {
  clearCookie: (name: string) => unknown
}

/**
 * 核心认证控制器
 */
@ApiTags('认证')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * 用户登录
   * 限制: 每分钟最多 5 次尝试（防止暴力破解）
   */
  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: '用户登录' })
  async login(@Body() loginDto: LoginDto): Promise<AuthResponse> {
    return this.authService.login(loginDto)
  }

  /**
   * 用户注册
   * 限制: 每分钟最多 3 次尝试
   */
  @Post('register')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({ summary: '用户注册' })
  async register(@Body() registerDto: RegisterDto): Promise<AuthResponse> {
    return this.authService.register(registerDto)
  }

  /**
   * 刷新访问令牌
   */
  @Post('refresh')
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 刷新令牌限制
  @ApiOperation({ summary: '刷新访问令牌' })
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto): Promise<AuthResponse> {
    return this.authService.refreshToken(refreshTokenDto.refreshToken)
  }

  /**
   * 获取当前用户信息
   */
  @Get('me')
  @SkipThrottle()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取当前用户信息' })
  async getProfile(@CurrentUser() user: User): Promise<User> {
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
    @Res({ passthrough: true }) res: CookieReply,
  ): Promise<{ message: string }> {
    await this.authService.logout(logoutDto.refreshToken)

    // 清除 Cookie
    res.clearCookie('accessToken')
    res.clearCookie('refreshToken')

    return { message: '登出成功' }
  }
}
