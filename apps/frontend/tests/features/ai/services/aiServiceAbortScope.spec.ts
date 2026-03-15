import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getAIStreamResponse,
  abortCurrentRequest,
  isRequestInProgress,
} from '@/features/ai/services/aiService'
import { _resetAIConfig } from '@/features/ai/composables/useAIConfig'

const fetchMock = vi.mocked(fetch)

function createAbortError(): Error {
  const err = new Error('Aborted')
  ;(err as Error & { name: string }).name = 'AbortError'
  return err
}

function createPendingAbortResponse(signal: AbortSignal): Response {
  return {
    ok: true,
    body: {
      getReader: () => ({
        read: vi.fn(
          () =>
            new Promise<ReadableStreamReadResult<Uint8Array>>((_, reject) => {
              if (signal.aborted) {
                reject(createAbortError())
                return
              }
              signal.addEventListener(
                'abort',
                () => {
                  reject(createAbortError())
                },
                { once: true },
              )
            }),
        ),
      }),
    },
  } as unknown as Response
}

describe('aiService - Abort Scope', () => {
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

  it('should isolate external abort signal from global request lifecycle', async () => {
    fetchMock.mockImplementation((_, init) => {
      const signal = (init?.signal || new AbortController().signal) as AbortSignal
      return Promise.resolve(createPendingAbortResponse(signal))
    })

    const onGlobalChunk = vi.fn()
    const onFloatingChunk = vi.fn()

    const globalPromise = getAIStreamResponse([], onGlobalChunk)
    await Promise.resolve()
    expect(isRequestInProgress()).toBe(true)

    const floatingController = new AbortController()
    const floatingPromise = getAIStreamResponse([], onFloatingChunk, undefined, undefined, {
      abortSignal: floatingController.signal,
    })
    await Promise.resolve()

    floatingController.abort()
    await floatingPromise

    expect(onFloatingChunk).toHaveBeenCalledWith('[ABORTED]')
    expect(isRequestInProgress()).toBe(true)

    abortCurrentRequest()
    await globalPromise

    expect(onGlobalChunk).toHaveBeenCalledWith('[ABORTED]')
    expect(isRequestInProgress()).toBe(false)
  })
})
