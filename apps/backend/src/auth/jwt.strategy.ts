import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { ConfigService } from '@nestjs/config'
import { AuthService } from './auth.service'

interface JwtPayload {
  sub: number
  email: string
  type: 'access' | 'refresh'
}

/**
 * JWT 策略
 * 用于验证 JWT 令牌
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    const jwtSecret = configService.get<string>('JWT_SECRET')
    if (!jwtSecret) {
      throw new Error('JWT_SECRET 未配置')
    }

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req: {
          url?: string
          originalUrl?: string
          cookies?: { accessToken?: string }
          raw?: { url?: string; cookies?: { accessToken?: string } }
        }) => {
          // 只允许在 OAuth 登录回调路径下从 Cookie 获取 Token
          // 这样可以防止 CSRF 攻击，因为其他业务接口将不再接受 Cookie 认证
          const url = req.originalUrl ?? req.url ?? req.raw?.url ?? ''
          const path = url.split('?')[0]
          if (path === '/api/auth/oauth/login') {
            return req.cookies?.accessToken ?? req.raw?.cookies?.accessToken ?? null
          }
          return null
        },
      ]),
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
      throw new UnauthorizedException('无效的令牌类型')
    }

    // 确保 sub (userId) 是数字类型，防止 Prisma 查询报错
    const userId = typeof payload.sub === 'string' ? parseInt(payload.sub, 10) : payload.sub
    const user = await this.authService.getUserById(userId)

    if (!user) {
      throw new UnauthorizedException('用户不存在')
    }

    return user
  }
}
