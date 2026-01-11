import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getMultiModelDiscussionStream } from '@/services/aiService'
import { _resetAIConfig } from '@/composables/useAIConfig'
import type { ChatMessage } from '@/services/aiService'
import type { AIPreset } from '@/composables/useAIConfig'

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
      t: vi.fn((key: string, params?: Record<string, unknown>) => {
        if (key === 'ai.parallelSynthesisPrompt' && params) {
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

  it('should fall back to single model if no primary or secondary presets are selected', async () => {
    const messages = [{ id: '1', role: 'user', content: 'hello' } as ChatMessage]
    const onStepUpdate = vi.fn()
    const onFinalChunk = vi.fn()

    // Scenario 1: No secondary models
    localStorage.setItem(
      'ai-config',
      JSON.stringify({
        discussionMode: true,
        discussionModelIds: [],
        discussionPrimaryModelId: 'p1',
      }),
    )
    localStorage.setItem(
      'ai-presets',
      JSON.stringify([{ id: 'p1', name: 'P1', baseUrl: 'api.1.com', apiKey: 'k1', model: 'm1' }]),
    )
    _resetAIConfig()

    await getMultiModelDiscussionStream(messages, onStepUpdate, onFinalChunk)
    expect(onStepUpdate).not.toHaveBeenCalled()

    // Scenario 2: No primary model (even if secondary exists)
    vi.clearAllMocks()
    localStorage.setItem(
      'ai-config',
      JSON.stringify({
        discussionMode: true,
        discussionModelIds: ['p1'],
        discussionPrimaryModelId: null, // Force no primary
      }),
    )
    _resetAIConfig()

    await getMultiModelDiscussionStream(messages, onStepUpdate, onFinalChunk)
    expect(onStepUpdate).not.toHaveBeenCalled()
  })

  it('should handle multi-model discussion (parallel) correctly', async () => {
    const messages: ChatMessage[] = [{ id: '1', role: 'user', content: 'What is 1+1?' }]
    const onStepUpdate = vi.fn()
    const onFinalChunk = vi.fn()

    const presets: AIPreset[] = [
      {
        id: 'p1',
        name: 'Model A',
        baseUrl: 'https://api.a.com',
        apiKey: 'key-a',
        model: 'model-a',
        systemPrompt: '',
        temperature: 0.7,
        todoAssistant: false,
      },
      {
        id: 'p2',
        name: 'Model B',
        baseUrl: 'https://api.b.com',
        apiKey: 'key-b',
        model: 'model-b',
        systemPrompt: '',
        temperature: 0.7,
        todoAssistant: false,
      },
    ]
    mockLocalStorage.setItem('ai-presets', JSON.stringify(presets))
    mockLocalStorage.setItem(
      'ai-config',
      JSON.stringify({
        discussionMode: true,
        discussionModelIds: ['p1', 'p2'],
        discussionPrimaryModelId: 'p1', // Add primary model
      }),
    )
    _resetAIConfig()

    mockFetch.mockImplementation(async (url: string, init: RequestInit) => {
      const body = init?.body ? JSON.parse(init.body as string) : {}
      // 流式请求 (synthesis)
      if (body.stream === true) {
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

  it('should continue with synthesis even if all secondary models fail', async () => {
    const messages: ChatMessage[] = [{ id: '1', role: 'user', content: 'What is 1+1?' }]
    const onStepUpdate = vi.fn()
    const onFinalChunk = vi.fn()

    const presets: AIPreset[] = [
      {
        id: 'p1',
        name: 'Model A',
        baseUrl: 'https://api.a.com',
        apiKey: 'key-a',
        model: 'model-a',
        systemPrompt: '',
        temperature: 0.7,
        todoAssistant: false,
      },
      {
        id: 'p2',
        name: 'Model B',
        baseUrl: 'https://api.b.com',
        apiKey: 'key-b',
        model: 'model-b',
        systemPrompt: '',
        temperature: 0.7,
        todoAssistant: false,
      },
    ]
    mockLocalStorage.setItem('ai-presets', JSON.stringify(presets))
    mockLocalStorage.setItem(
      'ai-config',
      JSON.stringify({
        discussionMode: true,
        discussionModelIds: ['p1', 'p2'],
        discussionPrimaryModelId: 'p1',
      }),
    )
    _resetAIConfig()

    mockFetch.mockImplementation(async (url: string, init: RequestInit) => {
      const body = init?.body ? JSON.parse(init.body as string) : {}
      // 流式请求 (synthesis)
      if (body.stream === true) {
        // 检查 synthesisPrompt 是否包含了空讨论数据
        const lastMsg = body.messages[body.messages.length - 1].content
        if (lastMsg.includes('Synthesis: What is 1+1? - ')) {
          return {
            ok: true,
            body: {
              getReader: () => ({
                read: vi
                  .fn()
                  .mockResolvedValueOnce({
                    value: new TextEncoder().encode(
                      'data: {"choices":[{"delta":{"content":"Synthesis without discussion"}}]}\n\n',
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
      }

      // 并行请求失败
      return {
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      }
    })

    await getMultiModelDiscussionStream(messages, onStepUpdate, onFinalChunk)

    expect(onStepUpdate).toHaveBeenCalled()
    const lastSteps = onStepUpdate.mock.calls[onStepUpdate.mock.calls.length - 1][0]
    expect(lastSteps[0].status).toBe('error')
    expect(lastSteps[0].content).toContain('500')
    expect(lastSteps[1].status).toBe('error')
    expect(lastSteps[1].content).toContain('500')

    expect(onFinalChunk).toHaveBeenCalledWith('Synthesis without discussion')
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
        discussionPrimaryModelId: 'p1', // Add primary model
      }),
    )
    _resetAIConfig()

    mockFetch.mockImplementation(async (url: string, init: RequestInit) => {
      const body = init?.body ? JSON.parse(init.body as string) : {}
      // 流式请求
      if (body.stream === true) {
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

  it('should use explicitly configured primary model if provided, independent of basic settings', async () => {
    const messages = [{ id: '1', role: 'user', content: 'hello' } as ChatMessage]
    const onStepUpdate = vi.fn()
    const onFinalChunk = vi.fn()

    localStorage.setItem(
      'ai-presets',
      JSON.stringify([
        { id: 'p1', name: 'Primary Model', baseUrl: 'api.p1.com', apiKey: 'key-p1', model: 'm-p1' },
        { id: 'p2', name: 'Other Model', baseUrl: 'api.p2.com', apiKey: 'key-p2', model: 'm-p2' },
      ]),
    )
    localStorage.setItem(
      'ai-config',
      JSON.stringify({
        ...JSON.parse(localStorage.getItem('ai-config') || '{}'),
        discussionMode: true,
        discussionModelIds: ['p2'],
        discussionPrimaryModelId: 'p1',
        // Basic settings are different from p1
        baseUrl: 'api.basic.com',
        apiKey: 'key-basic',
        model: 'm-basic',
        temperature: 0.7,
      }),
    )
    _resetAIConfig()

    mockFetch.mockImplementation(async (url: string, init: RequestInit) => {
      const body = init?.body ? JSON.parse(init.body as string) : {}

      if (body.stream === false) {
        // Parallel model request (p2)
        expect(url).toContain('api.p2.com')
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'Answer 1' } }],
          }),
        }
      }

      // Final synthesis request (should use p1, not basic)
      expect(url).toContain('api.p1.com')
      expect((init.headers as Record<string, string>).Authorization).toBe('Bearer key-p1')

      return {
        ok: true,
        body: {
          getReader: () => ({
            read: vi
              .fn()
              .mockResolvedValueOnce({
                value: new TextEncoder().encode(
                  'data: {"choices":[{"delta":{"content":"Final"}}]} \n\n',
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

  it('should include primary model in contributors if selected', async () => {
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
        baseUrl: 'api.p.com',
        apiKey: 'key-p',
        model: 'm-p',
        temperature: 0.7,
      }),
    )
    _resetAIConfig()

    mockFetch.mockImplementation(async (url: string, init: RequestInit) => {
      const body = init?.body ? JSON.parse(init.body as string) : {}
      // 流式请求
      if (body.stream === true) {
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
    // 现在应该有 2 个步骤：p1 和 p2 都参与独立回答。
    expect(lastSteps).toHaveLength(2)
    expect(lastSteps[0].modelId).toBe('p1')
    expect(lastSteps[1].modelId).toBe('p2')
  })

  it('should pass global thinking config to parallel model requests', async () => {
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
      JSON.stringify([
        {
          id: 'p1',
          name: 'P1',
          baseUrl: 'api.p1.com',
          apiKey: 'k1',
          model: 'm1',
        },
      ]),
    )
    _resetAIConfig()

    mockFetch.mockImplementation(async (url: string, init: RequestInit) => {
      const body = init?.body ? JSON.parse(init.body as string) : {}
      if (body.stream === false) {
        expect(body.thinking).toEqual({ type: 'enabled' }) // Global setting
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

  it('should NOT include global system prompt in contributor steps if preset has no prompt', async () => {
    const messages = [{ id: '1', role: 'user', content: 'hello' } as ChatMessage]
    const onStepUpdate = vi.fn()
    const onFinalChunk = vi.fn()
    const systemPrompt = 'Global System Prompt'

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

    mockFetch.mockImplementation(async (url: string, init: RequestInit) => {
      const body = init?.body ? JSON.parse(init.body as string) : {}

      if (body.stream === false) {
        // Parallel model request (contributor)
        expect(body.messages).not.toContainEqual({ role: 'system', content: systemPrompt })
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'Success' } }],
          }),
        }
      }

      // Final synthesis request
      expect(body.messages).toContainEqual({ role: 'system', content: systemPrompt })
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

  it('should use preset specific system prompt for contributors', async () => {
    const messages = [{ id: '1', role: 'user', content: 'hello' } as ChatMessage]
    const onStepUpdate = vi.fn()
    const onFinalChunk = vi.fn()
    const globalSystemPrompt = 'Global System Prompt'
    const presetSystemPrompt = 'Preset System Prompt'

    localStorage.setItem(
      'ai-config',
      JSON.stringify({
        ...JSON.parse(localStorage.getItem('ai-config') || '{}'),
        discussionMode: true,
        discussionModelIds: ['p1'],
        systemPrompt: globalSystemPrompt,
      }),
    )
    localStorage.setItem(
      'ai-presets',
      JSON.stringify([
        {
          id: 'p1',
          name: 'P1',
          baseUrl: 'api.p1.com',
          apiKey: 'k1',
          model: 'm1',
          systemPrompt: presetSystemPrompt,
        },
      ]),
    )
    _resetAIConfig()

    mockFetch.mockImplementation(async (url: string, init: RequestInit) => {
      const body = init?.body ? JSON.parse(init.body as string) : {}

      if (body.stream === false) {
        // Parallel model request (contributor)
        expect(body.messages).toContainEqual({ role: 'system', content: presetSystemPrompt })
        expect(body.messages).not.toContainEqual({ role: 'system', content: globalSystemPrompt })
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'Success' } }],
          }),
        }
      }

      // Final synthesis request
      expect(body.messages).toContainEqual({ role: 'system', content: globalSystemPrompt })
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
