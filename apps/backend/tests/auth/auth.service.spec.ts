import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuthService } from '../../src/auth/auth.service'
import { UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { UsersService } from '../../src/users/users.service'
import { MailService } from '../../src/mail/mail.service'
import { RedisService } from '../../src/redis/redis.service'
import * as bcrypt from 'bcryptjs'
import type { User } from '@my-app/shared'

// Mock dependencies
const mockUsersService = {
  findInternalByEmail: vi.fn(),
  findOne: vi.fn(),
  create: vi.fn(),
  getUserById: vi.fn(),
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
})
