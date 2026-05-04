import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/api', () => ({
  httpClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

import { httpClient } from '@/api'
import { getJson, postJson, putJson, patchJson, deleteJson } from '@/api/unwrap'
import { ApiError } from '@lumina/shared'

const mockedGet = vi.mocked(httpClient.get)
const mockedPost = vi.mocked(httpClient.post)
const mockedPut = vi.mocked(httpClient.put)
const mockedPatch = vi.mocked(httpClient.patch)
const mockedDelete = vi.mocked(httpClient.delete)

function axiosLike<T>(payload: T) {
  return Promise.resolve({ data: payload } as { data: T })
}

describe('@/api/unwrap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getJson 解包 ApiSuccessResponse 为纯数据，避免 v-for 错遍历包装对象', async () => {
    mockedGet.mockReturnValueOnce(
      axiosLike({
        success: true,
        data: [{ id: 'd1', title: 'A' }],
        timestamp: '2026-01-01T00:00:00.000Z',
      }),
    )

    const list = await getJson<Array<{ id: string; title: string }>>('/teaching/overview')

    expect(Array.isArray(list)).toBe(true)
    expect(list).toEqual([{ id: 'd1', title: 'A' }])
    expect(mockedGet).toHaveBeenCalledWith('/teaching/overview')
  })

  it('getJson 遇到 ApiErrorResponse 时抛出 ApiError，携带 statusCode', async () => {
    mockedGet.mockReturnValueOnce(
      axiosLike({
        success: false,
        data: null,
        message: 'boom',
        statusCode: 500,
        timestamp: '2026-01-01T00:00:00.000Z',
      }),
    )

    try {
      await getJson('/teaching/overview')
      expect.unreachable('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError)
      expect((e as ApiError).statusCode).toBe(500)
      expect((e as ApiError).message).toBe('boom')
    }
  })

  it('postJson 透传 body 并解包返回对象', async () => {
    mockedPost.mockReturnValueOnce(
      axiosLike({
        success: true,
        data: { id: 'new-1', title: 'Hello' },
        timestamp: '2026-01-01T00:00:00.000Z',
      }),
    )

    const draft = await postJson<{ id: string; title: string }>('/teaching/overview', {
      title: 'Hello',
    })

    expect(draft).toEqual({ id: 'new-1', title: 'Hello' })
    expect(mockedPost).toHaveBeenCalledWith('/teaching/overview', { title: 'Hello' })
  })

  it('putJson 透传 body 并解包', async () => {
    mockedPut.mockReturnValueOnce(
      axiosLike({
        success: true,
        data: { concept: 'math', masteryLevel: 'developing' },
        timestamp: '2026-01-01T00:00:00.000Z',
      }),
    )

    const progress = await putJson<{ concept: string; masteryLevel: string }>(
      '/teaching/progress',
      { concept: 'math', masteryLevel: 'developing' },
    )

    expect(progress).toEqual({ concept: 'math', masteryLevel: 'developing' })
    expect(mockedPut).toHaveBeenCalledWith('/teaching/progress', {
      concept: 'math',
      masteryLevel: 'developing',
    })
  })

  it('patchJson 透传 body 并解包', async () => {
    mockedPatch.mockReturnValueOnce(
      axiosLike({
        success: true,
        data: { id: 'd1', title: 'renamed' },
        timestamp: '2026-01-01T00:00:00.000Z',
      }),
    )

    const draft = await patchJson<{ id: string; title: string }>('/teaching/overview/123', {
      title: 'renamed',
    })

    expect(draft).toEqual({ id: 'd1', title: 'renamed' })
    expect(mockedPatch).toHaveBeenCalledWith('/teaching/overview/123', { title: 'renamed' })
  })

  it('deleteJson 透传 id 至删除路径', async () => {
    mockedDelete.mockReturnValueOnce(
      axiosLike({
        success: true,
        data: { id: 'd1' },
        timestamp: '2026-01-01T00:00:00.000Z',
      }),
    )

    await deleteJson('/teaching/overview/123')

    expect(mockedDelete).toHaveBeenCalledWith('/teaching/overview/123')
  })

  it('getJson 兼容无 success 字段的旧格式响应，直接取 data', async () => {
    mockedGet.mockReturnValueOnce(
      axiosLike({
        data: { id: 'legacy-1', name: 'old-format' },
        timestamp: '2026-01-01T00:00:00.000Z',
      }),
    )

    const result = await getJson<{ id: string; name: string }>('/legacy/endpoint')

    expect(result).toEqual({ id: 'legacy-1', name: 'old-format' })
  })
})
