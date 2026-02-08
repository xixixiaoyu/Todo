import { Controller, Post, Body, Get, UseGuards, Res } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { Throttle, SkipThrottle } from '@nestjs/throttler'
import { AuthGuard } from '@nestjs/passport'
import { ConfigService } from '@nestjs/config'
import type { Response } from 'express'
import type { RegistrationResponseJSON, AuthenticationResponseJSON } from '@simplewebauthn/server'
import { AuthService } from './auth.service'
import { JwtAuthGuard } from './jwt-auth.guard'
import { CurrentUser } from './current-user.decorator'
import {
  LoginDto,
  RegisterDto,
  RefreshTokenDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  LogoutDto,
} from './auth.dto'
import type { User, AuthResponse } from '@my-app/shared'

/**
 * 认证控制器
 */
@ApiTags('认证')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Google OAuth 登录
   */
  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Google OAuth 登录' })
  async googleAuth() {
    // 自动重定向到 Google
  }

  /**
   * Google OAuth 回调
   */
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Google OAuth 回调' })
  async googleAuthRedirect(@CurrentUser() user: User, @Res() res: Response) {
    const authResponse = await this.authService.googleLogin(user)

    const isProduction = this.configService.get<string>('NODE_ENV') === 'production'
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax' as const,
    }

    res.cookie('accessToken', authResponse.accessToken, {
      ...cookieOptions,
      maxAge: (authResponse.expiresIn || 900) * 1000,
    })

    if (authResponse.refreshToken) {
      res.cookie('refreshToken', authResponse.refreshToken, {
        ...cookieOptions,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      })
    }

    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:5173')
    res.redirect(`${frontendUrl}/auth/callback`)
  }

  /**
   * OAuth 登录
   * 前端重定向到 /auth/callback 后，调用此接口从 Cookie 获取令牌并返回给前端 Store
   */
  @Get('oauth/login')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'OAuth 登录' })
  async oauthLogin(
    @CurrentUser() user: User,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const response = await this.authService.googleLogin(user)

    // 成功获取令牌后立即清除 Cookie，防止 CSRF 风险
    res.clearCookie('accessToken')
    res.clearCookie('refreshToken')

    return response
  }

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
   * 生成 Passkey 注册选项
   */
  @Get('passkey/register/options')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '生成 Passkey 注册选项' })
  async generatePasskeyRegistrationOptions(@CurrentUser() user: User) {
    return this.authService.generatePasskeyRegistrationOptions(user)
  }

  /**
   * 验证 Passkey 注册响应
   */
  @Post('passkey/register/verify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '验证 Passkey 注册响应' })
  async verifyPasskeyRegistration(
    @CurrentUser() user: User,
    @Body() body: { response: RegistrationResponseJSON; name?: string },
  ) {
    return this.authService.verifyPasskeyRegistration(user, body.response, body.name)
  }

  /**
   * 生成 Passkey 认证选项
   */
  @Post('passkey/login/options')
  @ApiOperation({ summary: '生成 Passkey 认证选项' })
  async generatePasskeyAuthenticationOptions(@Body('email') email: string) {
    return this.authService.generatePasskeyAuthenticationOptions(email)
  }

  /**
   * 验证 Passkey 认证响应
   */
  @Post('passkey/login/verify')
  @ApiOperation({ summary: '验证 Passkey 认证响应' })
  async verifyPasskeyAuthentication(
    @Body() body: { email: string; response: AuthenticationResponseJSON },
  ) {
    return this.authService.verifyPasskeyAuthentication(body.email, body.response)
  }

  /**
   * 请求密码重置
   * 限制: 每分钟最多 3 次尝试
   */
  @Post('forgot-password')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({ summary: '请求密码重置' })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto): Promise<{ message: string }> {
    await this.authService.requestPasswordReset(forgotPasswordDto.email)
    return { message: '如果该邮箱已注册，重置链接已发送到您的邮箱' }
  }

  /**
   * 重置密码
   * 限制: 每分钟最多 5 次尝试
   */
  @Post('reset-password')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: '重置密码' })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto): Promise<{ message: string }> {
    await this.authService.resetPassword(resetPasswordDto.token, resetPasswordDto.password)
    return { message: '密码重置成功，请使用新密码登录' }
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
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    await this.authService.logout(logoutDto.refreshToken)

    // 清除 Cookie
    res.clearCookie('accessToken')
    res.clearCookie('refreshToken')

    return { message: '登出成功' }
  }
}
