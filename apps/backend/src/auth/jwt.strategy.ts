import { Injectable, UnauthorizedException, Inject } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { ConfigService } from '@nestjs/config'
import { AuthService } from './auth.service'
import { TokenService } from './token.service'

interface JwtPayload {
  sub: number
  email: string
  type: 'access' | 'refresh'
  iat?: number
}

/**
 * JWT 策略
 * 用于验证 JWT 令牌
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(ConfigService) configService: ConfigService,
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(TokenService) private readonly tokenService: TokenService,
  ) {
    const jwtSecret = configService.get<string>('JWT_SECRET')
    if (!jwtSecret) {
      throw new Error('JWT_SECRET 未配置')
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    })
  }

  /**
   * 验证 JWT payload
   */
  async validate(payload: JwtPayload) {
    // 验证是否为访问令牌
    if (payload.type !== 'access') {
      throw new UnauthorizedException('auth.INVALID_TOKEN')
    }

    // 确保 sub (userId) 是数字类型，防止 Prisma 查询报错
    const userId = typeof payload.sub === 'string' ? parseInt(payload.sub, 10) : payload.sub

    if (!Number.isInteger(userId) || userId <= 0) {
      throw new UnauthorizedException('auth.INVALID_TOKEN')
    }

    const isInvalidated = await this.tokenService.isUserSessionInvalidated(userId, payload.iat)
    if (isInvalidated) {
      throw new UnauthorizedException('auth.INVALID_TOKEN')
    }

    const user = await this.authService.getUserById(userId)

    if (!user) {
      throw new UnauthorizedException('auth.USER_NOT_FOUND')
    }

    return user
  }
}
