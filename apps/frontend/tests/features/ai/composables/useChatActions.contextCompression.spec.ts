import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import type { ChatMessage } from '@/features/ai/services/aiService'
import { createContextCompression } from '@/features/ai/composables/useChatActions.contextCompression'
import { getAIStaticResponse } from '@/features/ai/services/aiService'

vi.mock('@/features/ai/services/aiService', () => ({
  getAIStaticResponse: vi.fn(),
}))

vi.mock('@/features/ai/composables/useAIConfig', () => ({
  getAIConfig: vi.fn(() => ({
    assistantMode: 'default',
    discussionMode: false,
    discussionModelIds: [],
    discussionPrimaryModelId: null,
    memoryModelId: null,
    baseUrl: '',
    apiKey: '',
    model: '',
    systemPrompt: '',
    temperature: 0.7,
    thinkingMode: 'disabled',
    todoAssistant: false,
    enableImageGeneration: false,
    mcpEnabled: false,
    contextCompressionEnabled: true,
    contextCompressionTriggerChars: 10,
    contextCompressionModelId: null,
    skillIds: [],
  })),
  getAIPresets: vi.fn(() => []),
  getAISkills: vi.fn(() => []),
}))

describe('createContextCompression', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should await in-flight compression and return trimmed messages', async () => {
    let resolveCompression: ((value: { content: string }) => void) | undefined
    const compressionPromise = new Promise<{ content: string }>((resolve) => {
      resolveCompression = resolve
    })
    vi.mocked(getAIStaticResponse).mockReturnValue(compressionPromise)

    const session = ref({
      id: 's1',
      title: 'T1',
      messages: [] as ChatMessage[],
      createdAt: new Date(),
      updatedAt: new Date(),
      contextSummary: undefined as string | undefined,
      contextSummaryUntilMessageId: undefined as string | undefined,
    })

    const updateSessionContextSummary = vi.fn(
      (_sessionId: string, context: { summary: string; untilMessageId: string }) => {
        session.value.contextSummary = context.summary
        session.value.contextSummaryUntilMessageId = context.untilMessageId
      },
    )

    const { buildContextCompression } = createContextCompression({
      currentSession: session,
      updateSessionContextSummary,
      clearSessionContextSummary: vi.fn(),
    })

    const messages: ChatMessage[] = [
      { id: 'u1', role: 'user', content: 'old user message long long long' },
      { id: 'a1', role: 'assistant', content: 'old assistant message long long long' },
      { id: 'u2', role: 'user', content: 'new message long long long' },
    ]

    const first = await buildContextCompression(messages)
    expect(first.messagesForRequest).toHaveLength(3)

    let settled = false
    const secondPromise = buildContextCompression(messages).then((result) => {
      settled = true
      return result
    })
    await Promise.resolve()
    expect(settled).toBe(false)

    expect(resolveCompression).toBeDefined()
    resolveCompression!({ content: 'summary' })
    const second = await secondPromise

    expect(updateSessionContextSummary).toHaveBeenCalledWith('s1', {
      summary: 'summary',
      untilMessageId: 'a1',
    })
    expect(second.contextSummary).toBe('summary')
    expect(second.messagesForRequest.length).toBeLessThan(messages.length)
    expect(vi.mocked(getAIStaticResponse)).toHaveBeenCalledTimes(1)
  })
})
