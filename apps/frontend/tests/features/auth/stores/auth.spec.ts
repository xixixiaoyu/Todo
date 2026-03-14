import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '@/features/auth/stores/auth'
import { authApi } from '@/features/auth/api'
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/server'
import type { User, LoginInput, RegisterInput } from '@lumina/shared'

// Mock authApi
vi.mock('@/features/auth/api', () => ({
  authApi: {
    login: vi.fn(),
    register: vi.fn(),
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
    getMe: vi.fn(),
    refreshToken: vi.fn(),
    logout: vi.fn(),
    getPasskeyRegistrationOptions: vi.fn(),
    verifyPasskeyRegistration: vi.fn(),
    getPasskeyLoginOptions: vi.fn(),
    verifyPasskeyLogin: vi.fn(),
  },
}))

// Mock @simplewebauthn/browser
vi.mock('@simplewebauthn/browser', () => ({
  startRegistration: vi.fn(),
  startAuthentication: vi.fn(),
}))

// Mock @/features/todo/stores/todo to avoid issues with dynamic imports and side effects
vi.mock('@/features/todo/stores/todo', () => ({
  useTodoStore: vi.fn(() => ({
    mergeOnLogin: vi.fn().mockResolvedValue(undefined),
    clearRemoteOnLogout: vi.fn(),
  })),
}))

import { startRegistration, startAuthentication } from '@simplewebauthn/browser'

describe('useAuthStore', () => {
  let store: ReturnType<typeof useAuthStore>

  const mockUser: User = {
    id: 1,
    email: 'test@example.com',
    name: 'Test User',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  const mockAuthResponse = {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    user: mockUser,
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useAuthStore()
    vi.clearAllMocks()
    localStorage.clear()
  })

  afterEach(() => {
    // Reset store state manually since setup syntax doesn't support $reset()
    store.token = null
    store.refreshToken = null
    store.user = null
    store.loading = false
    store.error = null
  })

  describe('initial state', () => {
    it('should initialize with default values', () => {
      expect(store.token).toBeNull()
      expect(store.refreshToken).toBeNull()
      expect(store.user).toBeNull()
      expect(store.loading).toBe(false)
      expect(store.error).toBeNull()
      expect(store.isAuthenticated).toBe(false)
    })
  })

  describe('login', () => {
    it('should login successfully', async () => {
      const credentials: LoginInput = {
        email: 'test@example.com',
        password: 'password123',
      }

      vi.mocked(authApi.login).mockResolvedValue({
        success: true,
        data: mockAuthResponse,
        timestamp: new Date().toISOString(),
      })

      const result = await store.login(credentials)

      expect(result).toBe(true)
      expect(store.token).toBe('access-token')
      expect(store.refreshToken).toBe('refresh-token')
      expect(store.user).toEqual(mockUser)
      expect(store.loading).toBe(false)
      expect(store.error).toBeNull()
      expect(authApi.login).toHaveBeenCalledWith(credentials)
      expect(JSON.parse(localStorage.getItem('auth') || '{}')).toEqual({
        token: 'access-token',
        refreshToken: 'refresh-token',
        user: mockUser,
      })
    })

    it('should handle login failure', async () => {
      const credentials: LoginInput = {
        email: 'test@example.com',
        password: 'wrong-password',
      }

      const error = {
        response: {
          data: {
            message: 'Invalid credentials',
          },
        },
      }

      vi.mocked(authApi.login).mockRejectedValue(error)

      const result = await store.login(credentials)

      expect(result).toBe(false)
      expect(store.token).toBeNull()
      expect(store.refreshToken).toBeNull()
      expect(store.user).toBeNull()
      expect(store.loading).toBe(false)
      expect(store.error).toBe('Invalid credentials')
    })

    it('should handle login failure without error message', async () => {
      const credentials: LoginInput = {
        email: 'test@example.com',
        password: 'wrong-password',
      }

      vi.mocked(authApi.login).mockRejectedValue({})

      const result = await store.login(credentials)

      expect(result).toBe(false)
      expect(store.error).toBe('login.failed')
    })
  })

  describe('Passkeys', () => {
    it('should register a passkey successfully', async () => {
      const options = { challenge: 'test-challenge' }
      const registrationResponse = { id: 'cred-id' }

      vi.mocked(authApi.getPasskeyRegistrationOptions).mockResolvedValue(
        options as unknown as PublicKeyCredentialCreationOptionsJSON,
      )
      vi.mocked(startRegistration).mockResolvedValue(
        registrationResponse as unknown as RegistrationResponseJSON,
      )
      vi.mocked(authApi.verifyPasskeyRegistration).mockResolvedValue({
        success: true,
        data: { success: true },
        timestamp: '',
      })

      const result = await store.registerPasskey()

      expect(result).toBe(true)
      expect(authApi.getPasskeyRegistrationOptions).toHaveBeenCalled()
      expect(startRegistration).toHaveBeenCalledWith({ optionsJSON: options })
      expect(authApi.verifyPasskeyRegistration).toHaveBeenCalledWith(
        registrationResponse,
        undefined,
      )
    })

    it('should register a passkey with name successfully', async () => {
      const options = { challenge: 'test-challenge' }
      const registrationResponse = { id: 'cred-id' }
      const name = 'My Device'

      vi.mocked(authApi.getPasskeyRegistrationOptions).mockResolvedValue(
        options as unknown as PublicKeyCredentialCreationOptionsJSON,
      )
      vi.mocked(startRegistration).mockResolvedValue(
        registrationResponse as unknown as RegistrationResponseJSON,
      )
      vi.mocked(authApi.verifyPasskeyRegistration).mockResolvedValue({
        success: true,
        data: { success: true },
        timestamp: '',
      })

      const result = await store.registerPasskey(name)

      expect(result).toBe(true)
      expect(authApi.verifyPasskeyRegistration).toHaveBeenCalledWith(registrationResponse, name)
    })

    it('should login with passkey successfully', async () => {
      const email = 'test@example.com'
      const options = { challenge: 'test-challenge' }
      const authResponse = { id: 'cred-id' }

      vi.mocked(authApi.getPasskeyLoginOptions).mockResolvedValue(
        options as unknown as PublicKeyCredentialRequestOptionsJSON,
      )
      vi.mocked(startAuthentication).mockResolvedValue(
        authResponse as unknown as AuthenticationResponseJSON,
      )
      vi.mocked(authApi.verifyPasskeyLogin).mockResolvedValue({
        success: true,
        data: mockAuthResponse,
        timestamp: '',
      })

      const result = await store.loginWithPasskey(email)

      expect(result).toBe(true)
      expect(store.user).toEqual(mockUser)
      expect(authApi.getPasskeyLoginOptions).toHaveBeenCalledWith(email)
      expect(startAuthentication).toHaveBeenCalledWith({ optionsJSON: options })
      expect(authApi.verifyPasskeyLogin).toHaveBeenCalledWith(email, authResponse)
      expect(JSON.parse(localStorage.getItem('auth') || '{}')).toEqual({
        token: 'access-token',
        refreshToken: 'refresh-token',
        user: mockUser,
      })
    })
  })

  describe('register', () => {
    it('should register successfully', async () => {
      const userData: RegisterInput = {
        email: 'new@example.com',
        password: 'password123',
        name: 'New User',
      }

      vi.mocked(authApi.register).mockResolvedValue({
        success: true,
        data: mockAuthResponse,
        timestamp: new Date().toISOString(),
      })

      const result = await store.register(userData)

      expect(result).toBe(true)
      expect(store.token).toBe('access-token')
      expect(store.refreshToken).toBe('refresh-token')
      expect(store.user).toEqual(mockUser)
      expect(authApi.register).toHaveBeenCalledWith(userData)
      expect(JSON.parse(localStorage.getItem('auth') || '{}')).toEqual({
        token: 'access-token',
        refreshToken: 'refresh-token',
        user: mockUser,
      })
    })

    it('should handle register failure', async () => {
      const userData: RegisterInput = {
        email: 'existing@example.com',
        password: 'password123',
        name: 'Existing User',
      }

      const error = {
        response: {
          data: {
            message: 'Email already exists',
          },
        },
      }

      vi.mocked(authApi.register).mockRejectedValue(error)

      const result = await store.register(userData)

      expect(result).toBe(false)
      expect(store.error).toBe('Email already exists')
    })
  })

  describe('forgotPassword', () => {
    it('should send forgot password request successfully', async () => {
      vi.mocked(authApi.forgotPassword).mockResolvedValue({
        success: true,
        data: { message: 'Reset email sent' },
        timestamp: new Date().toISOString(),
      })

      const result = await store.forgotPassword('test@example.com')

      expect(result).toBe(true)
      expect(store.loading).toBe(false)
      expect(store.error).toBeNull()
      expect(authApi.forgotPassword).toHaveBeenCalledWith('test@example.com')
    })

    it('should handle forgot password failure', async () => {
      const error = {
        response: {
          data: {
            message: 'User not found',
          },
        },
      }

      vi.mocked(authApi.forgotPassword).mockRejectedValue(error)

      const result = await store.forgotPassword('nonexistent@example.com')

      expect(result).toBe(false)
      expect(store.error).toBe('User not found')
    })
  })

  describe('resetPassword', () => {
    it('should reset password successfully', async () => {
      vi.mocked(authApi.resetPassword).mockResolvedValue({
        success: true,
        data: { message: 'Password reset successful' },
        timestamp: new Date().toISOString(),
      })

      const result = await store.resetPassword('reset-token', 'new-password')

      expect(result).toBe(true)
      expect(store.loading).toBe(false)
      expect(store.error).toBeNull()
      expect(authApi.resetPassword).toHaveBeenCalledWith('reset-token', 'new-password')
    })

    it('should handle reset password failure', async () => {
      const error = {
        response: {
          data: {
            message: 'Invalid token',
          },
        },
      }

      vi.mocked(authApi.resetPassword).mockRejectedValue(error)

      const result = await store.resetPassword('invalid-token', 'new-password')

      expect(result).toBe(false)
      expect(store.error).toBe('Invalid token')
    })
  })

  describe('fetchCurrentUser', () => {
    it('should fetch current user when token exists', async () => {
      store.token = 'access-token'

      vi.mocked(authApi.getMe).mockResolvedValue({
        success: true,
        data: mockUser,
        timestamp: new Date().toISOString(),
      })

      await store.fetchCurrentUser()

      expect(store.user).toEqual(mockUser)
      expect(authApi.getMe).toHaveBeenCalled()
    })

    it('should not fetch when token is null', async () => {
      await store.fetchCurrentUser()

      expect(authApi.getMe).not.toHaveBeenCalled()
    })

    it('should logout on fetch unauthorized', async () => {
      store.token = 'access-token'
      store.refreshToken = 'refresh-token'

      vi.mocked(authApi.getMe).mockRejectedValue({ response: { status: 401 } })
      vi.mocked(authApi.logout).mockResolvedValue({
        success: true,
        data: { message: 'Logged out' },
        timestamp: new Date().toISOString(),
      })

      await store.fetchCurrentUser()

      expect(store.token).toBeNull()
      expect(store.refreshToken).toBeNull()
      expect(store.user).toBeNull()
    })

    it('should keep session on transient fetch failure', async () => {
      store.token = 'access-token'
      store.refreshToken = 'refresh-token'
      store.user = mockUser

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      vi.mocked(authApi.getMe).mockRejectedValue(new Error('Network error'))

      await store.fetchCurrentUser()

      expect(store.token).toBe('access-token')
      expect(store.refreshToken).toBe('refresh-token')
      expect(store.user).toEqual(mockUser)
      expect(authApi.logout).not.toHaveBeenCalled()
      expect(warnSpy).toHaveBeenCalledWith(
        'Fetch current user failed (transient):',
        expect.any(Error),
      )
      warnSpy.mockRestore()
    })
  })

  describe('refreshAccessToken', () => {
    it('should refresh token successfully', async () => {
      store.refreshToken = 'refresh-token'

      vi.mocked(authApi.refreshToken).mockResolvedValue({
        success: true,
        data: mockAuthResponse,
        timestamp: new Date().toISOString(),
      })

      const result = await store.refreshAccessToken()

      expect(result).toBe(true)
      expect(store.token).toBe('access-token')
      expect(store.refreshToken).toBe('refresh-token')
      expect(store.user).toEqual(mockUser)
      expect(JSON.parse(localStorage.getItem('auth') || '{}')).toEqual({
        token: 'access-token',
        refreshToken: 'refresh-token',
        user: mockUser,
      })
    })

    it('should return false when no refresh token', async () => {
      const result = await store.refreshAccessToken()

      expect(result).toBe(false)
      expect(authApi.refreshToken).not.toHaveBeenCalled()
    })

    it('should logout on refresh unauthorized failure', async () => {
      store.refreshToken = 'invalid-token'
      store.token = 'access-token'

      vi.mocked(authApi.refreshToken).mockRejectedValue({ response: { status: 401 } })
      vi.mocked(authApi.logout).mockResolvedValue({
        success: true,
        data: { message: 'Logged out' },
        timestamp: new Date().toISOString(),
      })

      const result = await store.refreshAccessToken()

      expect(result).toBe(false)
      expect(store.token).toBeNull()
      expect(store.refreshToken).toBeNull()
      expect(store.user).toBeNull()
    })

    it('should keep session on transient refresh failure', async () => {
      store.refreshToken = 'refresh-token'
      store.token = 'access-token'
      store.user = mockUser

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      vi.mocked(authApi.refreshToken).mockRejectedValue(new Error('Network error'))

      const result = await store.refreshAccessToken()

      expect(result).toBe(false)
      expect(store.token).toBe('access-token')
      expect(store.refreshToken).toBe('refresh-token')
      expect(store.user).toEqual(mockUser)
      expect(authApi.logout).not.toHaveBeenCalled()
      expect(warnSpy).toHaveBeenCalledWith(
        'Refresh access token failed (transient):',
        expect.any(Error),
      )
      warnSpy.mockRestore()
    })

    it('should retry once on transient refresh failure and succeed', async () => {
      store.refreshToken = 'refresh-token'
      store.token = 'access-token'
      store.user = mockUser

      vi.mocked(authApi.refreshToken)
        .mockRejectedValueOnce({ response: { status: 503 } })
        .mockResolvedValueOnce({
          success: true,
          data: mockAuthResponse,
          timestamp: new Date().toISOString(),
        })

      const result = await store.refreshAccessToken()

      expect(result).toBe(true)
      expect(authApi.refreshToken).toHaveBeenCalledTimes(2)
      expect(store.token).toBe('access-token')
      expect(store.refreshToken).toBe('refresh-token')
      expect(store.user).toEqual(mockUser)
    })

    it('should refresh token using stored refresh token', async () => {
      const storedAuth = {
        token: null,
        refreshToken: 'refresh-token',
        user: mockUser,
      }

      localStorage.setItem('auth', JSON.stringify(storedAuth))

      vi.mocked(authApi.refreshToken).mockResolvedValue({
        success: true,
        data: mockAuthResponse,
        timestamp: new Date().toISOString(),
      })

      const result = await store.refreshAccessToken()

      expect(result).toBe(true)
      expect(authApi.refreshToken).toHaveBeenCalledWith('refresh-token')
      expect(store.token).toBe('access-token')
      expect(store.refreshToken).toBe('refresh-token')
      expect(store.user).toEqual(mockUser)
    })
  })

  describe('logout', () => {
    it('should logout successfully', async () => {
      store.token = 'access-token'
      store.refreshToken = 'refresh-token'
      store.user = mockUser

      vi.mocked(authApi.logout).mockResolvedValue({
        success: true,
        data: { message: 'Logged out' },
        timestamp: new Date().toISOString(),
      })

      await store.logout()

      expect(store.token).toBeNull()
      expect(store.refreshToken).toBeNull()
      expect(store.user).toBeNull()
      expect(store.error).toBeNull()
      expect(authApi.logout).toHaveBeenCalledWith('refresh-token')
      expect(localStorage.getItem('auth')).toBeNull()
    })

    it('should clear state even if logout API fails', async () => {
      store.token = 'access-token'
      store.refreshToken = 'refresh-token'
      store.user = mockUser

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const error = new Error('Network error')
      vi.mocked(authApi.logout).mockRejectedValue(error)

      await store.logout()

      expect(warnSpy).toHaveBeenCalledWith('Backend logout failed (likely token expired):', error)

      warnSpy.mockRestore()

      expect(store.token).toBeNull()
      expect(store.refreshToken).toBeNull()
      expect(store.user).toBeNull()
      expect(store.error).toBeNull()
    })

    it('should logout without refresh token', async () => {
      store.token = 'access-token'
      store.user = mockUser

      await store.logout()

      expect(store.token).toBeNull()
      expect(store.user).toBeNull()
      expect(authApi.logout).not.toHaveBeenCalled()
    })
  })

  describe('clearError', () => {
    it('should clear error and field errors', () => {
      store.error = 'Some error'
      store.fieldErrors = { password: 'validation.MIN_LENGTH' }

      store.clearError()

      expect(store.error).toBeNull()
      expect(store.fieldErrors).toEqual({})
    })
  })

  describe('isAuthenticated', () => {
    it('should return true when token exists', () => {
      store.token = 'access-token'

      expect(store.isAuthenticated).toBe(true)
    })

    it('should return false when token is null', () => {
      store.token = null

      expect(store.isAuthenticated).toBe(false)
    })

    it('should return false when user exists but token is null', () => {
      store.user = mockUser
      store.token = null

      expect(store.isAuthenticated).toBe(false)
    })
  })
})
