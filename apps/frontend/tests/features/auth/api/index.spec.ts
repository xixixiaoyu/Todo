import { describe, it, expect, vi, beforeEach } from 'vitest'
import { authApi } from '@/features/auth/api'
import { httpClient } from '@/api'

// Mock httpClient
vi.mock('@/api', () => ({
  httpClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

describe('authApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getMe', () => {
    it('should get current user info', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const mockResponse = {
        success: true,
        data: mockUser,
        timestamp: new Date().toISOString(),
      }

      vi.mocked(httpClient.get).mockResolvedValue({ data: mockResponse })

      const result = await authApi.getMe()

      expect(httpClient.get).toHaveBeenCalledWith('/auth/me')
      expect(result).toEqual(mockResponse)
    })
  })

  describe('login', () => {
    it('should login with credentials', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'password123',
      }

      const mockAuthResponse = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: {
          id: 1,
          email: 'test@example.com',
          name: 'Test User',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      }

      const mockResponse = {
        success: true,
        data: mockAuthResponse,
        timestamp: new Date().toISOString(),
      }

      vi.mocked(httpClient.post).mockResolvedValue({ data: mockResponse })

      const result = await authApi.login(credentials)

      expect(httpClient.post).toHaveBeenCalledWith('/auth/login', credentials)
      expect(result).toEqual(mockResponse)
    })
  })

  describe('register', () => {
    it('should register with user data', async () => {
      const userData = {
        email: 'new@example.com',
        password: 'password123',
        name: 'New User',
      }

      const mockAuthResponse = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: {
          id: 1,
          email: 'new@example.com',
          name: 'New User',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      }

      const mockResponse = {
        success: true,
        data: mockAuthResponse,
        timestamp: new Date().toISOString(),
      }

      vi.mocked(httpClient.post).mockResolvedValue({ data: mockResponse })

      const result = await authApi.register(userData)

      expect(httpClient.post).toHaveBeenCalledWith('/auth/register', userData)
      expect(result).toEqual(mockResponse)
    })
  })

  describe('forgotPassword', () => {
    it('should send forgot password request', async () => {
      const email = 'test@example.com'

      const mockResponse = {
        success: true,
        data: { message: 'Reset email sent' },
        timestamp: new Date().toISOString(),
      }

      vi.mocked(httpClient.post).mockResolvedValue({ data: mockResponse })

      const result = await authApi.forgotPassword(email)

      expect(httpClient.post).toHaveBeenCalledWith('/auth/forgot-password', { email })
      expect(result).toEqual(mockResponse)
    })
  })

  describe('resetPassword', () => {
    it('should reset password with token', async () => {
      const token = 'reset-token'
      const password = 'new-password'

      const mockResponse = {
        success: true,
        data: { message: 'Password reset successful' },
        timestamp: new Date().toISOString(),
      }

      vi.mocked(httpClient.post).mockResolvedValue({ data: mockResponse })

      const result = await authApi.resetPassword(token, password)

      expect(httpClient.post).toHaveBeenCalledWith('/auth/reset-password', {
        token,
        password,
      })
      expect(result).toEqual(mockResponse)
    })
  })

  describe('refreshToken', () => {
    it('should refresh access token', async () => {
      const refreshToken = 'refresh-token'

      const mockAuthResponse = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        user: {
          id: 1,
          email: 'test@example.com',
          name: 'Test User',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      }

      const mockResponse = {
        success: true,
        data: mockAuthResponse,
        timestamp: new Date().toISOString(),
      }

      vi.mocked(httpClient.post).mockResolvedValue({ data: mockResponse })

      const result = await authApi.refreshToken(refreshToken)

      expect(httpClient.post).toHaveBeenCalledWith('/auth/refresh', { refreshToken })
      expect(result).toEqual(mockResponse)
    })
  })

  describe('logout', () => {
    it('should logout with refresh token', async () => {
      const refreshToken = 'refresh-token'

      const mockResponse = {
        success: true,
        data: { message: 'Logged out' },
        timestamp: new Date().toISOString(),
      }

      vi.mocked(httpClient.post).mockResolvedValue({ data: mockResponse })

      const result = await authApi.logout(refreshToken)

      expect(httpClient.post).toHaveBeenCalledWith('/auth/logout', { refreshToken })
      expect(result).toEqual(mockResponse)
    })
  })
})
