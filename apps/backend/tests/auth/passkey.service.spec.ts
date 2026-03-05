import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PasskeyService } from '../../src/auth/passkey.service'
import { UsersService } from '../../src/users/users.service'
import { ConfigService } from '@nestjs/config'
import { RedisService } from '../../src/redis/redis.service'
import { PrismaService } from '../../src/prisma/prisma.service'
import * as simplewebauthn from '@simplewebauthn/server'
import { BadRequestException } from '@nestjs/common'
import type { User } from '@lumina/shared'
import type { RegistrationResponseJSON, AuthenticationResponseJSON } from '@simplewebauthn/server'

vi.mock('@simplewebauthn/server', () => ({
  generateRegistrationOptions: vi.fn(),
  verifyRegistrationResponse: vi.fn(),
  generateAuthenticationOptions: vi.fn(),
  verifyAuthenticationResponse: vi.fn(),
}))

vi.mock('@simplewebauthn/server/helpers', () => ({
  isoBase64URL: {
    fromBuffer: vi.fn(() => 'mock-base64'),
    toBuffer: vi.fn(() => Buffer.from('mock-buffer')),
  },
}))

describe('PasskeyService', () => {
  let service: PasskeyService
  let usersService: UsersService
  let configService: ConfigService
  let redisService: RedisService
  let prismaService: PrismaService

  const mockUser: User = {
    id: 1,
    email: 'test@example.com',
    name: 'Test User',
    avatar: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  beforeEach(() => {
    usersService = {
      findInternalByEmail: vi.fn(),
    } as unknown as UsersService

    configService = {
      get: vi.fn((key: string, defaultValue: unknown) => defaultValue),
    } as unknown as ConfigService

    redisService = {
      set: vi.fn(),
      get: vi.fn(),
    } as unknown as RedisService

    prismaService = {
      authenticator: {
        findMany: vi.fn(),
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    } as unknown as PrismaService

    service = new PasskeyService(usersService, configService, redisService, prismaService)
  })

  describe('generateRegistrationOptions', () => {
    it('should generate options and store challenge in redis', async () => {
      vi.mocked(prismaService.authenticator.findMany).mockResolvedValue([])
      vi.mocked(simplewebauthn.generateRegistrationOptions).mockResolvedValue({
        challenge: 'mock-challenge',
      } as unknown as Awaited<ReturnType<typeof simplewebauthn.generateRegistrationOptions>>)

      const options = await service.generateRegistrationOptions(mockUser)

      expect(options.challenge).toBe('mock-challenge')
      expect(redisService.set).toHaveBeenCalledWith(
        `passkey-registration:${mockUser.id}`,
        'mock-challenge',
        expect.any(Object),
      )
    })
  })

  describe('verifyRegistration', () => {
    it('should create authenticator if verification is successful', async () => {
      vi.mocked(redisService.get).mockResolvedValue('mock-challenge')
      vi.mocked(simplewebauthn.verifyRegistrationResponse).mockResolvedValue({
        verified: true,
        registrationInfo: {
          credential: {
            id: 'cred-id',
            publicKey: new Uint8Array(),
            counter: 0,
          },
          credentialDeviceType: 'single_device',
          credentialBackedUp: false,
        },
      } as unknown as Awaited<ReturnType<typeof simplewebauthn.verifyRegistrationResponse>>)

      const result = await service.verifyRegistration(mockUser, {
        response: {},
      } as unknown as RegistrationResponseJSON)

      expect(result.success).toBe(true)
      expect(prismaService.authenticator.create).toHaveBeenCalled()
    })

    it('should throw BadRequestException if challenge expired', async () => {
      vi.mocked(redisService.get).mockResolvedValue(null)

      await expect(
        service.verifyRegistration(mockUser, {} as unknown as RegistrationResponseJSON),
      ).rejects.toThrow(BadRequestException)
    })
  })

  describe('generateAuthenticationOptions', () => {
    it('should generate options and store challenge in redis', async () => {
      vi.mocked(usersService.findInternalByEmail).mockResolvedValue(
        mockUser as unknown as Awaited<ReturnType<typeof usersService.findInternalByEmail>>,
      )
      vi.mocked(prismaService.authenticator.findMany).mockResolvedValue([])
      vi.mocked(simplewebauthn.generateAuthenticationOptions).mockResolvedValue({
        challenge: 'auth-challenge',
      } as unknown as Awaited<ReturnType<typeof simplewebauthn.generateAuthenticationOptions>>)

      const options = await service.generateAuthenticationOptions(mockUser.email)

      expect(options.challenge).toBe('auth-challenge')
      expect(redisService.set).toHaveBeenCalledWith(
        `passkey-authentication:${mockUser.email}`,
        'auth-challenge',
        expect.any(Object),
      )
    })
  })

  describe('verifyAuthentication', () => {
    it('should return user if verification is successful', async () => {
      vi.mocked(usersService.findInternalByEmail).mockResolvedValue(
        mockUser as unknown as Awaited<ReturnType<typeof usersService.findInternalByEmail>>,
      )
      vi.mocked(redisService.get).mockResolvedValue('auth-challenge')
      vi.mocked(prismaService.authenticator.findUnique).mockResolvedValue({
        credentialID: Buffer.from('id'),
        credentialPublicKey: Buffer.from('pk'),
        counter: 0,
      } as unknown as Awaited<ReturnType<typeof prismaService.authenticator.findUnique>>)
      vi.mocked(simplewebauthn.verifyAuthenticationResponse).mockResolvedValue({
        verified: true,
        authenticationInfo: { newCounter: 1 },
      } as unknown as Awaited<ReturnType<typeof simplewebauthn.verifyAuthenticationResponse>>)

      const result = await service.verifyAuthentication(mockUser.email, {
        id: 'cred-id',
      } as unknown as AuthenticationResponseJSON)

      expect(result.verified).toBe(true)
      expect(result.user).toEqual(mockUser)
      expect(prismaService.authenticator.update).toHaveBeenCalled()
    })
  })
})
