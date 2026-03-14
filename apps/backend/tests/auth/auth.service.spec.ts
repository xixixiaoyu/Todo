import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuthService } from '../../src/auth/auth.service'
import { TokenService } from '../../src/auth/token.service'
import { PasswordService } from '../../src/auth/password.service'
import { UnauthorizedException } from '@nestjs/common'
import { UsersService } from '../../src/users/users.service'
import * as bcrypt from 'bcryptjs'
import type { User } from '@lumina/shared'

// Mock dependencies
const mockUsersService = {
  findInternalByEmail: vi.fn(),
  findOne: vi.fn(),
  create: vi.fn(),
  getUserById: vi.fn(),
  createWithGoogle: vi.fn(),
  update: vi.fn(),
}

const mockTokenService = {
  buildAuthResponse: vi.fn(),
  isBlacklisted: vi.fn(),
  verifyToken: vi.fn(),
  blacklistToken: vi.fn(),
  isUserSessionInvalidated: vi.fn(),
}

const mockPasswordService = {
  hash: vi.fn(),
  compare: vi.fn(),
  requestReset: vi.fn(),
  reset: vi.fn(),
}

describe('AuthService', () => {
  let service: AuthService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new AuthService(
      mockUsersService as unknown as UsersService,
      mockTokenService as unknown as TokenService,
      mockPasswordService as unknown as PasswordService,
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
      mockPasswordService.compare.mockResolvedValue(true)

      const result = await service.validateUser('test@example.com', 'password123')

      expect(result).not.toBeNull()
      expect(result?.email).toBe('test@example.com')
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
      mockPasswordService.compare.mockResolvedValue(false)
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
      mockTokenService.buildAuthResponse.mockReturnValue({
        accessToken: 'mock-token',
        refreshToken: 'mock-token',
        user: mockUser,
      })

      const result = await service.login({ email: 'test@example.com', password: 'password' })

      expect(result.accessToken).toBe('mock-token')
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
        name: 'New User',
        createdAt: new Date(),
        updatedAt: new Date(),
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

  describe('logout', () => {
    it('should call tokenService.blacklistToken', async () => {
      const refreshToken = 'mock-refresh-token'
      await service.logout(refreshToken)
      expect(mockTokenService.blacklistToken).toHaveBeenCalledWith(refreshToken)
    })
  })

  describe('refreshToken', () => {
    it('should throw UnauthorizedException if token is blacklisted', async () => {
      mockTokenService.isBlacklisted.mockResolvedValue(true)

      await expect(service.refreshToken('refresh-token')).rejects.toThrow(UnauthorizedException)
    })

    it('should throw UnauthorizedException if session is invalidated', async () => {
      mockTokenService.isBlacklisted.mockResolvedValue(false)
      mockTokenService.verifyToken.mockReturnValue({
        sub: 1,
        email: 'test@example.com',
        type: 'refresh',
        iat: 100,
      })
      mockTokenService.isUserSessionInvalidated.mockResolvedValue(true)

      await expect(service.refreshToken('refresh-token')).rejects.toThrow(UnauthorizedException)
      expect(mockUsersService.findOne).not.toHaveBeenCalled()
    })

    it('should return auth response when refresh token is valid', async () => {
      const mockUser: User = {
        id: 1,
        email: 'test@example.com',
        name: 'Test',
        avatar: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      mockTokenService.isBlacklisted.mockResolvedValue(false)
      mockTokenService.verifyToken.mockReturnValue({
        sub: 1,
        email: 'test@example.com',
        type: 'refresh',
        iat: 100,
      })
      mockTokenService.isUserSessionInvalidated.mockResolvedValue(false)
      mockUsersService.findOne.mockResolvedValue(mockUser)
      mockTokenService.buildAuthResponse.mockReturnValue({
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
        user: mockUser,
      })

      const result = await service.refreshToken('refresh-token')

      expect(result.accessToken).toBe('new-access')
      expect(mockTokenService.buildAuthResponse).toHaveBeenCalledWith(mockUser)
    })
  })
})
