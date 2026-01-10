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
        if (key === 'ai.synthesisPrompt') {
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

  it('should handle multi-model discussion correctly', async () => {
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
      // 如果是流式请求 (synthesis)
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

      // 处理主模型草案或副模型评审 (stream: false)
      const body = init?.body ? JSON.parse(init.body) : {}
      let content = ''

      if (url.includes('api.a.com')) {
        content = 'Review from A'
      } else if (url.includes('api.b.com')) {
        content = 'Review from B'
      } else {
        content = 'Primary Draft'
      }

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
    expect(lastSteps).toHaveLength(3) // 1 draft + 2 reviews
    expect(lastSteps[0].modelId).toBe('primary-draft')
    expect(lastSteps[0].status).toBe('done')
    expect(lastSteps[0].content).toBe('Primary Draft')
    expect(lastSteps[1].status).toBe('done')
    expect(lastSteps[2].status).toBe('done')
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

      // 副模型评审报错
      if (url.includes('api.a.com')) {
        throw new Error('Network error')
      }

      // 主模型草案成功
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Draft' } }],
        }),
      }
    })

    await getMultiModelDiscussionStream(messages, onStepUpdate, onFinalChunk)

    const lastSteps = onStepUpdate.mock.calls[onStepUpdate.mock.calls.length - 1][0]
    expect(lastSteps).toHaveLength(2) // Draft + Review
    expect(lastSteps[0].status).toBe('done') // Primary Draft done
    expect(lastSteps[1].status).toBe('error') // Secondary Review error
    expect(lastSteps[1].content).toBe('Network error')
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
      // 检查是否使用了主模型配置
      if (url.includes('api.primary.com')) {
        if (init?.body && JSON.parse(init.body).stream === true) {
          // Synthesis stage
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
        } else {
          // Draft stage
          return {
            ok: true,
            json: async () => ({
              choices: [{ message: { content: 'Primary Draft' } }],
            }),
          }
        }
      }

      // Review stage
      if (url.includes('api.1.com')) {
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'Review 1' } }],
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

  it('should exclude primary model from reviewers even if selected', async () => {
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
        discussionModelIds: ['p1', 'p2'], // 选了自己和 p2 作为副模型
        discussionPrimaryModelId: 'p1', // 同时也作为主模型
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
          choices: [{ message: { content: 'Draft or Review' } }],
        }),
      }
    })

    await getMultiModelDiscussionStream(messages, onStepUpdate, onFinalChunk)

    const lastSteps = onStepUpdate.mock.calls[onStepUpdate.mock.calls.length - 1][0]
    // 应该只有 2 个步骤：1个草案 + 1个 p2 的评审。p1 被排除了。
    expect(lastSteps).toHaveLength(2)
    expect(lastSteps[0].modelId).toBe('primary-draft')
    expect(lastSteps[1].modelId).toBe('p2')
  })

  it('should pass thinking config to non-stream draft and review requests', async () => {
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
        // 验证 thinking 参数是否存在且正确
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
})
