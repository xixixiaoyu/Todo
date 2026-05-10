import { Injectable, UnauthorizedException, Inject, forwardRef } from '@nestjs/common'
import { UsersService } from '../users/users.service'
import { formatUser } from '@lumina/shared'
import type { LoginInput, RegisterInput, User, AuthResponse } from '@lumina/shared'
import { TokenService, JwtPayload } from './token.service'
import { PasswordService } from './password.service'

/**
 * 认证服务 (Facade)
 * 整合 TokenService, PasswordService 提供统一接口
 */
@Injectable()
export class AuthService {
  constructor(
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
    @Inject(TokenService)
    private readonly tokenService: TokenService,
    @Inject(PasswordService)
    private readonly passwordService: PasswordService,
  ) {}

  /**
   * 传统密码登录相关
   */
  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.usersService.findInternalByEmail(email)

    if (!user || !user.password) {
      return null
    }

    const isPasswordValid = await this.passwordService.compare(password, user.password)
    if (!isPasswordValid) {
      return null
    }

    return formatUser(user)
  }

  async login(loginDto: LoginInput): Promise<AuthResponse> {
    const user = await this.validateUser(loginDto.email, loginDto.password)

    if (!user) {
      throw new UnauthorizedException('auth.INVALID_CREDENTIALS')
    }

    return this.tokenService.buildAuthResponse(user)
  }

  async register(registerDto: RegisterInput): Promise<AuthResponse> {
    const user = await this.usersService.create(registerDto)
    return this.tokenService.buildAuthResponse(user)
  }

  /**
   * 令牌刷新与登出
   */
  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    try {
      const isBlacklisted = await this.tokenService.isBlacklisted(refreshToken)
      if (isBlacklisted) {
        throw new UnauthorizedException('auth.INVALID_REFRESH_TOKEN')
      }

      const payload = this.tokenService.verifyToken<JwtPayload>(refreshToken)

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('auth.INVALID_REFRESH_TOKEN')
      }

      const isInvalidated = await this.tokenService.isUserSessionInvalidated(
        payload.sub,
        payload.iat,
      )
      if (isInvalidated) {
        throw new UnauthorizedException('auth.INVALID_REFRESH_TOKEN')
      }

      const user = await this.usersService.findOne(payload.sub)
      if (!user) {
        throw new UnauthorizedException('auth.USER_NOT_FOUND')
      }

      return this.tokenService.buildAuthResponse(user)
    } catch (error) {
      // 确保所有异常都被转换为 UnauthorizedException，避免 500 错误
      if (error instanceof UnauthorizedException) {
        throw error
      }
      throw new UnauthorizedException('auth.INVALID_REFRESH_TOKEN')
    }
  }

  async logout(refreshToken: string): Promise<void> {
    try {
      await this.tokenService.blacklistToken(refreshToken)
    } catch {
      // 忽略黑名单操作失败，确保登出接口始终成功
    }
  }

  /**
   * 密码重置相关
   */
  async requestPasswordReset(email: string): Promise<void> {
    await this.passwordService.requestReset(email)
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    await this.passwordService.reset(token, newPassword)
  }

  // 辅助方法（保留以防万一，但建议直接使用相应服务）
  async hashPassword(password: string): Promise<string> {
    return this.passwordService.hash(password)
  }

  async getUserById(userId: number): Promise<User | null> {
    try {
      return await this.usersService.findOne(userId)
    } catch {
      return null
    }
  }
}
