import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, computed } from 'vue'
import i18n from '@/i18n'
import { useChat } from '@/composables/useChat'
import type { ChatSession } from '@/composables/useChatHistory'
import type { ChatMessage } from '@/services/aiService'

// Mock chat history
const mockCurrentSession = ref<ChatSession | null>(null)
const mockGetOrCreateCurrentSession = vi.fn<() => ChatSession>()
const mockUpdateSessionMessages = vi.fn<(sessionId: string, messages: ChatMessage[]) => void>()
const mockCreateSession = vi.fn<() => ChatSession>()

vi.mock('@/composables/useChatHistory', async () => {
  const actual = await vi.importActual('@/composables/useChatHistory')
  return {
    ...actual,
    useChatHistory: vi.fn(() => ({
      currentSession: computed(() => mockCurrentSession.value),
      getOrCreateCurrentSession: mockGetOrCreateCurrentSession,
      updateSessionMessages: mockUpdateSessionMessages,
      createSession: mockCreateSession,
    })),
  }
})

// Mock AI service
import {
  getAIStreamResponse,
  getMultiModelDiscussionStream,
  abortCurrentRequest,
  generateId,
} from '@/services/aiService'

vi.mock('@/services/aiService', async () => {
  const actual = await vi.importActual('@/services/aiService')
  return {
    ...(actual as Record<string, unknown>),
    getAIStreamResponse: vi.fn(),
    getMultiModelDiscussionStream: vi.fn(),
    abortCurrentRequest: vi.fn(),
    generateId: vi.fn(() => 'generated-id'),
  }
})

// Mock AI config
import { getAIConfig } from '@/composables/useAIConfig'
vi.mock('@/composables/useAIConfig', () => ({
  getAIConfig: vi.fn(() => ({
    discussionMode: false,
    discussionModelIds: [],
    discussionPrimaryModelId: null,
  })),
  getAIThinkingMode: vi.fn(() => 'disabled'),
}))

describe('useChat', () => {
  const mockGetAIStreamResponse = vi.fn()
  const mockGetMultiModelDiscussionStream = vi.fn()
  const mockAbortCurrentRequest = vi.fn()
  const mockGenerateId = vi.fn(() => 'generated-id')

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

    // 重新设置 AI 服务模拟
    vi.mocked(getAIStreamResponse).mockImplementation(mockGetAIStreamResponse)
    vi.mocked(getMultiModelDiscussionStream).mockImplementation(mockGetMultiModelDiscussionStream)
    vi.mocked(abortCurrentRequest).mockImplementation(mockAbortCurrentRequest)
    vi.mocked(generateId).mockImplementation(mockGenerateId)
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

    it('should not send message if content is only whitespace', async () => {
      const { sendMessage } = useChat()

      await sendMessage('   ')

      expect(mockGetAIStreamResponse).not.toHaveBeenCalled()
    })

    it('should not send message if already generating', async () => {
      const { sendMessage, isGenerating } = useChat()

      // 模拟正在生成状态
      isGenerating.value = true

      await sendMessage('test message')

      expect(mockGetAIStreamResponse).not.toHaveBeenCalled()
    })

    it('should add user message and start generation', async () => {
      const mockSession: ChatSession = {
        id: 'session-1',
        title: 'Test Session',
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      mockCurrentSession.value = mockSession
      mockGetOrCreateCurrentSession.mockReturnValue(mockSession)

      mockGetAIStreamResponse.mockImplementation(async (_, onChunk) => {
        // 模拟流响应内容
        onChunk('Hello')
        onChunk('[DONE]')
      })

      const { sendMessage, messages, isGenerating } = useChat()

      await sendMessage('test message')

      expect(messages.value).toHaveLength(2) // 用户消息 + AI 消息
      expect(messages.value[0].role).toBe('user')
      expect(messages.value[0].content).toBe('test message')
      expect(isGenerating.value).toBe(false)
    })

    it('should handle streaming chunks correctly', async () => {
      const mockSession: ChatSession = {
        id: 'session-1',
        title: 'Test Session',
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      mockCurrentSession.value = mockSession
      mockGetOrCreateCurrentSession.mockReturnValue(mockSession)

      mockGetAIStreamResponse.mockImplementation(async (_, onChunk) => {
        onChunk('Hello')
        onChunk(' World')
        onChunk('[DONE]')
      })

      const { sendMessage, currentAIResponse } = useChat()

      await sendMessage('test message')

      expect(currentAIResponse.value).toBe('')
    })

    it('should handle streaming with thinking content', async () => {
      const mockSession: ChatSession = {
        id: 'session-1',
        title: 'Test Session',
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      mockCurrentSession.value = mockSession
      mockGetOrCreateCurrentSession.mockReturnValue(mockSession)

      mockGetAIStreamResponse.mockImplementation(async (_, onChunk, onThinking) => {
        onThinking('Thinking...')
        onChunk('Hello')
        onChunk('[DONE]')
      })

      const { sendMessage, currentThinkingContent, currentAIResponse } = useChat()

      await sendMessage('test message')

      expect(currentThinkingContent.value).toBe('')
      expect(currentAIResponse.value).toBe('')
    })

    it('should handle abort response', async () => {
      const mockSession: ChatSession = {
        id: 'session-1',
        title: 'Test Session',
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      mockCurrentSession.value = mockSession
      mockGetOrCreateCurrentSession.mockReturnValue(mockSession)

      mockGetAIStreamResponse.mockImplementation(async (_, onChunk) => {
        onChunk('Partial')
        onChunk('[ABORTED]')
      })

      const { sendMessage, messages, isGenerating } = useChat()

      await sendMessage('test message')

      expect(messages.value).toHaveLength(2) // 用户消息 + 部分 AI 消息
      const abortedText = i18n.global.t('ai.aborted')
      expect(messages.value[1].content).toContain(abortedText)
      expect(isGenerating.value).toBe(false)
    })

    it('should handle error and retry', async () => {
      const mockSession: ChatSession = {
        id: 'session-1',
        title: 'Test Session',
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      mockCurrentSession.value = mockSession
      mockGetOrCreateCurrentSession.mockReturnValue(mockSession)

      const error = new Error('Network error')
      mockGetAIStreamResponse
        .mockRejectedValueOnce(error)
        .mockImplementationOnce(async (_, onChunk) => {
          onChunk('Success after retry')
          onChunk('[DONE]')
        })

      const { sendMessage, error: errorState, isGenerating } = useChat()

      await sendMessage('test message')

      // 第一次调用失败，第二次成功（由于重试）
      expect(mockGetAIStreamResponse).toHaveBeenCalledTimes(2)
      expect(errorState.value).toBeNull()
      expect(isGenerating.value).toBe(false)
    })

    it('should handle max retries', async () => {
      const mockSession: ChatSession = {
        id: 'session-1',
        title: 'Test Session',
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      mockCurrentSession.value = mockSession
      mockGetOrCreateCurrentSession.mockReturnValue(mockSession)

      const error = new Error('Network error')
      mockGetAIStreamResponse.mockRejectedValue(error)

      const { sendMessage, error: errorState, isGenerating } = useChat()

      await sendMessage('test message')

      // 应该重试 3 次（MAX_RETRIES = 3）
      expect(mockGetAIStreamResponse).toHaveBeenCalledTimes(4) // 原始 + 3 次重试
      expect(errorState.value).toBe('Network error')
      expect(isGenerating.value).toBe(false)
    })

    it('should use multi-model discussion when enabled', async () => {
      vi.mocked(getAIConfig).mockReturnValue({
        discussionMode: true,
        discussionModelIds: ['model-1', 'model-2'],
        discussionPrimaryModelId: 'model-1',
        baseUrl: '',
        apiKey: '',
        model: '',
        systemPrompt: '',
        temperature: 0.7,
        thinkingMode: 'disabled',
        todoAssistant: false,
      })

      const mockSession: ChatSession = {
        id: 'session-1',
        title: 'Test Session',
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      mockCurrentSession.value = mockSession
      mockGetOrCreateCurrentSession.mockReturnValue(mockSession)

      mockGetMultiModelDiscussionStream.mockImplementation(
        async (messages, onStepUpdate, onFinalChunk) => {
          onStepUpdate([{ modelId: 'model-1', modelName: 'M1', content: 'Step 1', status: 'done' }])
          onFinalChunk('Final Answer')
          onFinalChunk('[DONE]')
        },
      )

      const { sendMessage, currentDiscussionSteps, messages } = useChat()

      await sendMessage('Hello')

      expect(mockGetMultiModelDiscussionStream).toHaveBeenCalled()
      expect(currentDiscussionSteps.value).toEqual([]) // Should be reset after [DONE]
      expect(messages.value).toHaveLength(2)
      expect(messages.value[1].discussionSteps).toHaveLength(1)
      expect(messages.value[1].discussionSteps![0].content).toBe('Step 1')
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

      currentAIResponse.value = 'test response'
      currentThinkingContent.value = 'test thinking'
      error.value = 'test error'

      clearHistory()

      expect(mockCreateSession).toHaveBeenCalled()
      expect(currentAIResponse.value).toBe('')
      expect(currentThinkingContent.value).toBe('')
      expect(error.value).toBeNull()
    })
  })

  describe('deleteMessage', () => {
    it('should remove message by id', () => {
      const mockSessionWithMessages: ChatSession = {
        id: 'session-1',
        title: 'Test Session',
        messages: [
          { id: 'msg-1', role: 'user', content: 'hello', createdAt: new Date() },
          { id: 'msg-2', role: 'assistant', content: 'hi', createdAt: new Date() },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockCurrentSession.value = mockSessionWithMessages
      mockGetOrCreateCurrentSession.mockReturnValue(mockSessionWithMessages)

      const { deleteMessage, messages } = useChat()

      deleteMessage('msg-1')

      expect(messages.value).toHaveLength(1)
      expect(messages.value[0].id).toBe('msg-2')
    })

    it('should not remove anything if message id not found', () => {
      const mockSessionWithMessages: ChatSession = {
        id: 'session-1',
        title: 'Test Session',
        messages: [{ id: 'msg-1', role: 'user', content: 'hello', createdAt: new Date() }],
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockCurrentSession.value = mockSessionWithMessages
      mockGetOrCreateCurrentSession.mockReturnValue(mockSessionWithMessages)

      const { deleteMessage, messages } = useChat()

      deleteMessage('non-existent')

      expect(messages.value).toHaveLength(1)
      expect(messages.value[0].id).toBe('msg-1')
    })
  })

  describe('regenerateLastResponse', () => {
    it('should regenerate last response when user message exists', async () => {
      const mockSessionWithMessages: ChatSession = {
        id: 'session-1',
        title: 'Test Session',
        messages: [
          { id: 'msg-1', role: 'user', content: 'hello', createdAt: new Date() },
          { id: 'msg-2', role: 'assistant', content: 'hi', createdAt: new Date() },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockCurrentSession.value = mockSessionWithMessages
      mockGetOrCreateCurrentSession.mockReturnValue(mockSessionWithMessages)

      mockGetAIStreamResponse.mockImplementation(async (_, onChunk) => {
        onChunk('Hello')
        onChunk('[DONE]')
      })

      const { regenerateLastResponse, messages } = useChat()

      await regenerateLastResponse()

      // 应该移除助手消息并添加新的用户 + 助手消息
      expect(messages.value).toHaveLength(2) // 新用户 + 新助手
      expect(messages.value[0].role).toBe('user')
      expect(messages.value[0].content).toBe('hello')
    })

    it('should not regenerate if no user message found', async () => {
      const mockSessionWithMessages: ChatSession = {
        id: 'session-1',
        title: 'Test Session',
        messages: [{ id: 'msg-2', role: 'assistant', content: 'hi', createdAt: new Date() }],
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockCurrentSession.value = mockSessionWithMessages
      mockGetOrCreateCurrentSession.mockReturnValue(mockSessionWithMessages)

      const { regenerateLastResponse } = useChat()

      await regenerateLastResponse()

      expect(mockGetAIStreamResponse).not.toHaveBeenCalled()
    })

    it('should not regenerate if already generating', async () => {
      const mockSessionWithMessages: ChatSession = {
        id: 'session-1',
        title: 'Test Session',
        messages: [
          { id: 'msg-1', role: 'user', content: 'hello', createdAt: new Date() },
          { id: 'msg-2', role: 'assistant', content: 'hi', createdAt: new Date() },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockCurrentSession.value = mockSessionWithMessages
      mockGetOrCreateCurrentSession.mockReturnValue(mockSessionWithMessages)

      const { regenerateLastResponse, isGenerating } = useChat()

      isGenerating.value = true
      await regenerateLastResponse()

      expect(mockGetAIStreamResponse).not.toHaveBeenCalled()
    })
  })

  describe('editAndResendMessage', () => {
    it('should edit message and remove subsequent messages', async () => {
      const mockSessionWithMessages: ChatSession = {
        id: 'session-1',
        title: 'Test Session',
        messages: [
          { id: 'msg-1', role: 'user', content: 'hello', createdAt: new Date() },
          { id: 'msg-2', role: 'assistant', content: 'hi', createdAt: new Date() },
          { id: 'msg-3', role: 'user', content: 'how are you', createdAt: new Date() },
          { id: 'msg-4', role: 'assistant', content: 'I am fine', createdAt: new Date() },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockCurrentSession.value = mockSessionWithMessages
      mockGetOrCreateCurrentSession.mockReturnValue(mockSessionWithMessages)

      mockGetAIStreamResponse.mockImplementation(async (_, onChunk) => {
        onChunk('New Response')
        onChunk('[DONE]')
      })

      const { editAndResendMessage, messages } = useChat()

      await editAndResendMessage('msg-1', 'modified hello')

      // msg-1 之后的所有消息都应该被删除，msg-1 被新发送的消息替换
      expect(messages.value).toHaveLength(2) // 替换后的 msg-1 (new user msg) + 新的 AI 回复
      expect(messages.value[0].content).toBe('modified hello')
      expect(messages.value[1].content).toBe('New Response')
    })

    it('should not edit if message id not found', async () => {
      const mockSessionWithMessages: ChatSession = {
        id: 'session-1',
        title: 'Test Session',
        messages: [{ id: 'msg-1', role: 'user', content: 'hello', createdAt: new Date() }],
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockCurrentSession.value = mockSessionWithMessages
      mockGetOrCreateCurrentSession.mockReturnValue(mockSessionWithMessages)

      const { editAndResendMessage, messages } = useChat()

      await editAndResendMessage('non-existent', 'new content')

      expect(messages.value).toHaveLength(1)
      expect(mockGetAIStreamResponse).not.toHaveBeenCalled()
    })

    it('should not edit if content is empty', async () => {
      const mockSessionWithMessages: ChatSession = {
        id: 'session-1',
        title: 'Test Session',
        messages: [{ id: 'msg-1', role: 'user', content: 'hello', createdAt: new Date() }],
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockCurrentSession.value = mockSessionWithMessages
      mockGetOrCreateCurrentSession.mockReturnValue(mockSessionWithMessages)

      const { editAndResendMessage } = useChat()

      await editAndResendMessage('msg-1', '')

      expect(mockGetAIStreamResponse).not.toHaveBeenCalled()
    })
  })

  describe('messages computed', () => {
    it('should include streaming response when present', () => {
      const mockSessionWithMessages: ChatSession = {
        id: 'session-1',
        title: 'Test Session',
        messages: [{ id: 'msg-1', role: 'user', content: 'hello', createdAt: new Date() }],
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockCurrentSession.value = mockSessionWithMessages
      mockGetOrCreateCurrentSession.mockReturnValue(mockSessionWithMessages)

      const { messages, currentAIResponse, currentThinkingContent, isGenerating } = useChat()

      isGenerating.value = true
      currentAIResponse.value = 'partial response'
      currentThinkingContent.value = 'thinking...'

      // 应该包含流式响应
      expect(messages.value).toHaveLength(2)
      expect(messages.value[1].id).toBe('streaming-response')
      expect(messages.value[1].isStreaming).toBe(true)
    })

    it('should not include streaming response when not present', () => {
      const mockSessionWithMessages: ChatSession = {
        id: 'session-1',
        title: 'Test Session',
        messages: [{ id: 'msg-1', role: 'user', content: 'hello', createdAt: new Date() }],
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockCurrentSession.value = mockSessionWithMessages
      mockGetOrCreateCurrentSession.mockReturnValue(mockSessionWithMessages)

      const { messages } = useChat()

      expect(messages.value).toHaveLength(1)
      expect(messages.value[0].id).toBe('msg-1')
    })
  })
})
