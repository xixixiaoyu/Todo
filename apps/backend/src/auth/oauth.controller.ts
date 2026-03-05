import { Controller, Get, UseGuards, Res } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { AuthGuard } from '@nestjs/passport'
import { ConfigService } from '@nestjs/config'
import { AuthService } from './auth.service'
import { JwtAuthGuard } from './jwt-auth.guard'
import { CurrentUser } from './current-user.decorator'
import type { User, AuthResponse } from '@lumina/shared'
import type { FastifyReplyWithCookie } from '../common'

/**
 * OAuth 认证控制器
 */
@ApiTags('认证')
@Controller('auth')
export class OAuthController {
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
  async googleAuthRedirect(@CurrentUser() user: User, @Res() res: FastifyReplyWithCookie) {
    const authResponse = await this.authService.googleLogin(user)

    const isProduction = this.configService.get<string>('NODE_ENV') === 'production'
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax' as const,
    }

    res.setCookie('accessToken', authResponse.accessToken, {
      ...cookieOptions,
      maxAge: (authResponse.expiresIn || 900) * 1000,
    })

    if (authResponse.refreshToken) {
      res.setCookie('refreshToken', authResponse.refreshToken, {
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
    @Res({ passthrough: true }) res: FastifyReplyWithCookie,
  ): Promise<AuthResponse> {
    const response = await this.authService.googleLogin(user)

    // 成功获取令牌后立即清除 Cookie，防止 CSRF 风险
    res.clearCookie('accessToken')
    res.clearCookie('refreshToken')

    return response
  }
}
