import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { RedisService, CachePrefix } from '../redis/redis.service'
import type { User, AuthResponse } from '@my-app/shared'

export interface JwtPayload {
  sub: number
  email: string
  type: 'access' | 'refresh'
  exp?: number
}

@Injectable()
export class TokenService {
  private readonly accessTokenExpiresIn: number
  private readonly refreshTokenExpiresIn: number

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    this.accessTokenExpiresIn = Number(this.configService.get('JWT_ACCESS_EXPIRES_IN', 900))
    this.refreshTokenExpiresIn = Number(this.configService.get('JWT_REFRESH_EXPIRES_IN', 604800))
  }

  /**
   * 生成访问令牌（短期）
   */
  generateAccessToken(userId: number, email: string): string {
    const payload: JwtPayload = { sub: userId, email, type: 'access' }
    return this.jwtService.sign(payload, {
      expiresIn: this.accessTokenExpiresIn,
    })
  }

  /**
   * 生成刷新令牌（长期）
   */
  generateRefreshToken(userId: number, email: string): string {
    const payload: JwtPayload = { sub: userId, email, type: 'refresh' }
    return this.jwtService.sign(payload, {
      expiresIn: this.refreshTokenExpiresIn,
    })
  }

  /**
   * 验证令牌
   */
  verifyToken<T extends object>(token: string): T {
    try {
      return this.jwtService.verify<T>(token)
    } catch {
      throw new UnauthorizedException('auth.TOKEN_EXPIRED')
    }
  }

  /**
   * 将令牌加入黑名单
   */
  async blacklistToken(token: string): Promise<void> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(token)
      if (payload.exp) {
        const ttl = Math.floor((payload.exp * 1000 - Date.now()) / 1000)
        if (ttl > 0) {
          await this.redisService.set(`blacklist:${token}`, '1', {
            prefix: CachePrefix.AUTH,
            ttl,
          })
        }
      }
    } catch {
      // 忽略无效令牌
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
