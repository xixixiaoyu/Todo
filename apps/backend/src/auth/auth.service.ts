import { Injectable, UnauthorizedException, Inject, forwardRef } from '@nestjs/common'
import type { RegistrationResponseJSON, AuthenticationResponseJSON } from '@simplewebauthn/server'
import { UsersService } from '../users/users.service'
import type { LoginInput, RegisterInput, User, AuthResponse, PrismaUser } from '@lumina/shared'
import { formatUser } from '@lumina/shared'
import { TokenService, JwtPayload } from './token.service'
import { PasskeyService } from './passkey.service'
import { PasswordService } from './password.service'

export interface GoogleProfile {
  id: string
  emails: Array<{ value: string }>
  displayName: string
  photos?: Array<{ value: string }>
}

/**
 * 认证服务 (Facade)
 * 整合 TokenService, PasskeyService, PasswordService 提供统一接口
 */
@Injectable()
export class AuthService {
  constructor(
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
    @Inject(TokenService)
    private readonly tokenService: TokenService,
    @Inject(PasskeyService)
    private readonly passkeyService: PasskeyService,
    @Inject(PasswordService)
    private readonly passwordService: PasswordService,
  ) {}

  /**
   * Passkey 相关
   */
  async generatePasskeyRegistrationOptions(user: User) {
    return this.passkeyService.generateRegistrationOptions(user)
  }

  async verifyPasskeyRegistration(user: User, body: RegistrationResponseJSON, name?: string) {
    return this.passkeyService.verifyRegistration(user, body, name)
  }

  async generatePasskeyAuthenticationOptions(email: string) {
    return this.passkeyService.generateAuthenticationOptions(email)
  }

  async verifyPasskeyAuthentication(email: string, body: AuthenticationResponseJSON) {
    const result = await this.passkeyService.verifyAuthentication(email, body)
    return this.tokenService.buildAuthResponse(formatUser(result.user))
  }

  /**
   * Google OAuth 相关
   */
  async validateGoogleUser(profile: GoogleProfile): Promise<User> {
    const { id, emails, displayName, photos } = profile
    const email = emails[0].value

    const existingUser = await this.usersService.findInternalByEmail(email)

    if (!existingUser) {
      return this.usersService.createWithGoogle({
        email,
        name: displayName,
        googleId: id,
        avatar: photos?.[0]?.value,
      })
    }

    if (!existingUser.googleId) {
      const updatedUser = await this.usersService.update(existingUser.id, {
        googleId: id,
        avatar: existingUser.avatar || photos?.[0]?.value,
      })
      return formatUser(updatedUser as unknown as PrismaUser)
    }

    return formatUser(existingUser as unknown as PrismaUser)
  }

  async googleLogin(user: User): Promise<AuthResponse> {
    return this.tokenService.buildAuthResponse(user)
  }

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
