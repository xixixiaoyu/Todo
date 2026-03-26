/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, computed } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { useChat } from '@/features/ai/composables/useChat'
import type { ChatSession } from '@/features/ai/composables/useChatHistory'
import { _resetChatState } from '@/features/ai/composables/useChatState'
import { getMultiModelDiscussionStream } from '@/features/ai/services/aiService'
import { getAIConfig, getAISkills } from '@/features/ai/composables/useAIConfig'
import type { AIConfig } from '@/features/ai/composables/useAIConfig'
import type { ChatMessage, DiscussionStep } from '@/features/ai/services/aiService'
import { mcpApi } from '@/features/mcp/api/mcp'

const mockAuthToken = ref<string | null>('access-token')
const mockHydrateFromStorage = vi.fn()

vi.mock('@/features/auth/stores/auth', () => ({
  useAuthStore: vi.fn(() => ({
    get token() {
      return mockAuthToken.value
    },
    hydrateFromStorage: mockHydrateFromStorage,
  })),
}))

vi.mock('@/features/mcp/api/mcp', () => ({
  mcpApi: {
    getAllTools: vi.fn().mockResolvedValue([]),
    callTool: vi.fn(),
  },
}))

// Mock dependencies
const mockCurrentSession = ref<ChatSession | null>(null)
const mockSessions = ref<ChatSession[]>([])
const mockGetOrCreateCurrentSession = vi.fn()
const mockUpdateSessionMessages = vi.fn()
const mockAddSessionMessage = vi.fn()
const mockCreateSession = vi.fn()
const mockUpdateSessionContextSummary = vi.fn()
const mockClearSessionContextSummary = vi.fn()

vi.mock('@/features/ai/composables/useChatHistory', () => ({
  useChatHistory: vi.fn(() => ({
    currentSession: computed(() => mockCurrentSession.value),
    currentSessionId: computed(() => mockCurrentSession.value?.id || null),
    sessions: mockSessions,
    getOrCreateCurrentSession: mockGetOrCreateCurrentSession,
    updateSessionMessages: mockUpdateSessionMessages,
    addSessionMessage: mockAddSessionMessage,
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
    thinkingEffort: 'high',
    todoAssistant: false,
    enableImageGeneration: false,
    mcpEnabled: false,
    contextCompressionEnabled: false,
    contextCompressionTriggerChars: 24000,
    contextCompressionModelId: null,
    skillIds: [],
  })),
  getAIThinkingMode: vi.fn(() => 'enabled'),
  getAISkills: vi.fn(() => []),
}))

describe('useChat - Discussion Mode', () => {
  const mockGetMultiModelDiscussionStream = vi.mocked(getMultiModelDiscussionStream)

  type OnChunk = (chunk: string) => void
  type OnThinking = (thinking: string) => void
  type OnSteps = (steps: DiscussionStep[]) => void

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    _resetChatState()
    mockAuthToken.value = 'access-token'
    const session = {
      id: 's1',
      title: 'T1',
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    mockCurrentSession.value = session
    mockSessions.value = [session]
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
      thinkingEffort: 'high',
      todoAssistant: false,
      enableImageGeneration: false,
      mcpEnabled: false,
      contextCompressionEnabled: false,
      contextCompressionTriggerChars: 24000,
      contextCompressionModelId: null,
      skillIds: [],
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

  it('should preserve runtime-backed active skills in discussion mode options', async () => {
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
      thinkingEffort: 'high',
      todoAssistant: false,
      enableImageGeneration: false,
      mcpEnabled: false,
      contextCompressionEnabled: false,
      contextCompressionTriggerChars: 24000,
      contextCompressionModelId: null,
      skillIds: ['skill-tavily'],
    } as AIConfig)
    vi.mocked(getAISkills).mockReturnValue([
      {
        id: 'skill-tavily',
        name: 'tavily-search',
        description: 'Search the live web',
        prompt: 'Use Tavily search when current web information is needed.',
      },
    ])

    mockGetMultiModelDiscussionStream.mockImplementation(async () => {})

    const { sendMessage } = useChat()
    await sendMessage('use tavily for current news')

    const call = mockGetMultiModelDiscussionStream.mock.calls[0]
    expect(call).toBeDefined()

    const options = call?.[5] as { activeSkills?: Array<{ id: string; name: string }> } | undefined
    expect(options?.activeSkills?.map((skill) => skill.id)).toEqual(['skill-tavily'])
    expect(options?.activeSkills?.map((skill) => skill.name)).toEqual(['tavily-search'])
  })

  it('should pass prepared runtime tools into the primary discussion request options', async () => {
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
      thinkingEffort: 'high',
      todoAssistant: false,
      enableImageGeneration: false,
      mcpEnabled: true,
      contextCompressionEnabled: false,
      contextCompressionTriggerChars: 24000,
      contextCompressionModelId: null,
      skillIds: [],
    } as AIConfig)
    vi.mocked(mcpApi.getAllTools).mockResolvedValueOnce([
      {
        serverId: 'server-1',
        name: 'web.search',
        description: 'Search the web',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string' },
          },
          required: ['query'],
        },
      } as never,
    ])
    mockGetMultiModelDiscussionStream.mockImplementation(async () => {})

    const { sendMessage } = useChat()
    await sendMessage('search the latest news')

    const call = mockGetMultiModelDiscussionStream.mock.calls[0]
    expect(call).toBeDefined()

    const options = call?.[5] as
      | {
          tools?: Array<{ function?: { description?: string; name?: string } }>
        }
      | undefined

    expect(mockHydrateFromStorage).toHaveBeenCalled()
    expect(mcpApi.getAllTools).toHaveBeenCalled()
    expect(options?.tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          function: expect.objectContaining({
            description: 'Search the web',
          }),
        }),
      ]),
    )
  })
})
