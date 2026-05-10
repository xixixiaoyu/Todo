import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getAIStreamResponse, getAIStaticResponse } from '@/features/ai/services/aiService'
import type { ChatMessage } from '@/features/ai/services/aiService'
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

  it('should strip ui-only fields and assistant reasoning fields from request messages', async () => {
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
    expect((assistantMsg as Record<string, unknown>).reasoning_content).toBeUndefined()
    expect((assistantMsg as Record<string, unknown>).reasoning_details).toBeUndefined()
    expect((assistantMsg as Record<string, unknown>).id).toBeUndefined()
    expect((assistantMsg as Record<string, unknown>).createdAt).toBeUndefined()

    expect(Object.keys(assistantMsg as Record<string, unknown>).sort()).toEqual(['content', 'role'])
  })

  it('should sanitize non-stream request messages at the transport boundary', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'ok' } }],
      }),
    } as unknown as Response)

    const messagesWithExtraFields = [
      {
        role: 'assistant',
        content: 'Need a tool',
        reasoning_content: 'private chain of thought',
        reasoning_details: 'provider reasoning',
        tool_calls: [
          {
            id: 'tc1',
            type: 'function',
            index: 7,
            function: {
              name: 'read_skill',
              arguments: '{"path":"skills/demo/SKILL.md"}',
              extra: 'ignore me',
            },
            extra: 'ignore me too',
          },
        ],
        id: 'a1',
        createdAt: new Date(),
      },
      {
        role: 'tool',
        content: '{"ok":true}',
        tool_call_id: 'tc1',
        toolName: 'read_skill',
        id: 't1',
      },
    ] as unknown as Parameters<typeof getAIStaticResponse>[0]

    await getAIStaticResponse(messagesWithExtraFields)

    const sentMessages = getFirstRequestBody().messages as Array<Record<string, unknown>>
    const assistantMsg = sentMessages.find((message) => message.role === 'assistant')
    const toolMsg = sentMessages.find((message) => message.role === 'tool')

    expect(assistantMsg).toBeDefined()
    expect(assistantMsg?.reasoning_content).toBe('private chain of thought')
    expect(assistantMsg?.reasoning_details).toBeUndefined()
    expect(assistantMsg?.id).toBeUndefined()
    expect(assistantMsg?.createdAt).toBeUndefined()
    expect(assistantMsg?.tool_calls).toEqual([
      {
        id: 'tc1',
        type: 'function',
        function: {
          name: 'read_skill',
          arguments: '{"path":"skills/demo/SKILL.md"}',
        },
      },
    ])

    expect(toolMsg).toEqual({
      role: 'tool',
      content: '{"ok":true}',
      tool_call_id: 'tc1',
    })
  })
})
