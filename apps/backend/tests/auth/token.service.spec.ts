import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TokenService } from '../../src/auth/token.service'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { RedisService } from '../../src/redis/redis.service'
import { UnauthorizedException } from '@nestjs/common'
import type { User } from '@lumina/shared'

describe('TokenService', () => {
  let service: TokenService
  let jwtService: JwtService
  let configService: ConfigService
  let redisService: RedisService

  beforeEach(() => {
    jwtService = {
      sign: vi.fn(),
      verify: vi.fn(),
    } as unknown as JwtService
    configService = {
      get: vi.fn((key: string, defaultValue: unknown) => {
        if (key === 'JWT_SECRET') {
          return 'access-secret'
        }
        if (key === 'JWT_REFRESH_SECRET') {
          return 'refresh-secret'
        }
        return defaultValue
      }),
    } as unknown as ConfigService
    redisService = {
      set: vi.fn(),
      has: vi.fn(),
      get: vi.fn(),
    } as unknown as RedisService

    service = new TokenService(jwtService, configService, redisService)
  })

  describe('generateAccessToken', () => {
    it('should sign an access token with correct payload', () => {
      const userId = 1
      const email = 'test@example.com'
      vi.mocked(jwtService.sign).mockReturnValue('access-token')

      const token = service.generateAccessToken(userId, email)

      expect(token).toBe('access-token')
      expect(jwtService.sign).toHaveBeenCalledWith(
        { sub: userId, email, type: 'access' },
        expect.objectContaining({ expiresIn: 900, secret: 'access-secret' }),
      )
    })
  })

  describe('generateRefreshToken', () => {
    it('should sign a refresh token with correct payload', () => {
      const userId = 1
      const email = 'test@example.com'
      vi.mocked(jwtService.sign).mockReturnValue('refresh-token')

      const token = service.generateRefreshToken(userId, email)

      expect(token).toBe('refresh-token')
      expect(jwtService.sign).toHaveBeenCalledWith(
        { sub: userId, email, type: 'refresh' },
        expect.objectContaining({ expiresIn: 604800, secret: 'refresh-secret' }),
      )
    })
  })

  describe('verifyToken', () => {
    it('should return payload if token is valid', () => {
      const payload = { sub: 1, email: 'test@example.com', type: 'access' }
      vi.mocked(jwtService.verify).mockReturnValue(payload)

      const result = service.verifyToken('valid-token')

      expect(result).toEqual(payload)
      expect(jwtService.verify).toHaveBeenCalledWith('valid-token', { secret: 'refresh-secret' })
    })

    it('should throw UnauthorizedException if token is invalid', () => {
      vi.mocked(jwtService.verify).mockImplementation(() => {
        throw new Error('invalid')
      })

      expect(() => service.verifyToken('invalid-token')).toThrow(UnauthorizedException)
      expect(jwtService.verify).toHaveBeenNthCalledWith(1, 'invalid-token', {
        secret: 'refresh-secret',
      })
      expect(jwtService.verify).toHaveBeenNthCalledWith(2, 'invalid-token', {
        secret: 'access-secret',
      })
    })
  })

  describe('blacklistToken', () => {
    it('should set token in redis if valid and not expired', async () => {
      const exp = Math.floor(Date.now() / 1000) + 100
      vi.mocked(jwtService.verify).mockReturnValue({ exp })

      await service.blacklistToken('token-to-blacklist')

      expect(redisService.set).toHaveBeenCalledWith(
        'blacklist:token-to-blacklist',
        '1',
        expect.objectContaining({
          prefix: 'auth',
          ttl: expect.any(Number),
        }),
      )
      expect(jwtService.verify).toHaveBeenCalledWith('token-to-blacklist', {
        secret: 'access-secret',
      })
    })

    it('should do nothing if token is invalid', async () => {
      vi.mocked(jwtService.verify).mockImplementation(() => {
        throw new Error('invalid')
      })

      await service.blacklistToken('invalid-token')

      expect(redisService.set).not.toHaveBeenCalled()
    })
  })

  describe('isBlacklisted', () => {
    it('should check if token exists in redis', async () => {
      vi.mocked(redisService.has).mockResolvedValue(true)

      const result = await service.isBlacklisted('blacklisted-token')

      expect(result).toBe(true)
      expect(redisService.has).toHaveBeenCalledWith(
        'blacklist:blacklisted-token',
        expect.any(Object),
      )
    })
  })

  describe('invalidateUserSessions', () => {
    it('should set invalidation timestamp in redis', async () => {
      await service.invalidateUserSessions(123)

      expect(redisService.set).toHaveBeenCalledWith(
        'invalidate:123',
        expect.any(Number),
        expect.objectContaining({ prefix: 'auth', ttl: 604800 }),
      )
    })
  })

  describe('isUserSessionInvalidated', () => {
    it('should return false when no invalidation exists', async () => {
      vi.mocked(redisService.get).mockResolvedValue(undefined)

      await expect(service.isUserSessionInvalidated(1, 100)).resolves.toBe(false)
    })

    it('should return true when token iat is missing and invalidation exists', async () => {
      vi.mocked(redisService.get).mockResolvedValue(200)

      await expect(service.isUserSessionInvalidated(1, undefined)).resolves.toBe(true)
    })

    it('should return true when token issued before invalidation', async () => {
      vi.mocked(redisService.get).mockResolvedValue(200)

      await expect(service.isUserSessionInvalidated(1, 199)).resolves.toBe(true)
    })

    it('should return false when token issued after invalidation', async () => {
      vi.mocked(redisService.get).mockResolvedValue('200')

      await expect(service.isUserSessionInvalidated(1, 200)).resolves.toBe(false)
    })
  })

  describe('buildAuthResponse', () => {
    it('should return full auth response', () => {
      const user = { id: 1, email: 'test@example.com' } as unknown as User
      vi.mocked(jwtService.sign)
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token')

      const response = service.buildAuthResponse(user)

      expect(response).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 900,
        user,
      })
    })
  })
})
