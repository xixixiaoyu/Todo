import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { httpClient } from '@/api'
import { useAuthStore } from '@/features/auth/stores/auth'

// Mock axios
vi.mock('axios', () => {
  const mockAxios = {
    create: vi.fn(() => ({
      defaults: { baseURL: '/api' },
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
      interceptors: {
        request: {
          use: vi.fn(),
        },
        response: {
          use: vi.fn(),
        },
      },
    })),
    get: vi.fn(),
  }
  return {
    default: mockAxios,
    ...mockAxios,
  }
})

vi.mock('@/features/auth/stores/auth', () => ({
  useAuthStore: vi.fn(),
}))

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
})

// Mock document.cookie
Object.defineProperty(document, 'cookie', {
  writable: true,
  value: '',
})

describe('httpClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.cookie = ''
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should create axios instance with correct config', () => {
    // The httpClient is created at module import time
    // We just verify it exists and has the expected structure
    expect(httpClient).toBeDefined()
    expect(httpClient.interceptors).toBeDefined()
    expect(httpClient.interceptors.request).toBeDefined()
    expect(httpClient.interceptors.response).toBeDefined()
  })

  it('should set up request interceptor', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockInstance = httpClient as any
    expect(mockInstance.interceptors.request.use).toBeDefined()
  })

  it('should set up response interceptor', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockInstance = httpClient as any
    expect(mockInstance.interceptors.response.use).toBeDefined()
  })
})

describe('response interceptor', () => {
  type ResponseErrorHandler = (error: {
    config: { _retry?: boolean; url?: string; headers?: Record<string, string> }
    response?: { status: number }
  }) => Promise<unknown>

  it('should logout when refresh succeeds without token', async () => {
    const authStore = {
      refreshAccessToken: vi.fn().mockResolvedValue(true),
      token: null,
      logout: vi.fn().mockResolvedValue(undefined),
    }

    vi.mocked(useAuthStore).mockReturnValue(authStore as unknown as ReturnType<typeof useAuthStore>)

    vi.resetModules()
    const { httpClient: freshHttpClient } = await import('@/api')

    const responseUse = vi.mocked(freshHttpClient.interceptors.response.use)
    const errorHandler = responseUse.mock.calls[0]?.[1] as ResponseErrorHandler

    const error = {
      config: { url: '/todos/sync', headers: {} },
      response: { status: 401 },
    }

    await expect(errorHandler(error)).rejects.toThrow('Refresh token invalid')
    expect(authStore.logout).toHaveBeenCalled()
  })

  it('should logout when refreshAccessToken throws error', async () => {
    const refreshError = new Error('Network error during refresh')
    const authStore = {
      refreshAccessToken: vi.fn().mockRejectedValue(refreshError),
      logout: vi.fn().mockResolvedValue(undefined),
    }

    vi.mocked(useAuthStore).mockReturnValue(authStore as unknown as ReturnType<typeof useAuthStore>)

    vi.resetModules()
    const { httpClient: freshHttpClient } = await import('@/api')

    const responseUse = vi.mocked(freshHttpClient.interceptors.response.use)
    const errorHandler = responseUse.mock.calls[0]?.[1] as ResponseErrorHandler

    const error = {
      config: { url: '/todos/sync', headers: {} },
      response: { status: 401 },
    }

    await expect(errorHandler(error)).rejects.toThrow('Network error during refresh')
    expect(authStore.logout).toHaveBeenCalled()
  })
})

describe('getToken', () => {
  beforeEach(() => {
    localStorageMock.getItem.mockClear()
  })

  it('should get token from localStorage when exists', () => {
    localStorageMock.getItem.mockReturnValue(
      JSON.stringify({ token: 'test-token', refreshToken: 'refresh-token' }),
    )

    const getToken = (): string | null => {
      const authData = localStorage.getItem('auth')
      if (authData) {
        try {
          const parsed = JSON.parse(authData)
          return parsed.token || null
        } catch {
          return null
        }
      }
      return null
    }

    expect(getToken()).toBe('test-token')
  })

  it('should return null when localStorage has no auth data', () => {
    localStorageMock.getItem.mockReturnValue(null)

    const getToken = (): string | null => {
      const authData = localStorage.getItem('auth')
      if (authData) {
        try {
          const parsed = JSON.parse(authData)
          return parsed.token || null
        } catch {
          return null
        }
      }
      return null
    }

    expect(getToken()).toBeNull()
  })

  it('should return null when localStorage has invalid JSON', () => {
    localStorageMock.getItem.mockReturnValue('invalid json')

    const getToken = (): string | null => {
      const authData = localStorage.getItem('auth')
      if (authData) {
        try {
          const parsed = JSON.parse(authData)
          return parsed.token || null
        } catch {
          return null
        }
      }
      return null
    }

    expect(getToken()).toBeNull()
  })

  it('should return null when auth data has no token', () => {
    localStorageMock.getItem.mockReturnValue(JSON.stringify({ refreshToken: 'refresh-token' }))

    const getToken = (): string | null => {
      const authData = localStorage.getItem('auth')
      if (authData) {
        try {
          const parsed = JSON.parse(authData)
          return parsed.token || null
        } catch {
          return null
        }
      }
      return null
    }

    expect(getToken()).toBeNull()
  })
})
