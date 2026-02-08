import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server'
import type {
  AuthenticatorTransportFuture,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/server'
import { isoBase64URL } from '@simplewebauthn/server/helpers'
import { Authenticator, Prisma } from '../generated/client'
import { UsersService } from '../users/users.service'
import { MailService } from '../mail/mail.service'
import { RedisService, CachePrefix } from '../redis/redis.service'
import { PrismaService } from '../prisma/prisma.service'
import * as bcrypt from 'bcryptjs'
import * as crypto from 'crypto'
import type { LoginInput, RegisterInput, User, AuthResponse } from '@my-app/shared'
import { formatUser } from '@my-app/shared'

interface JwtPayload {
  sub: number
  email: string
  type: 'access' | 'refresh'
  exp?: number
}

/**
 * 认证服务
 * 处理用户登录、注册和 JWT 令牌生成
 * 支持短期访问令牌 + 长期刷新令牌
 */
@Injectable()
export class AuthService {
  private readonly accessTokenExpiresIn: number // 访问令牌过期时间（秒）
  private readonly refreshTokenExpiresIn: number // 刷新令牌过期时间（秒）

  /**
   * 生成 WebAuthn 注册选项
   */
  async generatePasskeyRegistrationOptions(user: User) {
    const userAuthenticators = await this.prismaService.authenticator.findMany({
      where: { userId: user.id },
    })

    const rpName = this.configService.get<string>('APP_NAME', 'Todo App')
    const rpID = this.configService.get<string>('RP_ID', 'localhost')

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: Buffer.from(user.id.toString()),
      userName: user.email,
      userDisplayName: user.name,
      attestationType: 'none',
      excludeCredentials: userAuthenticators.map((auth: Authenticator) => ({
        id: isoBase64URL.fromBuffer(auth.credentialID),
        type: 'public-key',
        transports: auth.transports
          ? (JSON.parse(auth.transports) as AuthenticatorTransportFuture[])
          : undefined,
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    })

    // 存储 challenge 到 Redis 用于验证
    await this.redisService.set(`passkey-registration:${user.id}`, options.challenge, {
      prefix: CachePrefix.AUTH,
      ttl: 300, // 5 分钟
    })

    return options
  }

  /**
   * 验证 WebAuthn 注册响应
   */
  async verifyPasskeyRegistration(user: User, body: RegistrationResponseJSON, name?: string) {
    // 验证 challenge 是否存在且有效
    const expectedChallenge = await this.redisService.get(`passkey-registration:${user.id}`, {
      prefix: CachePrefix.AUTH,
    })

    if (typeof expectedChallenge !== 'string') {
      throw new BadRequestException('auth.CHALLENGE_EXPIRED')
    }

    const rpID = this.configService.get<string>('RP_ID', 'localhost')
    const origin = this.configService.get<string>('FRONTEND_URL', 'http://localhost:5173')

    const verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    })

    if (verification.verified && verification.registrationInfo) {
      const { credential } = verification.registrationInfo

      await this.prismaService.authenticator.create({
        data: {
          id: credential.id,
          credentialID: Buffer.from(isoBase64URL.toBuffer(credential.id)),
          credentialPublicKey: Buffer.from(credential.publicKey),
          counter: credential.counter,
          credentialDeviceType: verification.registrationInfo.credentialDeviceType,
          credentialBackedUp: verification.registrationInfo.credentialBackedUp,
          userId: user.id,
          name: name || 'Passkey',
          transports: body.response.transports
            ? JSON.stringify(body.response.transports)
            : undefined,
        } as Prisma.AuthenticatorUncheckedCreateInput,
      })

      return { success: true }
    }

    throw new BadRequestException('auth.REGISTRATION_FAILED')
  }

  /**
   * 生成 WebAuthn 认证选项
   */
  async generatePasskeyAuthenticationOptions(email: string) {
    const user = await this.usersService.findInternalByEmail(email)
    if (!user) {
      throw new BadRequestException('auth.USER_NOT_FOUND')
    }

    const userAuthenticators = await this.prismaService.authenticator.findMany({
      where: { userId: user.id },
    })

    const rpID = this.configService.get<string>('RP_ID', 'localhost')

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: userAuthenticators.map((auth: Authenticator) => ({
        id: isoBase64URL.fromBuffer(auth.credentialID),
        type: 'public-key',
        transports: auth.transports
          ? (JSON.parse(auth.transports) as AuthenticatorTransportFuture[])
          : undefined,
      })),
      userVerification: 'preferred',
    })

    // 存储 challenge 到 Redis 用于验证
    await this.redisService.set(`passkey-authentication:${email}`, options.challenge, {
      prefix: CachePrefix.AUTH,
      ttl: 300,
    })

    return options
  }

  /**
   * 验证 WebAuthn 认证响应
   */
  async verifyPasskeyAuthentication(email: string, body: AuthenticationResponseJSON) {
    const user = await this.usersService.findInternalByEmail(email)
    if (!user) {
      throw new BadRequestException('auth.USER_NOT_FOUND')
    }

    const expectedChallenge = await this.redisService.get(`passkey-authentication:${email}`, {
      prefix: CachePrefix.AUTH,
    })

    if (typeof expectedChallenge !== 'string') {
      throw new BadRequestException('auth.CHALLENGE_EXPIRED')
    }

    const authenticator = await this.prismaService.authenticator.findUnique({
      where: { id: body.id },
    })

    if (!authenticator) {
      throw new BadRequestException('auth.AUTHENTICATOR_NOT_FOUND')
    }

    const rpID = this.configService.get<string>('RP_ID', 'localhost')
    const origin = this.configService.get<string>('FRONTEND_URL', 'http://localhost:5173')

    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: isoBase64URL.fromBuffer(authenticator.credentialID),
        publicKey: authenticator.credentialPublicKey,
        counter: Number(authenticator.counter),
      },
    })

    if (verification.verified) {
      // 更新计数器
      await this.prismaService.authenticator.update({
        where: { id: body.id },
        data: { counter: verification.authenticationInfo.newCounter },
      })

      const formattedUser = formatUser(user)
      const accessToken = this.generateAccessToken(user.id, user.email)
      const refreshToken = this.generateRefreshToken(user.id, user.email)

      return {
        accessToken,
        refreshToken,
        expiresIn: this.accessTokenExpiresIn,
        user: formattedUser,
      }
    }

    throw new UnauthorizedException('auth.AUTHENTICATION_FAILED')
  }

  constructor(
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    private readonly redisService: RedisService,
    private readonly prismaService: PrismaService,
  ) {
    // 访问令牌默认 15 分钟
    this.accessTokenExpiresIn = Number(this.configService.get('JWT_ACCESS_EXPIRES_IN', 900))
    // 刷新令牌默认 7 天
    this.refreshTokenExpiresIn = Number(this.configService.get('JWT_REFRESH_EXPIRES_IN', 604800))
  }

  /**
   * 验证 Google 用户
   */
  async validateGoogleUser(profile: {
    id: string
    emails: Array<{ value: string }>
    displayName: string
    photos?: Array<{ value: string }>
  }): Promise<User> {
    const { id, emails, displayName, photos } = profile
    const email = emails[0].value

    const user = await this.usersService.findInternalByEmail(email)

    if (!user) {
      // 如果用户不存在，创建新用户
      return await this.usersService.createWithGoogle({
        email,
        name: displayName,
        googleId: id,
        avatar: photos?.[0]?.value,
      })
    }

    if (!user.googleId) {
      // 如果用户存在但没有绑定 Google ID，进行绑定
      const updatedUser = await this.usersService.update(user.id, {
        googleId: id,
        avatar: user.avatar || photos?.[0]?.value,
      })
      return formatUser(updatedUser)
    }

    return formatUser(user)
  }

  /**
   * Google 登录成功后生成令牌
   */
  async googleLogin(user: User): Promise<AuthResponse> {
    const accessToken = this.generateAccessToken(user.id, user.email)
    const refreshToken = this.generateRefreshToken(user.id, user.email)

    return {
      accessToken,
      refreshToken,
      expiresIn: this.accessTokenExpiresIn,
      user,
    }
  }

  /**
   * 验证用户凭据
   */
  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.usersService.findInternalByEmail(email)

    if (!user || !user.password) {
      return null
    }

    const isPasswordValid = await bcrypt.compare(password, user.password)
    if (!isPasswordValid) {
      return null
    }

    return formatUser(user)
  }

  /**
   * 用户登录
   */
  async login(loginDto: LoginInput): Promise<AuthResponse> {
    const user = await this.validateUser(loginDto.email, loginDto.password)

    if (!user) {
      throw new UnauthorizedException('auth.INVALID_CREDENTIALS')
    }

    // 生成访问令牌和刷新令牌
    const accessToken = this.generateAccessToken(user.id, user.email)
    const refreshToken = this.generateRefreshToken(user.id, user.email)

    return {
      accessToken,
      refreshToken,
      expiresIn: this.accessTokenExpiresIn,
      user,
    }
  }

  /**
   * 刷新访问令牌
   */
  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    try {
      // 检查是否在黑名单中
      const isBlacklisted = await this.redisService.has(`blacklist:${refreshToken}`, {
        prefix: CachePrefix.AUTH,
      })
      if (isBlacklisted) {
        throw new UnauthorizedException('auth.INVALID_REFRESH_TOKEN')
      }

      const payload = this.jwtService.verify<JwtPayload>(refreshToken)

      // 验证是否为刷新令牌
      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('auth.INVALID_REFRESH_TOKEN')
      }

      const user = await this.getUserById(payload.sub)
      if (!user) {
        throw new UnauthorizedException('auth.USER_NOT_FOUND')
      }

      const newAccessToken = this.generateAccessToken(user.id, user.email)
      const newRefreshToken = this.generateRefreshToken(user.id, user.email)

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: this.accessTokenExpiresIn,
        user,
      }
    } catch {
      throw new UnauthorizedException('auth.TOKEN_EXPIRED')
    }
  }

  /**
   * 生成访问令牌（短期）
   */
  private generateAccessToken(userId: number, email: string): string {
    const payload: JwtPayload = { sub: userId, email, type: 'access' }
    return this.jwtService.sign(payload, {
      expiresIn: this.accessTokenExpiresIn,
    })
  }

  /**
   * 生成刷新令牌（长期）
   */
  private generateRefreshToken(userId: number, email: string): string {
    const payload: JwtPayload = { sub: userId, email, type: 'refresh' }
    return this.jwtService.sign(payload, {
      expiresIn: this.refreshTokenExpiresIn,
    })
  }

  /**
   * 根据用户 ID 获取用户信息
   */
  async getUserById(userId: number): Promise<User | null> {
    try {
      return await this.usersService.findOne(userId)
    } catch {
      return null
    }
  }

  /**
   * 哈希密码（用于注册）
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10)
  }

  /**
   * 用户注册
   */
  async register(registerDto: RegisterInput): Promise<AuthResponse> {
    const user = await this.usersService.create(registerDto)

    const accessToken = this.generateAccessToken(user.id, user.email)
    const refreshToken = this.generateRefreshToken(user.id, user.email)

    return {
      accessToken,
      refreshToken,
      expiresIn: this.accessTokenExpiresIn,
      user,
    }
  }

  /**
   * 请求密码重置
   */
  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.usersService.findInternalByEmail(email)

    // 为防止用户枚举攻击，无论用户是否存在都不抛出错误
    if (!user) {
      return
    }

    const { token, hashedToken } = this.generateResetToken()
    const resetPasswordExpiresIn = this.configService.get<number>('RESET_PASSWORD_EXPIRES_IN', 3600)
    const expiresAt = new Date(Date.now() + resetPasswordExpiresIn * 1000)

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
  async resetPassword(token: string, newPassword: string): Promise<void> {
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

    const hashedPassword = await this.hashPassword(newPassword)

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

  /**
   * 用户登出
   * 将刷新令牌加入黑名单
   */
  async logout(_userId: number, refreshToken: string): Promise<void> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(refreshToken)

      // 计算令牌剩余有效时间（秒）
      if (payload.exp) {
        const ttl = Math.floor((payload.exp * 1000 - Date.now()) / 1000)

        if (ttl > 0) {
          // 将刷新令牌加入黑名单，过期时间与令牌剩余时间一致
          await this.redisService.set(`blacklist:${refreshToken}`, '1', {
            prefix: CachePrefix.AUTH,
            ttl,
          })
        }
      }
    } catch {
      // 令牌无效或已过期，无需处理
    }
  }
}
