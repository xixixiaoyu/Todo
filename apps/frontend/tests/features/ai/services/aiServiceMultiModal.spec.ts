import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getAIStreamResponse } from '@/features/ai/services/aiService'
import type { ChatMessage } from '@/features/ai/services/aiService'
import { _resetAIConfig } from '@/features/ai/composables/useAIConfig'

const fetchMock = vi.mocked(fetch)

function getFirstRequestBody() {
  const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined
  const body = init?.body
  expect(typeof body).toBe('string')
  return JSON.parse(body as string) as { messages: Array<{ role: string; content: unknown }> }
}

function getUserMessage(body: { messages: Array<{ role: string; content: unknown }> }) {
  const userMessage = body.messages.find((m) => m.role === 'user')
  expect(userMessage).toBeDefined()
  return userMessage as { role: string; content: unknown }
}

// Mock i18n
vi.mock('@/i18n', () => ({
  default: {
    global: {
      t: vi.fn((key: string) => key),
    },
  },
}))

// Mock composables/stores
vi.mock('@/features/ai/composables/useMemory', () => ({
  useMemory: () => ({
    memories: { value: [] },
    isMemoryEnabled: { value: false },
    autoCompressThreshold: { value: 30 },
    isCompressing: { value: false },
    lastError: { value: null },
    addMemory: vi.fn(),
    addMemories: vi.fn(),
    removeMemory: vi.fn(),
    updateMemory: vi.fn(),
    clearMemories: vi.fn(),
    toggleMemory: vi.fn(),
    compressMemories: vi.fn(),
    updateAutoCompressThreshold: vi.fn(),
    getMemoryModelOptions: vi.fn(),
    syncFromServer: vi.fn(),
    exportMemories: vi.fn(() => '[]'),
    importMemories: vi.fn(),
  }),
}))

vi.mock('@/features/todo/stores/todo', () => ({
  useTodoStore: () => ({
    todos: [],
  }),
}))

describe('aiService - Multi-modal Support', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()

    // Default config
    localStorage.setItem(
      'ai-config',
      JSON.stringify({
        baseUrl: 'https://api.openrouter.ai/api/v1',
        apiKey: 'sk-test',
        model: 'openai/gpt-4o',
        systemPrompt: 'You are a helpful assistant',
      }),
    )
    _resetAIConfig()

    // Default fetch mock for stream
    fetchMock.mockImplementation(
      async () =>
        ({
          ok: true,
          body: {
            getReader: () => ({
              read: vi
                .fn()
                .mockResolvedValueOnce({
                  value: new TextEncoder().encode(
                    'data: {"choices":[{"delta":{"content":"Test response"}}]} \n\n',
                  ),
                  done: false,
                })
                .mockResolvedValueOnce({
                  value: new TextEncoder().encode('data: [DONE]\n\n'),
                  done: true,
                }),
            }),
          },
        }) as unknown as Response,
    )
  })

  it('should format multi-modal messages correctly for OpenRouter in stream mode', async () => {
    const messages: ChatMessage[] = [
      {
        id: '1',
        role: 'user',
        content: 'What is in this image?',
        images: ['https://example.com/image.jpg'],
      },
    ]

    const onChunk = vi.fn()
    await getAIStreamResponse(messages, onChunk)

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/chat/completions'),
      expect.objectContaining({
        method: 'POST',
      }),
    )

    const userMessage = getUserMessage(getFirstRequestBody())
    expect(Array.isArray(userMessage.content)).toBe(true)

    const content = userMessage.content as Array<unknown>
    expect(content).toContainEqual({
      type: 'text',
      text: 'What is in this image?',
    })
    expect(content).toContainEqual({
      type: 'image_url',
      image_url: {
        url: 'https://example.com/image.jpg',
      },
    })
  })

  it('should handle multiple images in a single message in stream mode', async () => {
    const messages: ChatMessage[] = [
      {
        id: '1',
        role: 'user',
        content: 'Compare these images',
        images: ['https://example.com/1.jpg', 'https://example.com/2.jpg'],
      },
    ]

    const onChunk = vi.fn()
    await getAIStreamResponse(messages, onChunk)

    const userMessage = getUserMessage(getFirstRequestBody())
    const content = userMessage.content as Array<unknown>

    expect(content).toHaveLength(3)
    expect(content[0]).toEqual({ type: 'text', text: 'Compare these images' })
    expect(content[1]).toEqual({
      type: 'image_url',
      image_url: { url: 'https://example.com/1.jpg' },
    })
    expect(content[2]).toEqual({
      type: 'image_url',
      image_url: { url: 'https://example.com/2.jpg' },
    })
  })

  it('should fall back to simple string content for text-only messages in stream mode', async () => {
    const messages: ChatMessage[] = [
      {
        id: '1',
        role: 'user',
        content: 'Hello',
      },
    ]

    const onChunk = vi.fn()
    await getAIStreamResponse(messages, onChunk)

    const userMessage = getUserMessage(getFirstRequestBody())
    expect(typeof userMessage.content).toBe('string')
    expect(userMessage.content).toBe('Hello')
  })
})
