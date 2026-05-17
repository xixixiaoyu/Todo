import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

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

describe('httpClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
