import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getAIStreamResponse } from '@/services/aiService'
import { _resetAIConfig } from '@/composables/useAIConfig'
import type { ChatMessage } from '@/services/aiService'

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
      t: vi.fn((key: string) => key),
    },
  },
}))

// Mock composables/stores
vi.mock('@/composables/useMemory', () => ({
  useMemory: () => ({
    memories: { value: [] },
    isMemoryEnabled: { value: false },
  }),
}))

vi.mock('@/stores/todo', () => ({
  useTodoStore: () => ({
    todos: [],
  }),
}))

describe('aiService - Multi-modal Support', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLocalStorage.clear()

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
    mockFetch.mockImplementation(async () => ({
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
    }))
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

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/chat/completions'),
      expect.objectContaining({
        method: 'POST',
      }),
    )

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
    const userMessage = callBody.messages.find(
      (m: { role: string; content: string | unknown[] }) => m.role === 'user',
    )

    expect(Array.isArray(userMessage.content)).toBe(true)
    expect(userMessage.content).toContainEqual({
      type: 'text',
      text: 'What is in this image?',
    })
    expect(userMessage.content).toContainEqual({
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

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
    const userMessage = callBody.messages.find(
      (m: { role: string; content: string | unknown[] }) => m.role === 'user',
    )

    expect(userMessage.content).toHaveLength(3) // 1 text + 2 images
    expect(userMessage.content[0]).toEqual({ type: 'text', text: 'Compare these images' })
    expect(userMessage.content[1]).toEqual({
      type: 'image_url',
      image_url: { url: 'https://example.com/1.jpg' },
    })
    expect(userMessage.content[2]).toEqual({
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

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
    const userMessage = callBody.messages.find(
      (m: { role: string; content: string | unknown[] }) => m.role === 'user',
    )

    expect(typeof userMessage.content).toBe('string')
    expect(userMessage.content).toBe('Hello')
  })
})
