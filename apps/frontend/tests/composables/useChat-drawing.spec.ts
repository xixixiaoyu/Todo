/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, computed } from 'vue'
import { useChat } from '@/composables/useChat'
import type { ChatSession } from '@/composables/useChatHistory'
import { getAIStreamResponse, getAIImageResponse, generateId } from '@/services/aiService'
import type { ChatMessage } from '@/services/aiService'

// Mock chat history
const mockCurrentSession = ref<ChatSession | null>(null)
const mockGetOrCreateCurrentSession = vi.fn<() => ChatSession>()
const mockUpdateSessionMessages = vi.fn<(sessionId: string, messages: ChatMessage[]) => void>()
const mockCreateSession = vi.fn<() => ChatSession>()

vi.mock('@/composables/useChatHistory', async () => {
  return {
    useChatHistory: vi.fn(() => ({
      currentSession: computed(() => mockCurrentSession.value),
      getOrCreateCurrentSession: mockGetOrCreateCurrentSession,
      updateSessionMessages: mockUpdateSessionMessages,
      createSession: mockCreateSession,
    })),
  }
})

// Mock AI service
vi.mock('@/services/aiService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/aiService')>()
  return {
    ...actual,
    getAIStreamResponse: vi.fn(),
    getAIImageResponse: vi.fn().mockResolvedValue(['http://example.com/image.png']),
    generateId: vi.fn(() => 'generated-id'),
  }
})

// Mock useMemory
vi.mock('@/composables/useMemory', () => ({
  useMemory: vi.fn(() => ({
    memories: ref([]),
    isMemoryEnabled: ref(false),
    addMemories: vi.fn(),
    lastError: ref(null),
    removeMemory: vi.fn(),
    clearMemories: vi.fn(),
    toggleMemory: vi.fn(),
    getMemoryModelOptions: vi.fn(() => ({})),
    compressMemories: vi.fn(),
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
})

vi.mock('@/composables/useAIConfig', () => ({
  getAIConfig: vi.fn(() => mockConfig.value),
  getAIThinkingMode: vi.fn(() => 'disabled'),
}))

describe('useChat Drawing Logic', () => {
  const mockGetAIStreamResponse = vi.mocked(getAIStreamResponse)
  const mockGetAIImageResponse = vi.mocked(getAIImageResponse)
  const mockGenerateId = vi.mocked(generateId)

  beforeEach(() => {
    vi.clearAllMocks()
    mockConfig.value.enableImageGeneration = false
    mockCurrentSession.value = null
    mockUpdateSessionMessages.mockImplementation((sessionId, messages) => {
      if (mockCurrentSession.value && mockCurrentSession.value.id === sessionId) {
        mockCurrentSession.value.messages = [...messages]
      }
    })
    mockGetOrCreateCurrentSession.mockImplementation(() => {
      if (!mockCurrentSession.value) {
        mockCurrentSession.value = {
          id: 'session-1',
          title: 'Test Session',
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      }
      return mockCurrentSession.value
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

    // Should call image response with the full text (since we removed the regex stripping)
    // Actually, in the new logic: return generateImage(content.trim(), images)
    expect(mockGetAIImageResponse).toHaveBeenCalledWith(
      '/draw a cat',
      undefined,
      expect.any(Object),
    )
    expect(mockGetAIStreamResponse).not.toHaveBeenCalled()
  })
})
