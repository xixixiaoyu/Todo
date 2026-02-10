import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getAIStreamResponse, type ChatMessage } from '@/features/ai/services/aiService'
import { _resetAIConfig } from '@/features/ai/composables/useAIConfig'

const fetchMock = vi.mocked(fetch)

function getFirstRequestBody() {
  const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined
  expect(init).toBeDefined()

  const body = init?.body
  expect(typeof body).toBe('string')

  return JSON.parse(body as string) as { messages: unknown[] }
}

// Mock useMemory and useTodoStore since they are used in injectSystemPrompts
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
    exportMemories: vi.fn(() => '[]'),
    importMemories: vi.fn(),
  }),
}))

vi.mock('@/features/todo/stores/todo', () => ({
  useTodoStore: () => ({
    todos: [],
  }),
}))

describe('aiService - Message Cleaning', () => {
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

  it('should clean non-standard fields like reasoning_details before sending', async () => {
    const onChunk = vi.fn()
    fetchMock.mockResolvedValueOnce({
      ok: true,
      body: {
        getReader: () => ({
          read: vi.fn().mockResolvedValueOnce({ value: undefined, done: true }),
        }),
      },
    } as unknown as Response)

    const messagesWithExtraFields: ChatMessage[] = [
      { id: 'user-1', role: 'user', content: 'Hi' },
      {
        id: 'msg-123',
        role: 'assistant',
        content: 'Hello',
        reasoning_details: 'Some thinking process',
        createdAt: new Date(),
      },
    ]

    await getAIStreamResponse(messagesWithExtraFields, onChunk)

    const sentMessages = getFirstRequestBody().messages
    expect(Array.isArray(sentMessages)).toBe(true)

    // Check assistant message
    const assistantMsg = (sentMessages as Array<{ role?: string }>).find(
      (m) => m.role === 'assistant',
    )
    expect(assistantMsg).toBeDefined()
    expect(assistantMsg).toMatchObject({ role: 'assistant', content: 'Hello' })
    // Should NOT have reasoning_details, id, or createdAt
    expect((assistantMsg as Record<string, unknown>).reasoning_details).toBeUndefined()
    expect((assistantMsg as Record<string, unknown>).id).toBeUndefined()
    expect((assistantMsg as Record<string, unknown>).createdAt).toBeUndefined()

    // Check keys length to ensure no extra fields
    expect(Object.keys(assistantMsg as Record<string, unknown>)).toEqual(['role', 'content'])
  })
})
