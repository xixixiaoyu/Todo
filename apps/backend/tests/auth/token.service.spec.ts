import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TokenService } from '../../src/auth/token.service'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { RedisService } from '../../src/redis/redis.service'
import { UnauthorizedException } from '@nestjs/common'
import type { User } from '@my-app/shared'

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
      get: vi.fn((key: string, defaultValue: unknown) => defaultValue),
    } as unknown as ConfigService
    redisService = {
      set: vi.fn(),
      has: vi.fn(),
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
        expect.objectContaining({ expiresIn: 900 }),
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
        expect.objectContaining({ expiresIn: 604800 }),
      )
    })
  })

  describe('verifyToken', () => {
    it('should return payload if token is valid', () => {
      const payload = { sub: 1, email: 'test@example.com', type: 'access' }
      vi.mocked(jwtService.verify).mockReturnValue(payload)

      const result = service.verifyToken('valid-token')

      expect(result).toEqual(payload)
    })

    it('should throw UnauthorizedException if token is invalid', () => {
      vi.mocked(jwtService.verify).mockImplementation(() => {
        throw new Error('invalid')
      })

      expect(() => service.verifyToken('invalid-token')).toThrow(UnauthorizedException)
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
