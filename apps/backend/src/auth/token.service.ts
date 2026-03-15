import { Injectable, UnauthorizedException, Inject } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { RedisService, CachePrefix } from '../redis/redis.service'
import type { User, AuthResponse } from '@lumina/shared'

export interface JwtPayload {
  sub: number
  email: string
  type: 'access' | 'refresh'
  exp?: number
  iat?: number
}

@Injectable()
export class TokenService {
  private readonly accessTokenExpiresIn: number
  private readonly refreshTokenExpiresIn: number
  private readonly accessTokenSecret: string
  private readonly refreshTokenSecret: string

  constructor(
    @Inject(JwtService)
    private readonly jwtService: JwtService,
    @Inject(ConfigService)
    private readonly configService: ConfigService,
    @Inject(RedisService)
    private readonly redisService: RedisService,
  ) {
    const jwtSecret = this.configService.get<string>('JWT_SECRET')
    if (!jwtSecret) {
      throw new Error('JWT_SECRET 未配置')
    }

    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development')
    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET')
    if (nodeEnv === 'production' && !refreshSecret) {
      throw new Error('JWT_REFRESH_SECRET 未配置')
    }

    this.accessTokenExpiresIn = Number(this.configService.get('JWT_ACCESS_EXPIRES_IN', 900))
    this.refreshTokenExpiresIn = Number(this.configService.get('JWT_REFRESH_EXPIRES_IN', 604800))
    this.accessTokenSecret = jwtSecret
    this.refreshTokenSecret = refreshSecret ?? jwtSecret
  }

  async invalidateUserSessions(userId: number): Promise<void> {
    const nowSec = Math.floor(Date.now() / 1000)
    await this.redisService.set(`invalidate:${userId}`, nowSec, {
      prefix: CachePrefix.AUTH,
      ttl: this.refreshTokenExpiresIn,
    })
  }

  async isUserSessionInvalidated(userId: number, tokenIat?: number): Promise<boolean> {
    const invalidatedAt = await this.redisService.get<number | string>(`invalidate:${userId}`, {
      prefix: CachePrefix.AUTH,
    })

    if (invalidatedAt === undefined) {
      return false
    }

    const invalidatedAtSec =
      typeof invalidatedAt === 'string' ? Number(invalidatedAt) : invalidatedAt

    if (!Number.isFinite(invalidatedAtSec)) {
      return false
    }

    if (typeof tokenIat !== 'number') {
      return true
    }

    return tokenIat < invalidatedAtSec
  }

  /**
   * 生成访问令牌（短期）
   */
  generateAccessToken(userId: number, email: string): string {
    const payload: JwtPayload = { sub: userId, email, type: 'access' }
    return this.jwtService.sign(payload, {
      expiresIn: this.accessTokenExpiresIn,
      secret: this.accessTokenSecret,
    })
  }

  /**
   * 生成刷新令牌（长期）
   */
  generateRefreshToken(userId: number, email: string): string {
    const payload: JwtPayload = { sub: userId, email, type: 'refresh' }
    return this.jwtService.sign(payload, {
      expiresIn: this.refreshTokenExpiresIn,
      secret: this.refreshTokenSecret,
    })
  }

  /**
   * 验证令牌
   */
  verifyToken<T extends object>(token: string): T {
    try {
      return this.jwtService.verify<T>(token, { secret: this.refreshTokenSecret })
    } catch {
      try {
        return this.jwtService.verify<T>(token, { secret: this.accessTokenSecret })
      } catch {
        throw new UnauthorizedException('auth.TOKEN_EXPIRED')
      }
    }
  }

  verifyAccessToken(token: string): JwtPayload {
    try {
      const payload = this.jwtService.verify<JwtPayload>(token, { secret: this.accessTokenSecret })
      if (payload.type !== 'access') {
        throw new UnauthorizedException('auth.INVALID_TOKEN')
      }
      return payload
    } catch {
      throw new UnauthorizedException('auth.INVALID_TOKEN')
    }
  }

  /**
   * 将令牌加入黑名单
   */
  async blacklistToken(token: string): Promise<void> {
    const payload = this.tryVerifyToken<JwtPayload>(token)
    if (!payload?.exp) {
      return
    }

    const ttl = Math.floor((payload.exp * 1000 - Date.now()) / 1000)
    if (ttl <= 0) {
      return
    }

    try {
      await this.redisService.set(`blacklist:${token}`, '1', {
        prefix: CachePrefix.AUTH,
        ttl,
      })
    } catch {
      return
    }
  }

  private tryVerifyToken<T extends object>(token: string): T | null {
    try {
      return this.jwtService.verify<T>(token, { secret: this.accessTokenSecret })
    } catch {
      try {
        return this.jwtService.verify<T>(token, { secret: this.refreshTokenSecret })
      } catch {
        return null
      }
    }
  }

  /**
   * 检查令牌是否在黑名单中
   */
  async isBlacklisted(token: string): Promise<boolean> {
    return await this.redisService.has(`blacklist:${token}`, {
      prefix: CachePrefix.AUTH,
    })
  }

  /**
   * 构建完整的认证响应
   */
  buildAuthResponse(user: User): AuthResponse {
    const accessToken = this.generateAccessToken(user.id, user.email)
    const refreshToken = this.generateRefreshToken(user.id, user.email)

    return {
      accessToken,
      refreshToken,
      expiresIn: this.accessTokenExpiresIn,
      user,
    }
  }
}
