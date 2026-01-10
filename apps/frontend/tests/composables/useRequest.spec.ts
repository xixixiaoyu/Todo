import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useRequest } from '@/composables/useRequest'

describe('useRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should initialize with default state', () => {
    const mockFn = vi.fn().mockResolvedValue('test data')
    const { data, loading, error } = useRequest(mockFn)

    expect(data.value).toBeNull()
    expect(loading.value).toBe(false)
    expect(error.value).toBeNull()
  })

  it('should set loading to true during request', async () => {
    const mockFn = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve('test data'), 100)
        }),
    )
    const { data, loading, error, execute } = useRequest(mockFn)

    const promise = execute()
    expect(loading.value).toBe(true)
    expect(error.value).toBeNull()

    await promise
    expect(loading.value).toBe(false)
    expect(data.value).toBe('test data')
  })

  it('should set data on successful request', async () => {
    const mockData = { id: 1, name: 'test' }
    const mockFn = vi.fn().mockResolvedValue(mockData)
    const { data, execute } = useRequest(mockFn)

    await execute()

    expect(data.value).toEqual(mockData)
  })

  it('should set error on failed request', async () => {
    const mockError = new Error('Request failed')
    const mockFn = vi.fn().mockRejectedValue(mockError)
    const { data, loading, error, execute } = useRequest(mockFn)

    await execute()

    expect(data.value).toBeNull()
    expect(loading.value).toBe(false)
    expect(error.value).toBe('Request failed')
  })

  it('should handle non-Error exceptions', async () => {
    const mockFn = vi.fn().mockRejectedValue('String error')
    const { error, execute } = useRequest(mockFn)

    await execute()

    expect(error.value).toBe('请求失败')
  })

  it('should reset error before each request', async () => {
    const mockFn = vi
      .fn()
      .mockRejectedValueOnce(new Error('First error'))
      .mockResolvedValueOnce('success')
    const { error, execute } = useRequest(mockFn)

    await execute()
    expect(error.value).toBe('First error')

    await execute()
    expect(error.value).toBeNull()
  })

  it('should support multiple execute calls', async () => {
    const mockFn = vi.fn().mockResolvedValueOnce('first').mockResolvedValueOnce('second')
    const { data, execute } = useRequest(mockFn)

    await execute()
    expect(data.value).toBe('first')

    await execute()
    expect(data.value).toBe('second')
  })

  it('should work with different data types', async () => {
    const mockFn = vi.fn().mockResolvedValue([1, 2, 3])
    const { data, execute } = useRequest<number[]>(mockFn)

    await execute()

    expect(data.value).toEqual([1, 2, 3])
  })
})
