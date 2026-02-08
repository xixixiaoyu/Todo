import { Injectable, BadRequestException, Inject, forwardRef } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as bcrypt from 'bcryptjs'
import * as crypto from 'crypto'
import { UsersService } from '../users/users.service'
import { MailService } from '../mail/mail.service'

@Injectable()
export class PasswordService {
  constructor(
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {}

  /**
   * 哈希密码
   */
  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, 10)
  }

  /**
   * 比较密码
   */
  async compare(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash)
  }

  /**
   * 请求密码重置
   */
  async requestReset(email: string): Promise<void> {
    const user = await this.usersService.findInternalByEmail(email)

    // 防止枚举攻击
    if (!user) {
      return
    }

    const { token, hashedToken } = this.generateResetToken()
    const expiresAt = new Date(
      Date.now() + this.configService.get<number>('RESET_PASSWORD_EXPIRES_IN', 3600) * 1000,
    )

    await this.usersService.update(user.id, {
      resetPasswordToken: hashedToken,
      resetPasswordExpires: expiresAt,
    })

    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:5173')
    const resetLink = `${frontendUrl}/reset-password?token=${token}`

    await this.mailService.sendPasswordReset(email, resetLink)
  }

  /**
   * 重置密码
   */
  async reset(token: string, newPassword: string): Promise<void> {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex')

    const user = await this.usersService.findInternalFirst({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: {
        gt: new Date(),
      },
    })

    if (!user) {
      throw new BadRequestException('auth.INVALID_RESET_TOKEN')
    }

    const hashedPassword = await this.hash(newPassword)

    await this.usersService.update(user.id, {
      password: hashedPassword,
      resetPasswordToken: null,
      resetPasswordExpires: null,
    })
  }

  /**
   * 生成重置令牌
   */
  private generateResetToken(): { token: string; hashedToken: string } {
    const token = crypto.randomBytes(32).toString('hex')
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex')
    return { token, hashedToken }
  }
}
