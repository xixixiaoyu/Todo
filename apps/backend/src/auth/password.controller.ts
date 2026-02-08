import { Controller, Post, Body } from '@nestjs/common'
import { ApiTags, ApiOperation } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { AuthService } from './auth.service'
import { ForgotPasswordDto, ResetPasswordDto } from './auth.dto'

/**
 * 密码管理控制器
 */
@ApiTags('认证')
@Controller('auth')
export class PasswordController {
  constructor(private readonly authService: AuthService) {}

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
}
