import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { unwrapApiResponse, type ApiResponse, type AuthResponse, type User } from '@lumina/shared'
import { createE2eApp } from './test-app'

const ajaxHeaders = {
  'content-type': 'application/json',
  'x-requested-with': 'XMLHttpRequest',
}

describe('Auth e2e', () => {
  let app: NestFastifyApplication
  let inject: <T = unknown>(opts: {
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'
    url: string
    headers?: Record<string, string>
    payload?: unknown
  }) => Promise<{ statusCode: number; body: ApiResponse<T> | Record<string, unknown> }>

  beforeEach(async () => {
    const res = await createE2eApp()
    app = res.app
    inject = res.inject
  })

  afterEach(async () => {
    await app.close()
  })

  it('should block non-GET requests missing X-Requested-With', async () => {
    const res = await inject({
      method: 'POST',
      url: '/api/auth/register',
      headers: {
        'content-type': 'application/json',
      },
      payload: { email: 'a@example.com', name: 'Alice', password: 'password123' },
    })

    expect(res.statusCode).toBe(403)
    expect(res.body).toMatchObject({
      success: false,
      message: 'Security check failed: X-Requested-With header is missing',
    })
  })

  it('should not bypass security header check via query string path fragments', async () => {
    const res = await inject({
      method: 'POST',
      url: '/api/auth/register?next=/api/health/liveness',
      headers: {
        'content-type': 'application/json',
      },
      payload: { email: 'b@example.com', name: 'Bob', password: 'password123' },
    })

    expect(res.statusCode).toBe(403)
    expect(res.body).toMatchObject({
      success: false,
      message: 'Security check failed: X-Requested-With header is missing',
    })
  })

  it('should register, login, refresh, logout, and reject blacklisted refresh token', async () => {
    const registerRes = await inject<AuthResponse>({
      method: 'POST',
      url: '/api/auth/register',
      headers: ajaxHeaders,
      payload: { email: 'test@example.com', name: 'Test User', password: 'password123' },
    })

    expect(registerRes.statusCode).toBe(201)
    expect((registerRes.body as ApiResponse<AuthResponse>).success).toBe(true)
    const registerData = unwrapApiResponse(registerRes.body as ApiResponse<AuthResponse>)
    expect(registerData.accessToken).toBeTypeOf('string')
    expect(registerData.refreshToken).toBeTypeOf('string')
    expect(registerData.user.email).toBe('test@example.com')

    const meRes = await inject<User>({
      method: 'GET',
      url: '/api/auth/me',
      headers: {
        authorization: `Bearer ${registerData.accessToken}`,
      },
    })

    expect(meRes.statusCode).toBe(200)
    expect((meRes.body as ApiResponse<User>).success).toBe(true)
    expect(unwrapApiResponse(meRes.body as ApiResponse<User>).email).toBe('test@example.com')

    const invalidLoginRes = await inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: ajaxHeaders,
      payload: { email: 'test@example.com', password: 'wrong-password' },
    })

    expect(invalidLoginRes.statusCode).toBe(401)
    expect(invalidLoginRes.body).toMatchObject({
      success: false,
      statusCode: 401,
    })

    const loginRes = await inject<AuthResponse>({
      method: 'POST',
      url: '/api/auth/login',
      headers: ajaxHeaders,
      payload: { email: 'test@example.com', password: 'password123' },
    })

    expect(loginRes.statusCode).toBe(201)
    const loginData = unwrapApiResponse(loginRes.body as ApiResponse<AuthResponse>)
    expect(loginData.accessToken).toBeTypeOf('string')
    expect(loginData.refreshToken).toBeTypeOf('string')

    const refreshRes = await inject<AuthResponse>({
      method: 'POST',
      url: '/api/auth/refresh',
      headers: ajaxHeaders,
      payload: { refreshToken: loginData.refreshToken },
    })

    expect(refreshRes.statusCode).toBe(201)
    expect((refreshRes.body as ApiResponse<AuthResponse>).success).toBe(true)

    const logoutRes = await inject<{ message: string }>({
      method: 'POST',
      url: '/api/auth/logout',
      headers: {
        ...ajaxHeaders,
        authorization: `Bearer ${loginData.accessToken}`,
      },
      payload: { refreshToken: loginData.refreshToken },
    })

    expect(logoutRes.statusCode).toBe(201)
    expect(unwrapApiResponse(logoutRes.body as ApiResponse<{ message: string }>)).toEqual({
      message: '登出成功',
    })

    const refreshAfterLogoutRes = await inject({
      method: 'POST',
      url: '/api/auth/refresh',
      headers: ajaxHeaders,
      payload: { refreshToken: loginData.refreshToken },
    })

    expect(refreshAfterLogoutRes.statusCode).toBe(401)
    expect(refreshAfterLogoutRes.body).toMatchObject({
      success: false,
      statusCode: 401,
    })
  })

  it('should throttle repeated register attempts with the dedicated policy', async () => {
    const results: Array<{
      statusCode: number
      body: ApiResponse<AuthResponse> | Record<string, unknown>
    }> = []

    for (const suffix of ['alpha', 'beta', 'gamma']) {
      results.push(
        await inject<AuthResponse>({
          method: 'POST',
          url: '/api/auth/register',
          headers: ajaxHeaders,
          payload: {
            email: `${suffix}@example.com`,
            name: suffix,
            password: 'password123',
          },
        }),
      )
    }

    expect(results.map((result) => result.statusCode)).toEqual([201, 201, 429])
    expect(results[2]!.body).toMatchObject({
      success: false,
      statusCode: 429,
      message: 'common.error.TOO_MANY_REQUESTS',
    })
  })

  it('should throttle repeated invalid login attempts before service execution', async () => {
    const registerRes = await inject<AuthResponse>({
      method: 'POST',
      url: '/api/auth/register',
      headers: ajaxHeaders,
      payload: { email: 'limit-login@example.com', name: 'Limiter', password: 'password123' },
    })

    expect(registerRes.statusCode).toBe(201)

    const attempts: Array<{
      statusCode: number
      body: Record<string, unknown> | ApiResponse<unknown>
    }> = []

    for (let attempt = 0; attempt < 4; attempt += 1) {
      attempts.push(
        await inject({
          method: 'POST',
          url: '/api/auth/login',
          headers: ajaxHeaders,
          payload: { email: 'limit-login@example.com', password: 'wrong-password' },
        }),
      )
    }

    expect(attempts.map((result) => result.statusCode)).toEqual([401, 401, 401, 429])
  })

  it('should keep auth me under the global throttle budget', async () => {
    const registerRes = await inject<AuthResponse>({
      method: 'POST',
      url: '/api/auth/register',
      headers: ajaxHeaders,
      payload: { email: 'me-limit@example.com', name: 'Me Limit', password: 'password123' },
    })

    const { accessToken } = unwrapApiResponse(registerRes.body as ApiResponse<AuthResponse>)
    const requests: Array<{
      statusCode: number
      body: ApiResponse<User> | Record<string, unknown>
    }> = []

    for (let attempt = 0; attempt < 11; attempt += 1) {
      requests.push(
        await inject<User>({
          method: 'GET',
          url: '/api/auth/me',
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
        }),
      )
    }

    expect(requests.slice(0, 10).every((result) => result.statusCode === 200)).toBe(true)
    expect(requests[10]!.statusCode).toBe(429)
  })
})
