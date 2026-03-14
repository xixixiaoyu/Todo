import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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

  it('should create axios instance with correct config', async () => {
    vi.resetModules()
    const { httpClient } = await import('@/api')

    // The httpClient is created at module import time
    // We just verify it exists and has the expected structure
    expect(httpClient).toBeDefined()
    expect(httpClient.interceptors).toBeDefined()
    expect(httpClient.interceptors.request).toBeDefined()
    expect(httpClient.interceptors.response).toBeDefined()
  })

  it('should set up request interceptor', async () => {
    vi.resetModules()
    const { httpClient } = await import('@/api')

    const requestUse = vi.mocked(httpClient.interceptors.request.use)
    expect(requestUse).toHaveBeenCalledTimes(1)
    expect(typeof requestUse.mock.calls[0]?.[0]).toBe('function')
  })

  it('should set up response interceptor', async () => {
    vi.resetModules()
    const { httpClient } = await import('@/api')

    const responseUse = vi.mocked(httpClient.interceptors.response.use)
    expect(responseUse).toHaveBeenCalledTimes(1)
    expect(typeof responseUse.mock.calls[0]?.[1]).toBe('function')
  })
})

describe('response interceptor', () => {
  type ResponseErrorHandler = (error: {
    config: { _retry?: boolean; url?: string; headers?: Record<string, string> }
    response?: { status: number }
  }) => Promise<unknown>

  it('should reject with invalid error when refresh succeeds without token', async () => {
    const authStore = {
      refreshAccessToken: vi.fn().mockResolvedValue(true),
      token: null,
      isAuthenticated: false,
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
    expect(authStore.logout).not.toHaveBeenCalled()
  })

  it('should reject without logout when refreshAccessToken throws error', async () => {
    const refreshError = new Error('Network error during refresh')
    const authStore = {
      refreshAccessToken: vi.fn().mockRejectedValue(refreshError),
      isAuthenticated: true,
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
    expect(authStore.logout).not.toHaveBeenCalled()
  })
})

describe('getToken', () => {
  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
  })

  it('should get token from localStorage when exists', async () => {
    localStorage.setItem('auth', JSON.stringify({ token: 'test-token', refreshToken: 'r1' }))

    const { getToken, setToken } = await import('@/api')
    setToken(null)

    expect(getToken()).toBe('test-token')
  })

  it('should return null when localStorage has no auth data', async () => {
    const { getToken, setToken } = await import('@/api')
    setToken(null)

    expect(getToken()).toBeNull()
  })

  it('should return null when localStorage has invalid JSON', async () => {
    localStorage.setItem('auth', 'invalid json')

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { getToken, setToken } = await import('@/api')
    setToken(null)

    expect(getToken()).toBeNull()
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to parse auth token from localStorage:'),
      expect.any(SyntaxError),
    )

    warnSpy.mockRestore()
  })

  it('should return null when auth data has no token', async () => {
    localStorage.setItem('auth', JSON.stringify({ refreshToken: 'refresh-token' }))

    const { getToken, setToken } = await import('@/api')
    setToken(null)

    expect(getToken()).toBeNull()
  })

  it('should read token from pinia-persisted state shape', async () => {
    localStorage.setItem('auth', JSON.stringify({ state: { token: 'state-token' } }))

    const { getToken, setToken } = await import('@/api')
    setToken(null)

    expect(getToken()).toBe('state-token')
  })

  it('should prefer in-memory token over localStorage', async () => {
    localStorage.setItem('auth', JSON.stringify({ token: 'storage-token' }))

    const { getToken, setToken } = await import('@/api')
    setToken('memory-token')

    expect(getToken()).toBe('memory-token')
  })
})
