import { Module, forwardRef } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { ConfigService } from '@nestjs/config'
import { AuthService } from './auth.service'
import { TokenService } from './token.service'
import { PasskeyService } from './passkey.service'
import { PasswordService } from './password.service'
import { AuthController } from './auth.controller'
import { OAuthController } from './oauth.controller'
import { PasskeyController } from './passkey.controller'
import { PasswordController } from './password.controller'
import { JwtStrategy } from './jwt.strategy'
import { GoogleStrategy } from './google.strategy'
import { PrismaModule } from '../prisma/prisma.module'
import { MailModule } from '../mail/mail.module'
import { RedisModule } from '../redis/redis.module'
import { UsersModule } from '../users/users.module'

/**
 * 认证模块
 */
@Module({
  imports: [
    PrismaModule,
    MailModule,
    RedisModule,
    forwardRef(() => UsersModule),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<number>('JWT_ACCESS_EXPIRES_IN', 900),
        },
      }),
    }),
  ],
  controllers: [AuthController, OAuthController, PasskeyController, PasswordController],
  providers: [
    AuthService,
    TokenService,
    PasskeyService,
    PasswordService,
    JwtStrategy,
    GoogleStrategy,
  ],
  exports: [AuthService, TokenService, PasskeyService, PasswordService, JwtModule, PassportModule],
})
export class AuthModule {}
