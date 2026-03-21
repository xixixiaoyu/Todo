/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, computed } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { useChat } from '@/features/ai/composables/useChat'
import { _resetChatState } from '@/features/ai/composables/useChatState'
import type { ChatSession } from '@/features/ai/composables/useChatHistory'
import * as aiService from '@/features/ai/services/aiService'

// Mock chat history
const mockCurrentSession = ref<ChatSession | null>(null)
const mockGetOrCreateCurrentSession = vi.fn<() => ChatSession>()
const mockUpdateSessionMessages = vi.fn<(sessionId: string, messages: ChatMessage[]) => void>()
const mockAddSessionMessage = vi.fn<(sessionId: string, message: ChatMessage) => void>()
const mockCreateSession = vi.fn<() => ChatSession>()
const mockUpdateSessionContextSummary =
  vi.fn<(sessionId: string, data: { summary: string; untilMessageId: string }) => void>()
const mockClearSessionContextSummary = vi.fn<(sessionId: string) => void>()

vi.mock('@/features/ai/composables/useChatHistory', async () => {
  return {
    useChatHistory: vi.fn(() => ({
      currentSession: computed(() => mockCurrentSession.value),
      currentSessionId: computed(() => mockCurrentSession.value?.id || null),
      getOrCreateCurrentSession: mockGetOrCreateCurrentSession,
      updateSessionMessages: mockUpdateSessionMessages,
      addSessionMessage: mockAddSessionMessage,
      createSession: mockCreateSession,
      updateSessionContextSummary: mockUpdateSessionContextSummary,
      clearSessionContextSummary: mockClearSessionContextSummary,
    })),
  }
})

// Mock AI service
vi.mock('@/features/ai/services/aiService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/ai/services/aiService')>()
  return {
    ...actual,
    getAIStreamResponse: vi.fn(),
    getAIImageResponse: vi.fn().mockResolvedValue(['http://example.com/image.png']),
    getAIStaticResponse: vi.fn().mockResolvedValue({ content: '[]' }),
    generateId: vi.fn(() => 'generated-id'),
  }
})

// Mock useMemory
vi.mock('@/features/ai/composables/useMemory', () => ({
  useMemory: vi.fn(() => ({
    memories: ref([]),
    isMemoryEnabled: ref(false),
    autoCompressThreshold: ref(30),
    addMemories: vi.fn(),
    lastError: ref(null),
    removeMemory: vi.fn(),
    clearMemories: vi.fn(),
    toggleMemory: vi.fn(),
    getMemoryModelOptions: vi.fn(() => ({})),
    compressMemories: vi.fn(),
    updateAutoCompressThreshold: vi.fn(),
    exportMemories: vi.fn(() => '[]'),
    importMemories: vi.fn(),
  })),
}))

// Mock useToast
vi.mock('@/composables/useToast', () => ({
  useToast: vi.fn(() => ({
    error: vi.fn(),
    success: vi.fn(),
  })),
}))

// Mock useTodoStore
vi.mock('@/features/todo/stores/todo', () => ({
  useTodoStore: vi.fn(() => ({
    addProposedChanges: vi.fn(),
  })),
}))

// Mock useAuthStore
vi.mock('@/features/auth/stores/auth', () => ({
  useAuthStore: vi.fn(() => ({
    user: ref(null),
    isAuthenticated: computed(() => false),
  })),
}))

// Mock AI config
const mockConfig = ref({
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
  contextCompressionEnabled: false,
  contextCompressionTriggerChars: 24000,
  contextCompressionModelId: null,
  skillIds: [],
})

vi.mock('@/features/ai/composables/useAIConfig', () => ({
  getAIConfig: vi.fn(() => mockConfig.value),
  getAIThinkingMode: vi.fn(() => 'disabled'),
  getAISkills: vi.fn(() => []),
}))

type ChatMessage = aiService.ChatMessage

describe('useChat Drawing Logic', () => {
  const mockGetAIStreamResponse = vi.mocked(aiService.getAIStreamResponse)
  const mockGetAIImageResponse = vi.mocked(aiService.getAIImageResponse)
  const mockGenerateId = vi.mocked(aiService.generateId)

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    _resetChatState()
    mockConfig.value.enableImageGeneration = false
    mockCurrentSession.value = {
      id: 'session-1',
      title: 'Session 1',
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    mockGetOrCreateCurrentSession.mockImplementation(() => {
      return mockCurrentSession.value!
    })
    mockGenerateId.mockReturnValue('generated-id')
  })

  it('should NOT trigger drawing with /draw command when enableImageGeneration is false', async () => {
    const { sendMessage } = useChat()
    await sendMessage('/draw a cat')

    // Should call stream response (regular message), NOT image response
    expect(mockGetAIStreamResponse).toHaveBeenCalled()
    expect(mockGetAIImageResponse).not.toHaveBeenCalled()
  })

  it('should trigger drawing when enableImageGeneration is true even without /draw', async () => {
    mockConfig.value.enableImageGeneration = true
    const { sendMessage } = useChat()
    await sendMessage('a beautiful sunset')

    // Should call image response
    expect(mockGetAIImageResponse).toHaveBeenCalledWith(
      'a beautiful sunset',
      undefined,
      expect.any(Object),
    )
    expect(mockGetAIStreamResponse).not.toHaveBeenCalled()
  })

  it('should trigger drawing when enableImageGeneration is true and text contains /draw', async () => {
    mockConfig.value.enableImageGeneration = true
    const { sendMessage } = useChat()
    await sendMessage('/draw a cat')

    // Should call image response with the full text
    expect(mockGetAIImageResponse).toHaveBeenCalledWith(
      '/draw a cat',
      undefined,
      expect.any(Object),
    )
    expect(mockGetAIStreamResponse).not.toHaveBeenCalled()
  })
})
