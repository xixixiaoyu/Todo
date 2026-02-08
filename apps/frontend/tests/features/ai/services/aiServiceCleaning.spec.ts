import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getAIStreamResponse, type ChatMessage } from '@/features/ai/services/aiService'

// Mock global fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

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
  })

  it('should clean non-standard fields like reasoning_details before sending', async () => {
    const onChunk = vi.fn()
    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: {
        getReader: () => ({
          read: vi.fn().mockResolvedValueOnce({ value: undefined, done: true }),
        }),
      },
    })

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

    const lastCallBody = JSON.parse(mockFetch.mock.calls[0][1].body)
    const sentMessages = lastCallBody.messages

    // Check assistant message
    const assistantMsg = sentMessages.find((m: { role: string }) => m.role === 'assistant')
    expect(assistantMsg).toBeDefined()
    expect(assistantMsg.content).toBe('Hello')
    // Should NOT have reasoning_details, id, or createdAt
    expect(assistantMsg.reasoning_details).toBeUndefined()
    expect(assistantMsg.id).toBeUndefined()
    expect(assistantMsg.createdAt).toBeUndefined()

    // Check keys length to ensure no extra fields
    expect(Object.keys(assistantMsg)).toEqual(['role', 'content'])
  })
})
