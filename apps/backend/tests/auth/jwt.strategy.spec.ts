import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ConfigService } from '@nestjs/config'
import { UnauthorizedException } from '@nestjs/common'
import { JwtStrategy } from '@/auth/jwt.strategy'
import { AuthService } from '@/auth/auth.service'
import { TokenService } from '@/auth/token.service'

describe('JwtStrategy', () => {
  let strategy: JwtStrategy
  const configService = {
    get: vi.fn((key: string) => {
      if (key === 'JWT_SECRET') return 'access-secret'
      return undefined
    }),
  } as unknown as ConfigService

  const authService = {
    getUserById: vi.fn(),
  } as unknown as AuthService

  const tokenService = {
    isUserSessionInvalidated: vi.fn(),
  } as unknown as TokenService

  beforeEach(() => {
    vi.clearAllMocks()
    strategy = new JwtStrategy(configService, authService, tokenService)
  })

  it('rejects non-access token payload', async () => {
    await expect(
      strategy.validate({
        sub: 1,
        email: 'test@example.com',
        type: 'refresh',
      }),
    ).rejects.toThrow(UnauthorizedException)
  })

  it('rejects invalidated access token payload', async () => {
    vi.mocked(tokenService.isUserSessionInvalidated).mockResolvedValue(true)

    await expect(
      strategy.validate({
        sub: 1,
        email: 'test@example.com',
        type: 'access',
        iat: 100,
      }),
    ).rejects.toThrow(UnauthorizedException)
  })

  it('returns user for valid non-invalidated payload', async () => {
    const user = {
      id: 1,
      email: 'test@example.com',
      name: 'Tester',
      avatar: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    vi.mocked(tokenService.isUserSessionInvalidated).mockResolvedValue(false)
    vi.mocked(authService.getUserById).mockResolvedValue(user)

    await expect(
      strategy.validate({
        sub: 1,
        email: 'test@example.com',
        type: 'access',
        iat: 100,
      }),
    ).resolves.toEqual(user)
  })
})
