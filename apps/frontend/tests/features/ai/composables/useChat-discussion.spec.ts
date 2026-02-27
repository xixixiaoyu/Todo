/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, computed } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { useChat } from '@/features/ai/composables/useChat'
import type { ChatSession } from '@/features/ai/composables/useChatHistory'
import { getMultiModelDiscussionStream } from '@/features/ai/services/aiService'
import { getAIConfig } from '@/features/ai/composables/useAIConfig'
import type { AIConfig } from '@/features/ai/composables/useAIConfig'
import type { ChatMessage, DiscussionStep } from '@/features/ai/services/aiService'

// Mock dependencies
const mockCurrentSession = ref<ChatSession | null>(null)
const mockGetOrCreateCurrentSession = vi.fn()
const mockUpdateSessionMessages = vi.fn()
const mockCreateSession = vi.fn()
const mockUpdateSessionContextSummary = vi.fn()
const mockClearSessionContextSummary = vi.fn()

vi.mock('@/features/ai/composables/useChatHistory', () => ({
  useChatHistory: vi.fn(() => ({
    currentSession: computed(() => mockCurrentSession.value),
    getOrCreateCurrentSession: mockGetOrCreateCurrentSession,
    updateSessionMessages: mockUpdateSessionMessages,
    createSession: mockCreateSession,
    updateSessionContextSummary: mockUpdateSessionContextSummary,
    clearSessionContextSummary: mockClearSessionContextSummary,
  })),
}))

vi.mock('@/features/ai/services/aiService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/ai/services/aiService')>()
  return {
    ...actual,
    getMultiModelDiscussionStream: vi.fn(),
    getAIConfig: vi.fn(),
  }
})

vi.mock('@/features/ai/composables/useAIConfig', () => ({
  getAIConfig: vi.fn(() => ({
    assistantMode: 'default',
    discussionMode: true,
    discussionModelIds: ['m1', 'm2'],
    discussionPrimaryModelId: 'm1',
    memoryModelId: null,
    baseUrl: '',
    apiKey: '',
    model: '',
    systemPrompt: '',
    temperature: 0.7,
    thinkingMode: 'enabled',
    todoAssistant: false,
    enableImageGeneration: false,
    mcpEnabled: false,
    contextCompressionEnabled: false,
    contextCompressionTriggerChars: 24000,
    contextCompressionModelId: null,
  })),
  getAIThinkingMode: vi.fn(() => 'enabled'),
}))

describe('useChat - Discussion Mode', () => {
  const mockGetMultiModelDiscussionStream = vi.mocked(getMultiModelDiscussionStream)

  type OnChunk = (chunk: string) => void
  type OnThinking = (thinking: string) => void
  type OnSteps = (steps: DiscussionStep[]) => void

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    const session = {
      id: 's1',
      title: 'T1',
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    mockCurrentSession.value = session
    mockGetOrCreateCurrentSession.mockReturnValue(session)
  })

  it('should handle multi-model discussion mode with thinking', async () => {
    vi.mocked(getAIConfig).mockReturnValue({
      assistantMode: 'default',
      discussionMode: true,
      discussionModelIds: ['m1', 'm2'],
      discussionPrimaryModelId: 'm1',
      memoryModelId: null,
      baseUrl: '',
      apiKey: '',
      model: '',
      systemPrompt: '',
      temperature: 0.7,
      thinkingMode: 'enabled',
      todoAssistant: false,
      enableImageGeneration: false,
      mcpEnabled: false,
      contextCompressionEnabled: false,
      contextCompressionTriggerChars: 24000,
      contextCompressionModelId: null,
    } as AIConfig)

    mockGetMultiModelDiscussionStream.mockImplementation(
      async (
        _messages: ChatMessage[],
        onSteps: OnSteps,
        onChunk: OnChunk,
        onThinking?: OnThinking,
      ) => {
        onSteps([{ modelId: 'm1', modelName: 'M1', content: 'step 1', status: 'done' }])
        onThinking?.('Primary thinking process...')
        onChunk('Final answer')
        onChunk('[DONE]')

        // Manual sync history for mock test
        const aiMessage: ChatMessage = {
          id: 'assistant-id',
          role: 'assistant',
          content: 'Final answer',
          thinkingContent: 'Primary thinking process...',
          discussionSteps: [{ modelId: 'm1', modelName: 'M1', content: 'step 1', status: 'done' }],
          createdAt: new Date(),
        }
        mockCurrentSession.value!.messages.push(aiMessage)
      },
    )

    const { sendMessage, messages } = useChat()
    await sendMessage('discuss this')

    expect(mockGetMultiModelDiscussionStream).toHaveBeenCalled()

    const assistantMessage = messages.value.find((m) => m.role === 'assistant')
    expect(assistantMessage).toBeDefined()
    expect(assistantMessage!.discussionSteps).toHaveLength(1)
    expect(assistantMessage!.thinkingContent).toBe('Primary thinking process...')
    expect(assistantMessage!.content).toBe('Final answer')
  })
})
