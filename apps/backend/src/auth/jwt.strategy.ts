import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { ConfigService } from '@nestjs/config'
import { Request } from 'express'
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
        (req: Request) => {
          return req?.cookies?.accessToken
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
