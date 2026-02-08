import { Controller, Post, Body, Get, UseGuards } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import type { RegistrationResponseJSON, AuthenticationResponseJSON } from '@simplewebauthn/server'
import { AuthService } from './auth.service'
import { JwtAuthGuard } from './jwt-auth.guard'
import { CurrentUser } from './current-user.decorator'
import type { User } from '@my-app/shared'

/**
 * Passkey 认证控制器
 */
@ApiTags('认证')
@Controller('auth')
export class PasskeyController {
  constructor(private readonly authService: AuthService) {}

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
}
