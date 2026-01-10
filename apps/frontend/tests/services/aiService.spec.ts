import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getMultiModelDiscussionStream } from '@/services/aiService'
import { _resetAIConfig } from '@/composables/useAIConfig'
import type { ChatMessage } from '@/composables/useChat'

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString()
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
})

// Mock fetch
const mockFetch = vi.fn()
Object.defineProperty(window, 'fetch', {
  value: mockFetch,
})

// Mock i18n
vi.mock('@/i18n', () => ({
  default: {
    global: {
      t: vi.fn((key: string, params?: any) => {
        if (key === 'ai.parallelSynthesisPrompt') {
          return `Synthesis: ${params.originalQuery} - ${params.discussionData}`
        }
        return key
      }),
    },
  },
}))

describe('aiService - Multi-model Discussion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLocalStorage.clear()

    // Default fetch mock for single model stream
    mockFetch.mockImplementation(async () => ({
      ok: true,
      body: {
        getReader: () => ({
          read: vi
            .fn()
            .mockResolvedValueOnce({
              value: new TextEncoder().encode(
                'data: {"choices":[{"delta":{"content":"Default response"}}]}\n\n',
              ),
              done: false,
            })
            .mockResolvedValueOnce({
              value: new TextEncoder().encode('data: [DONE]\n\n'),
              done: true,
            }),
        }),
      },
    }))
  })

  it('should fall back to single model if no presets are selected', async () => {
    const messages: ChatMessage[] = [{ id: '1', role: 'user', content: 'Hello' }]
    const onStepUpdate = vi.fn()
    const onFinalChunk = vi.fn()

    mockLocalStorage.setItem(
      'ai-config',
      JSON.stringify({
        discussionMode: true,
        discussionModelIds: [],
      }),
    )
    _resetAIConfig()

    await getMultiModelDiscussionStream(messages, onStepUpdate, onFinalChunk)

    expect(onStepUpdate).not.toHaveBeenCalled()
    expect(onFinalChunk).toHaveBeenCalledWith('Default response')
  })

  it('should handle multi-model discussion (parallel) correctly', async () => {
    const messages: ChatMessage[] = [{ id: '1', role: 'user', content: 'What is 1+1?' }]
    const onStepUpdate = vi.fn()
    const onFinalChunk = vi.fn()

    const presets = [
      {
        id: 'p1',
        name: 'Model A',
        baseUrl: 'https://api.a.com',
        apiKey: 'key-a',
        model: 'model-a',
      },
      {
        id: 'p2',
        name: 'Model B',
        baseUrl: 'https://api.b.com',
        apiKey: 'key-b',
        model: 'model-b',
      },
    ]
    mockLocalStorage.setItem('ai-presets', JSON.stringify(presets))
    mockLocalStorage.setItem(
      'ai-config',
      JSON.stringify({
        discussionMode: true,
        discussionModelIds: ['p1', 'p2'],
      }),
    )
    _resetAIConfig()

    mockFetch.mockImplementation(async (url: string, init: any) => {
      // 流式请求 (synthesis)
      if (init?.body && JSON.parse(init.body).stream === true) {
        return {
          ok: true,
          body: {
            getReader: () => ({
              read: vi
                .fn()
                .mockResolvedValueOnce({
                  value: new TextEncoder().encode(
                    'data: {"choices":[{"delta":{"content":"Final synthesis"}}]}\n\n',
                  ),
                  done: false,
                })
                .mockResolvedValueOnce({
                  value: new TextEncoder().encode('data: [DONE]\n\n'),
                  done: true,
                }),
            }),
          },
        }
      }

      // 并行请求 (non-stream)
      const content = url.includes('api.a.com') ? 'Answer from A' : 'Answer from B'
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content } }],
        }),
      }
    })

    await getMultiModelDiscussionStream(messages, onStepUpdate, onFinalChunk)

    expect(onStepUpdate).toHaveBeenCalled()
    const lastSteps = onStepUpdate.mock.calls[onStepUpdate.mock.calls.length - 1][0]
    expect(lastSteps).toHaveLength(2) // 2 parallel models
    expect(lastSteps[0].modelId).toBe('p1')
    expect(lastSteps[0].status).toBe('done')
    expect(lastSteps[0].content).toBe('Answer from A')
    expect(lastSteps[1].modelId).toBe('p2')
    expect(lastSteps[1].status).toBe('done')
    expect(lastSteps[1].content).toBe('Answer from B')
    expect(onFinalChunk).toHaveBeenCalledWith('Final synthesis')
  })

  it('should handle model errors gracefully', async () => {
    const messages: ChatMessage[] = [{ id: '1', role: 'user', content: 'Hello' }]
    const onStepUpdate = vi.fn()
    const onFinalChunk = vi.fn()

    const presets = [
      {
        id: 'p1',
        name: 'Model A',
        baseUrl: 'https://api.a.com',
        apiKey: 'key-a',
        model: 'model-a',
      },
    ]
    mockLocalStorage.setItem('ai-presets', JSON.stringify(presets))
    mockLocalStorage.setItem(
      'ai-config',
      JSON.stringify({
        discussionMode: true,
        discussionModelIds: ['p1'],
      }),
    )
    _resetAIConfig()

    mockFetch.mockImplementation(async (url: string, init: any) => {
      if (init?.body && JSON.parse(init.body).stream === true) {
        return {
          ok: true,
          body: {
            getReader: () => ({
              read: vi
                .fn()
                .mockResolvedValueOnce({
                  value: new TextEncoder().encode(
                    'data: {"choices":[{"delta":{"content":"Fallback synthesis"}}]}\n\n',
                  ),
                  done: false,
                })
                .mockResolvedValueOnce({
                  value: new TextEncoder().encode('data: [DONE]\n\n'),
                  done: true,
                }),
            }),
          },
        }
      }

      if (url.includes('api.a.com')) {
        throw new Error('Network error')
      }

      return { ok: false }
    })

    await getMultiModelDiscussionStream(messages, onStepUpdate, onFinalChunk)

    const lastSteps = onStepUpdate.mock.calls[onStepUpdate.mock.calls.length - 1][0]
    expect(lastSteps).toHaveLength(1)
    expect(lastSteps[0].status).toBe('error')
    expect(lastSteps[0].content).toBe('Network error')
    expect(onFinalChunk).toHaveBeenCalledWith('Fallback synthesis')
  })

  it('should use explicitly configured primary model if provided', async () => {
    const messages = [{ id: '1', role: 'user', content: 'hello' } as ChatMessage]
    const onStepUpdate = vi.fn()
    const onFinalChunk = vi.fn()

    localStorage.setItem(
      'ai-presets',
      JSON.stringify([
        { id: 'p1', name: 'Model 1', baseUrl: 'api.1.com', apiKey: 'key1', model: 'm1' },
        {
          id: 'p2',
          name: 'Primary Model',
          baseUrl: 'api.primary.com',
          apiKey: 'key-p',
          model: 'm-p',
        },
      ]),
    )
    localStorage.setItem(
      'ai-config',
      JSON.stringify({
        ...JSON.parse(localStorage.getItem('ai-config') || '{}'),
        discussionMode: true,
        discussionModelIds: ['p1'],
        discussionPrimaryModelId: 'p2',
      }),
    )
    _resetAIConfig()

    mockFetch.mockImplementation(async (url: string, init: any) => {
      if (url.includes('api.primary.com')) {
        return {
          ok: true,
          body: {
            getReader: () => ({
              read: vi
                .fn()
                .mockResolvedValueOnce({
                  value: new TextEncoder().encode(
                    'data: {"choices":[{"delta":{"content":"Primary synthesis"}}]}\n\n',
                  ),
                  done: false,
                })
                .mockResolvedValueOnce({
                  value: new TextEncoder().encode('data: [DONE]\n\n'),
                  done: true,
                }),
            }),
          },
        }
      }

      if (url.includes('api.1.com')) {
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'Answer 1' } }],
          }),
        }
      }

      return { ok: false, status: 500 }
    })

    await getMultiModelDiscussionStream(messages, onStepUpdate, onFinalChunk)

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('api.primary.com'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer key-p',
        }),
      }),
    )
    expect(onFinalChunk).toHaveBeenCalledWith('Primary synthesis')
  })

  it('should exclude primary model from contributors even if selected', async () => {
    const messages = [{ id: '1', role: 'user', content: 'hello' } as ChatMessage]
    const onStepUpdate = vi.fn()
    const onFinalChunk = vi.fn()

    localStorage.setItem(
      'ai-presets',
      JSON.stringify([
        { id: 'p1', name: 'Primary Model', baseUrl: 'api.p.com', apiKey: 'key-p', model: 'm-p' },
        { id: 'p2', name: 'Other Model', baseUrl: 'api.o.com', apiKey: 'key-o', model: 'm-o' },
      ]),
    )
    localStorage.setItem(
      'ai-config',
      JSON.stringify({
        ...JSON.parse(localStorage.getItem('ai-config') || '{}'),
        discussionMode: true,
        discussionModelIds: ['p1', 'p2'],
        discussionPrimaryModelId: 'p1',
      }),
    )
    _resetAIConfig()

    mockFetch.mockImplementation(async (url: string, init: any) => {
      if (init?.body && JSON.parse(init.body).stream === true) {
        return {
          ok: true,
          body: {
            getReader: () => ({
              read: vi
                .fn()
                .mockResolvedValueOnce({
                  value: new TextEncoder().encode(
                    'data: {"choices":[{"delta":{"content":"Final"}}]}\n\n',
                  ),
                  done: false,
                })
                .mockResolvedValueOnce({
                  value: new TextEncoder().encode('data: [DONE]\n\n'),
                  done: true,
                }),
            }),
          },
        }
      }
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Answer' } }],
        }),
      }
    })

    await getMultiModelDiscussionStream(messages, onStepUpdate, onFinalChunk)

    const lastSteps = onStepUpdate.mock.calls[onStepUpdate.mock.calls.length - 1][0]
    // 应该只有 1 个步骤：只有 p2 参与独立回答。p1 被排除（因为它是主模型）。
    expect(lastSteps).toHaveLength(1)
    expect(lastSteps[0].modelId).toBe('p2')
  })

  it('should pass thinking config to parallel model requests', async () => {
    const messages = [{ id: '1', role: 'user', content: 'hello' } as ChatMessage]
    const onStepUpdate = vi.fn()
    const onFinalChunk = vi.fn()

    localStorage.setItem(
      'ai-config',
      JSON.stringify({
        ...JSON.parse(localStorage.getItem('ai-config') || '{}'),
        discussionMode: true,
        discussionModelIds: ['p1'],
        thinkingMode: 'enabled',
      }),
    )
    localStorage.setItem(
      'ai-presets',
      JSON.stringify([{ id: 'p1', name: 'P1', baseUrl: 'api.p1.com', apiKey: 'k1', model: 'm1' }]),
    )
    _resetAIConfig()

    mockFetch.mockImplementation(async (url: string, init: any) => {
      const body = JSON.parse(init.body)
      if (body.stream === false) {
        expect(body.thinking).toEqual({ type: 'enabled' })
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'Success' } }],
          }),
        }
      }
      return {
        ok: true,
        body: {
          getReader: () => ({
            read: vi
              .fn()
              .mockResolvedValueOnce({
                value: new TextEncoder().encode(
                  'data: {"choices":[{"delta":{"content":"Final"}}]}\n\n',
                ),
                done: false,
              })
              .mockResolvedValueOnce({
                value: new TextEncoder().encode('data: [DONE]\n\n'),
                done: true,
              }),
          }),
        },
      }
    })

    await getMultiModelDiscussionStream(messages, onStepUpdate, onFinalChunk)
  })

  it('should include system prompt in all steps of discussion', async () => {
    const messages = [{ id: '1', role: 'user', content: 'hello' } as ChatMessage]
    const onStepUpdate = vi.fn()
    const onFinalChunk = vi.fn()
    const systemPrompt = 'You are a helpful assistant'

    localStorage.setItem(
      'ai-config',
      JSON.stringify({
        ...JSON.parse(localStorage.getItem('ai-config') || '{}'),
        discussionMode: true,
        discussionModelIds: ['p1'],
        systemPrompt,
      }),
    )
    localStorage.setItem(
      'ai-presets',
      JSON.stringify([{ id: 'p1', name: 'P1', baseUrl: 'api.p1.com', apiKey: 'k1', model: 'm1' }]),
    )
    _resetAIConfig()

    mockFetch.mockImplementation(async (url: string, init: any) => {
      const body = JSON.parse(init.body)
      expect(body.messages).toContainEqual({ role: 'system', content: systemPrompt })

      if (body.stream === false) {
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'Success' } }],
          }),
        }
      }
      return {
        ok: true,
        body: {
          getReader: () => ({
            read: vi
              .fn()
              .mockResolvedValueOnce({
                value: new TextEncoder().encode(
                  'data: {"choices":[{"delta":{"content":"Final"}}]}\n\n',
                ),
                done: false,
              })
              .mockResolvedValueOnce({
                value: new TextEncoder().encode('data: [DONE]\n\n'),
                done: true,
              }),
          }),
        },
      }
    })

    await getMultiModelDiscussionStream(messages, onStepUpdate, onFinalChunk)
    expect(mockFetch).toHaveBeenCalledTimes(2) // 1 Parallel + 1 Synthesis
  })
})
