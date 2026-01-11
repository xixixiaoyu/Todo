import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, computed } from 'vue'
import i18n from '@/i18n'
import { useChat } from '@/composables/useChat'
import type { ChatSession } from '@/composables/useChatHistory'
import {
  getAIStreamResponse,
  getMultiModelDiscussionStream,
  abortCurrentRequest,
  generateId,
} from '@/services/aiService'
import type { ChatMessage, DiscussionStep } from '@/services/aiService'
import { getAIConfig } from '@/composables/useAIConfig'

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
    getMultiModelDiscussionStream: vi.fn(),
    abortCurrentRequest: vi.fn(),
    generateId: vi.fn(() => 'generated-id'),
  }
})

// Mock AI config
vi.mock('@/composables/useAIConfig', () => ({
  getAIConfig: vi.fn(() => ({
    discussionMode: false,
    discussionModelIds: [],
    discussionPrimaryModelId: null,
    baseUrl: '',
    apiKey: '',
    model: '',
    systemPrompt: '',
    temperature: 0.7,
    thinkingMode: 'disabled',
    todoAssistant: false,
  })),
  getAIThinkingMode: vi.fn(() => 'disabled'),
}))

describe('useChat', () => {
  const mockGetAIStreamResponse = vi.mocked(getAIStreamResponse)
  const mockGetMultiModelDiscussionStream = vi.mocked(getMultiModelDiscussionStream)
  const mockAbortCurrentRequest = vi.mocked(abortCurrentRequest)
  const mockGenerateId = vi.mocked(generateId)

  // 类型定义辅助
  type OnChunk = (chunk: string) => void
  type OnThinking = (thinking: string) => void
  type OnSteps = (steps: DiscussionStep[]) => void

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()

    // 重置 mock 实现
    mockCurrentSession.value = null
    vi.mocked(getAIConfig).mockReturnValue({
      discussionMode: false,
      discussionModelIds: [],
      discussionPrimaryModelId: null,
      baseUrl: '',
      apiKey: '',
      model: '',
      systemPrompt: '',
      temperature: 0.7,
      thinkingMode: 'disabled',
      todoAssistant: false,
    })
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
    mockCreateSession.mockImplementation(() => {
      const newSession: ChatSession = {
        id: 'session-2',
        title: 'New Session',
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      mockCurrentSession.value = newSession
      return newSession
    })

    mockGenerateId.mockReturnValue('generated-id')
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const { messages, isGenerating, error, currentAIResponse, currentThinkingContent } = useChat()

      expect(messages.value).toEqual([])
      expect(isGenerating.value).toBe(false)
      expect(error.value).toBeNull()
      expect(currentAIResponse.value).toBe('')
      expect(currentThinkingContent.value).toBe('')
    })
  })

  describe('sendMessage', () => {
    it('should not send message if content is empty', async () => {
      const { sendMessage, isGenerating } = useChat()
      await sendMessage('')
      expect(mockGetAIStreamResponse).not.toHaveBeenCalled()
      expect(isGenerating.value).toBe(false)
    })

    it('should add user message and handle [DONE] chunk correctly', async () => {
      mockGetAIStreamResponse.mockImplementation(
        async (messages: ChatMessage[], onChunk: OnChunk) => {
          onChunk('Hello')
          onChunk('[DONE]')
        },
      )

      const { sendMessage, messages, isGenerating } = useChat()
      await sendMessage('test message')

      expect(messages.value).toHaveLength(2)
      expect(messages.value[0].role).toBe('user')
      expect(messages.value[1].role).toBe('assistant')
      expect(messages.value[1].content).toBe('Hello')
      expect(isGenerating.value).toBe(false)
    })

    it('should handle [ABORTED] chunk correctly', async () => {
      mockGetAIStreamResponse.mockImplementation(
        async (messages: ChatMessage[], onChunk: OnChunk) => {
          onChunk('Partially generated...')
          onChunk('[ABORTED]')
        },
      )

      const { sendMessage, messages, isGenerating } = useChat()
      await sendMessage('test message')

      expect(messages.value).toHaveLength(2)
      expect(messages.value[1].content).toContain('Partially generated...')
      expect(messages.value[1].content).toContain(i18n.global.t('ai.aborted'))
      expect(isGenerating.value).toBe(false)
    })

    it('should handle thinking chunks correctly', async () => {
      mockGetAIStreamResponse.mockImplementation(
        async (messages: ChatMessage[], onChunk: OnChunk, onThinking?: OnThinking) => {
          onThinking?.('Thinking process...')
          onChunk('Result')
          onChunk('[DONE]')
        },
      )

      const { sendMessage, messages } = useChat()
      await sendMessage('test message')

      expect(messages.value[1].thinkingContent).toBe('Thinking process...')
      expect(messages.value[1].content).toBe('Result')
    })

    it('should retry on failure and eventually succeed', async () => {
      let calls = 0
      mockGetAIStreamResponse.mockImplementation(
        async (messages: ChatMessage[], onChunk: OnChunk) => {
          calls++
          if (calls === 1) throw new Error('Network error')
          onChunk('Success')
          onChunk('[DONE]')
        },
      )

      const { sendMessage, error, messages } = useChat()
      await sendMessage('test message')

      expect(calls).toBe(2)
      expect(error.value).toBeNull()
      expect(messages.value[1].content).toBe('Success')
    })

    it('should stop retrying after MAX_RETRIES', async () => {
      mockGetAIStreamResponse.mockImplementation(async () => {
        throw new Error('Persistent error')
      })

      const { sendMessage, error } = useChat()
      await sendMessage('test message')

      expect(mockGetAIStreamResponse).toHaveBeenCalledTimes(4) // Initial + 3 retries
      expect(error.value).toBe('Persistent error')
    })

    it('should handle multi-model discussion mode', async () => {
      vi.mocked(getAIConfig).mockReturnValue({
        discussionMode: true,
        discussionModelIds: ['m1', 'm2'],
        discussionPrimaryModelId: 'm1',
        baseUrl: '',
        apiKey: '',
        model: '',
        systemPrompt: '',
        temperature: 0.7,
        thinkingMode: 'disabled',
        todoAssistant: false,
      })

      mockGetMultiModelDiscussionStream.mockImplementation(
        async (messages: ChatMessage[], onSteps: OnSteps, onChunk: OnChunk) => {
          onSteps([{ modelId: 'm1', modelName: 'M1', content: 'step 1', status: 'done' }])
          onChunk('Final answer')
          onChunk('[DONE]')
        },
      )

      const { sendMessage, messages } = useChat()
      await sendMessage('discuss this')

      expect(mockGetMultiModelDiscussionStream).toHaveBeenCalled()
      expect(messages.value[1].discussionSteps).toHaveLength(1)
      expect(messages.value[1].content).toBe('Final answer')
    })
  })

  describe('stopGenerating', () => {
    it('should call abortCurrentRequest', () => {
      const { stopGenerating } = useChat()
      stopGenerating()
      expect(mockAbortCurrentRequest).toHaveBeenCalled()
    })
  })

  describe('clearHistory', () => {
    it('should create new session and reset state', () => {
      const { clearHistory, currentAIResponse, currentThinkingContent, error } = useChat()
      currentAIResponse.value = 'test'
      currentThinkingContent.value = 'test'
      error.value = 'test'

      clearHistory()

      expect(mockCreateSession).toHaveBeenCalled()
      expect(currentAIResponse.value).toBe('')
      expect(currentThinkingContent.value).toBe('')
      expect(error.value).toBeNull()
    })
  })

  describe('deleteMessage', () => {
    it('should remove message by id', () => {
      mockCurrentSession.value = {
        id: 's1',
        title: 'T1',
        messages: [{ id: 'm1', role: 'user', content: 'h' }],
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      const { deleteMessage, messages } = useChat()
      deleteMessage('m1')
      expect(messages.value).toHaveLength(0)
    })
  })

  describe('regenerateLastResponse', () => {
    it('should regenerate last response', async () => {
      mockCurrentSession.value = {
        id: 's1',
        title: 'T1',
        messages: [
          { id: 'm1', role: 'user', content: 'hello' },
          { id: 'm2', role: 'assistant', content: 'hi' },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      mockGetAIStreamResponse.mockImplementation(
        async (messages: ChatMessage[], onChunk: OnChunk) => {
          onChunk('New Hi')
          onChunk('[DONE]')
        },
      )

      const { regenerateLastResponse, messages } = useChat()
      await regenerateLastResponse()

      expect(messages.value).toHaveLength(2)
      expect(messages.value[1].content).toBe('New Hi')
    })
  })

  describe('editAndResendMessage', () => {
    it('should edit and resend', async () => {
      mockCurrentSession.value = {
        id: 's1',
        title: 'T1',
        messages: [
          { id: 'm1', role: 'user', content: 'hello' },
          { id: 'm2', role: 'assistant', content: 'hi' },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      mockGetAIStreamResponse.mockImplementation(
        async (messages: ChatMessage[], onChunk: OnChunk) => {
          onChunk('New response')
          onChunk('[DONE]')
        },
      )

      const { editAndResendMessage, messages } = useChat()
      await editAndResendMessage('m1', 'new hello')

      expect(messages.value).toHaveLength(2)
      expect(messages.value[0].content).toBe('new hello')
      expect(messages.value[1].content).toBe('New response')
    })
  })
})
