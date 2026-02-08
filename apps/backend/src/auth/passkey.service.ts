import { Injectable, BadRequestException, Inject, forwardRef } from '@nestjs/common'
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
import { RedisService, CachePrefix } from '../redis/redis.service'
import { PrismaService } from '../prisma/prisma.service'
import type { User } from '@my-app/shared'

@Injectable()
export class PasskeyService {
  constructor(
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly prismaService: PrismaService,
  ) {}

  /**
   * 生成 WebAuthn 注册选项
   */
  async generateRegistrationOptions(user: User) {
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

    await this.redisService.set(`passkey-registration:${user.id}`, options.challenge, {
      prefix: CachePrefix.AUTH,
      ttl: 300,
    })

    return options
  }

  /**
   * 验证 WebAuthn 注册响应
   */
  async verifyRegistration(user: User, body: RegistrationResponseJSON, name?: string) {
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

      const authenticatorData: Prisma.AuthenticatorUncheckedCreateInput = {
        id: credential.id,
        credentialID: Buffer.from(isoBase64URL.toBuffer(credential.id)),
        credentialPublicKey: Buffer.from(credential.publicKey),
        counter: credential.counter,
        credentialDeviceType: verification.registrationInfo.credentialDeviceType,
        credentialBackedUp: verification.registrationInfo.credentialBackedUp,
        userId: user.id,
        name: name || 'Passkey',
        transports: body.response.transports ? JSON.stringify(body.response.transports) : undefined,
      }

      await this.prismaService.authenticator.create({
        data: authenticatorData,
      })

      return { success: true }
    }

    throw new BadRequestException('auth.REGISTRATION_FAILED')
  }

  /**
   * 生成 WebAuthn 认证选项
   */
  async generateAuthenticationOptions(email: string) {
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

    await this.redisService.set(`passkey-authentication:${email}`, options.challenge, {
      prefix: CachePrefix.AUTH,
      ttl: 300,
    })

    return options
  }

  /**
   * 验证 WebAuthn 认证响应
   */
  async verifyAuthentication(email: string, body: AuthenticationResponseJSON) {
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
      await this.prismaService.authenticator.update({
        where: { id: body.id },
        data: { counter: verification.authenticationInfo.newCounter },
      })
      return { verified: true, user }
    }

    throw new BadRequestException('auth.AUTHENTICATION_FAILED')
  }
}
