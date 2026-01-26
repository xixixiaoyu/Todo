import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuthService } from '../../src/auth/auth.service'
import { UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { UsersService } from '../../src/users/users.service'
import { MailService } from '../../src/mail/mail.service'
import { RedisService } from '../../src/redis/redis.service'
import { PrismaService } from '../../src/prisma/prisma.service'
import * as bcrypt from 'bcryptjs'
import type { User } from '@lumina/shared'
import * as simplewebauthn from '@simplewebauthn/server'
import type { PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/server'

// Mock simplewebauthn
vi.mock('@simplewebauthn/server', () => ({
  generateRegistrationOptions: vi.fn(),
  verifyRegistrationResponse: vi.fn(),
  generateAuthenticationOptions: vi.fn(),
  verifyAuthenticationResponse: vi.fn(),
}))

// Mock dependencies
const mockUsersService = {
  findInternalByEmail: vi.fn(),
  findOne: vi.fn(),
  create: vi.fn(),
  getUserById: vi.fn(),
  createWithGoogle: vi.fn(),
  update: vi.fn(),
}

const mockJwtService = {
  sign: vi.fn(),
  verify: vi.fn(),
}

const mockConfigService = {
  get: vi.fn((key: string, defaultValue?: unknown) => defaultValue),
}

const mockMailService = {
  sendPasswordReset: vi.fn(),
}

const mockRedisService = {
  has: vi.fn(),
  set: vi.fn(),
  get: vi.fn(),
}

const mockPrismaService = {
  authenticator: {
    findMany: vi.fn(),
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}

describe('AuthService', () => {
  let service: AuthService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new AuthService(
      mockUsersService as unknown as UsersService,
      mockJwtService as unknown as JwtService,
      mockConfigService as unknown as ConfigService,
      mockMailService as unknown as MailService,
      mockRedisService as unknown as RedisService,
      mockPrismaService as unknown as PrismaService,
    )
  })

  describe('validateUser', () => {
    it('should return formatted user if credentials are valid', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10)
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        password: hashedPassword,
        name: 'Test User',
        avatar: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      mockUsersService.findInternalByEmail.mockResolvedValue(mockUser)

      const result = await service.validateUser('test@example.com', 'password123')

      expect(result).not.toBeNull()
      expect(result?.email).toBe('test@example.com')
      // 使用类型断言检查 password 是否已被 formatUser 移除
      expect((result as Record<string, unknown>).password).toBeUndefined()
    })

    it('should return null if user not found', async () => {
      mockUsersService.findInternalByEmail.mockResolvedValue(null)
      const result = await service.validateUser('none@example.com', 'password')
      expect(result).toBeNull()
    })

    it('should return null if password invalid', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10)
      mockUsersService.findInternalByEmail.mockResolvedValue({
        password: hashedPassword,
      })
      const result = await service.validateUser('test@example.com', 'wrongpassword')
      expect(result).toBeNull()
    })
  })

  describe('login', () => {
    it('should throw UnauthorizedException if validation fails', async () => {
      vi.spyOn(service, 'validateUser').mockResolvedValue(null)
      await expect(
        service.login({ email: 'test@example.com', password: 'password' }),
      ).rejects.toThrow(UnauthorizedException)
    })

    it('should return tokens and user on success', async () => {
      const mockUser: User = {
        id: 1,
        email: 'test@example.com',
        name: 'Test',
        avatar: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      vi.spyOn(service, 'validateUser').mockResolvedValue(mockUser)
      mockJwtService.sign.mockReturnValue('mock-token')

      const result = await service.login({ email: 'test@example.com', password: 'password' })

      expect(result.accessToken).toBe('mock-token')
      expect(result.refreshToken).toBe('mock-token')
      expect(result.user).toEqual(mockUser)
    })
  })

  describe('validateGoogleUser', () => {
    it('should return user if googleId exists', async () => {
      const mockUser = {
        id: 1,
        email: 'google@test.com',
        googleId: 'google-123',
        name: 'Google User',
        avatar: 'photo-url',
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      mockUsersService.findInternalByEmail.mockResolvedValue(mockUser)

      const profile = {
        id: 'google-123',
        emails: [{ value: 'google@test.com' }],
        displayName: 'Google User',
        photos: [{ value: 'photo-url' }],
      }
      const result = await service.validateGoogleUser(profile)

      expect(result.id).toBe(1)
      expect(mockUsersService.createWithGoogle).not.toHaveBeenCalled()
    })

    it('should create user if googleId does not exist', async () => {
      mockUsersService.findInternalByEmail.mockResolvedValue(null)
      mockUsersService.createWithGoogle.mockResolvedValue({
        id: 2,
        email: 'new@google.com',
        googleId: 'new-123',
      })

      const profile = {
        id: 'new-123',
        emails: [{ value: 'new@google.com' }],
        displayName: 'New User',
        photos: [{ value: 'photo-url' }],
      }
      const result = await service.validateGoogleUser(profile)

      expect(result.id).toBe(2)
      expect(mockUsersService.createWithGoogle).toHaveBeenCalled()
    })
  })

  describe('Passkeys', () => {
    const mockUser: User = {
      id: 1,
      email: 'test@example.com',
      name: 'Test',
      avatar: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    it('should generate registration options', async () => {
      mockPrismaService.authenticator.findMany.mockResolvedValue([])
      vi.mocked(simplewebauthn.generateRegistrationOptions).mockResolvedValue({
        challenge: 'mock-challenge',
      } as unknown as PublicKeyCredentialCreationOptionsJSON)

      const options = await service.generatePasskeyRegistrationOptions(mockUser)

      expect(options.challenge).toBe('mock-challenge')
      expect(mockRedisService.set).toHaveBeenCalled()
    })
  })
})
