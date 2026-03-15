import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getAIStreamResponse, getAIStaticResponse } from '@/features/ai/services/core'
import { getAIImageResponse } from '@/features/ai/services/features'
import { _resetAIConfig } from '@/features/ai/composables/useAIConfig'

const fetchMock = vi.mocked(fetch)

describe('aiService - Request Parameters', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    localStorage.clear()
    localStorage.setItem(
      'ai-config',
      JSON.stringify({
        baseUrl: 'https://api.example.com',
        apiKey: 'sk-test',
        model: 'test-model',
      }),
    )
    _resetAIConfig()
  })

  describe('getAIStreamResponse', () => {
    it('should include top_p: 0.95 by default', async () => {
      const onChunk = vi.fn()
      const encoder = new TextEncoder()

      fetchMock.mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: vi
              .fn()
              .mockResolvedValueOnce({
                value: encoder.encode('data: [DONE]\n\n'),
                done: false,
              })
              .mockResolvedValueOnce({
                value: null,
                done: true,
              }),
          }),
        },
      } as unknown as Response)

      await getAIStreamResponse([], onChunk)

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const callArgs = fetchMock.mock.calls[0]
      const requestBody = JSON.parse(callArgs[1]?.body as string)

      expect(requestBody).toHaveProperty('top_p', 0.95)
    })

    it('should use provided top_p if specified in options', async () => {
      const onChunk = vi.fn()
      const encoder = new TextEncoder()

      fetchMock.mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: vi
              .fn()
              .mockResolvedValueOnce({
                value: encoder.encode('data: [DONE]\n\n'),
                done: false,
              })
              .mockResolvedValueOnce({
                value: null,
                done: true,
              }),
          }),
        },
      } as unknown as Response)

      await getAIStreamResponse([], onChunk, undefined, undefined, { top_p: 0.8 })

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const callArgs = fetchMock.mock.calls[0]
      const requestBody = JSON.parse(callArgs[1]?.body as string)

      expect(requestBody).toHaveProperty('top_p', 0.8)
    })

    it('should include reasoning effort when thinkingMode is enabled', async () => {
      const onChunk = vi.fn()
      const encoder = new TextEncoder()

      fetchMock.mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: vi
              .fn()
              .mockResolvedValueOnce({
                value: encoder.encode('data: [DONE]\n\n'),
                done: false,
              })
              .mockResolvedValueOnce({
                value: null,
                done: true,
              }),
          }),
        },
      } as unknown as Response)

      await getAIStreamResponse([], onChunk, undefined, undefined, { thinkingMode: 'enabled' })

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const callArgs = fetchMock.mock.calls[0]
      const requestBody = JSON.parse(callArgs[1]?.body as string)

      expect(requestBody.reasoning).toEqual({ enabled: true, effort: 'high' })
    })

    it('should allow overriding reasoning effort', async () => {
      const onChunk = vi.fn()
      const encoder = new TextEncoder()

      fetchMock.mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: vi
              .fn()
              .mockResolvedValueOnce({
                value: encoder.encode('data: [DONE]\n\n'),
                done: false,
              })
              .mockResolvedValueOnce({
                value: null,
                done: true,
              }),
          }),
        },
      } as unknown as Response)

      await getAIStreamResponse([], onChunk, undefined, undefined, {
        thinkingMode: 'enabled',
        thinkingEffort: 'low',
      })

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const callArgs = fetchMock.mock.calls[0]
      const requestBody = JSON.parse(callArgs[1]?.body as string)

      expect(requestBody.reasoning).toEqual({ enabled: true, effort: 'low' })
    })
  })

  describe('getAIStaticResponse', () => {
    it('should include temperature: 0.6 by default', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Hello' } }],
        }),
      } as Response)

      await getAIStaticResponse([])

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const callArgs = fetchMock.mock.calls[0]
      const requestBody = JSON.parse(callArgs[1]?.body as string)

      expect(requestBody).toHaveProperty('temperature', 0.6)
    })

    it('should include top_p: 0.95 by default', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Hello' } }],
        }),
      } as Response)

      await getAIStaticResponse([])

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const callArgs = fetchMock.mock.calls[0]
      const requestBody = JSON.parse(callArgs[1]?.body as string)

      expect(requestBody).toHaveProperty('top_p', 0.95)
    })

    it('should use provided top_p if specified in options', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Hello' } }],
        }),
      } as Response)

      await getAIStaticResponse([], { top_p: 0.7 })

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const callArgs = fetchMock.mock.calls[0]
      const requestBody = JSON.parse(callArgs[1]?.body as string)

      expect(requestBody).toHaveProperty('top_p', 0.7)
    })
  })

  describe('getAIImageResponse', () => {
    it('should include top_p: 0.95 by default', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { images: [{ image_url: { url: 'http://image.url' } }] } }],
        }),
      } as Response)

      await getAIImageResponse('prompt')

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const callArgs = fetchMock.mock.calls[0]
      const requestBody = JSON.parse(callArgs[1]?.body as string)

      expect(requestBody).toHaveProperty('top_p', 0.95)
    })

    it('should use provided top_p if specified in options', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { images: [{ image_url: { url: 'http://image.url' } }] } }],
        }),
      } as Response)

      await getAIImageResponse('prompt', [], { top_p: 0.6 })

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const callArgs = fetchMock.mock.calls[0]
      const requestBody = JSON.parse(callArgs[1]?.body as string)

      expect(requestBody).toHaveProperty('top_p', 0.6)
    })
  })
})
