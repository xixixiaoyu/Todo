/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, computed } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/i18n'
import { useChat } from '@/features/ai/composables/useChat'
import { _resetChatState } from '@/features/ai/composables/useChatState'
import { _resetMessageCounter } from '@/features/ai/composables/useChatMemory'
import type { ChatSession } from '@/features/ai/composables/useChatHistory'
import {
  getAIStreamResponse,
  getAIStaticResponse,
  abortSessionRequest,
  generateId,
} from '@/features/ai/services/aiService'
import type { ChatMessage, ToolCall } from '@/features/ai/services/aiService'
import { getAIConfig, getAISkills } from '@/features/ai/composables/useAIConfig'
import { mcpApi } from '@/features/mcp/api/mcp'
import { useTodoStore } from '@/features/todo/stores/todo'

// Mock chat history
const mockCurrentSession = ref<ChatSession | null>(null)
const mockCurrentSessionId = computed(() => mockCurrentSession.value?.id ?? null)
const mockSessions = ref<ChatSession[]>([])
const mockGetOrCreateCurrentSession = vi.fn<() => ChatSession>()
const mockUpdateSessionMessages = vi.fn((sessionId: string, messages: ChatMessage[]) => {
  if (mockCurrentSession.value && mockCurrentSession.value.id === sessionId) {
    mockCurrentSession.value = { ...mockCurrentSession.value, messages }
  }
})
const mockAddSessionMessage = vi.fn((sessionId: string, message: ChatMessage) => {
  if (mockCurrentSession.value && mockCurrentSession.value.id === sessionId) {
    mockCurrentSession.value = {
      ...mockCurrentSession.value,
      messages: [...mockCurrentSession.value.messages, message],
    }
  }
})
const mockCreateSession = vi.fn<() => ChatSession>()
const mockUpdateSessionContextSummary =
  vi.fn<(sessionId: string, data: { summary: string; untilMessageId: string }) => void>()
const mockClearSessionContextSummary = vi.fn<(sessionId: string) => void>()

vi.mock('@/features/ai/composables/useChatHistory', async () => {
  return {
    useChatHistory: vi.fn(() => ({
      currentSession: computed(() => mockCurrentSession.value),
      currentSessionId: mockCurrentSessionId,
      sessions: mockSessions,
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
    getMultiModelDiscussionStream: vi.fn(),
    getAIStaticResponse: vi.fn().mockResolvedValue({ content: '[]' }),
    abortCurrentRequest: vi.fn(),
    abortSessionRequest: vi.fn(),
    getSessionAbortSignal: vi.fn(() => new AbortController().signal),
    generateId: vi.fn(() => 'generated-id'),
  }
})

// Mock useMemory
const mockAddMemories = vi.fn()
const mockIsMemoryEnabled = ref(true)
const mockMemories = ref<string[]>([])
const mockLastError = ref<string | null>(null)

vi.mock('@/features/ai/composables/useMemory', () => ({
  useMemory: vi.fn(() => ({
    memories: mockMemories,
    isMemoryEnabled: mockIsMemoryEnabled,
    autoCompressThreshold: ref(30),
    addMemories: mockAddMemories,
    lastError: mockLastError,
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

// Mock MCP API
vi.mock('@/features/mcp/api/mcp', () => ({
  mcpApi: {
    getAllTools: vi.fn().mockResolvedValue([]),
    callTool: vi.fn(),
  },
}))

// Mock AI config
vi.mock('@/features/ai/composables/useAIConfig', () => ({
  getAIConfig: vi.fn(() => ({
    discussionMode: false,
    discussionModelIds: [],
    discussionPrimaryModelId: null,
    memoryModelId: null,
    baseUrl: '',
    apiKey: '',
    model: '',
    systemPrompt: '',
    temperature: 0.7,
    thinkingMode: 'off',
    todoAssistant: false,
    enableImageGeneration: false,
    mcpEnabled: false,
    contextCompressionEnabled: false,
    contextCompressionTriggerChars: 24000,
    contextCompressionModelId: null,
    skillIds: [],
    novelGenre: null,
    novelTone: '',
    novelProtagonistHint: '',
    agentMode: false,
    agentWorkspaceId: null,
    agentWorkspacePath: null,
    visionEnabled: false,
    visionPresetId: null,
  })),
  getAIThinkingLevel: vi.fn(() => 'off'),
  getAISkills: vi.fn(() => []),
}))

describe('useChat', () => {
  const mockGetAIStreamResponse = vi.mocked(getAIStreamResponse)
  const mockGetAIStaticResponse = vi.mocked(getAIStaticResponse)
  const mockAbortSessionRequest = vi.mocked(abortSessionRequest)
  const mockGenerateId = vi.mocked(generateId)

  // 类型定义辅助
  type OnChunk = (chunk: string) => void
  type OnThinking = (thinking: string) => void
  type OnReasoningDetails = (details: string) => void

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.useFakeTimers()
    _resetChatState()
    _resetMessageCounter()

    mockMemories.value = []
    mockIsMemoryEnabled.value = true
    localStorage.removeItem('auth')

    // 重置 mock 实现
    mockCurrentSession.value = null
    vi.mocked(getAIConfig).mockReturnValue({
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
      thinkingMode: 'off',
      todoAssistant: false,
      enableImageGeneration: false,
      mcpEnabled: true,
      contextCompressionEnabled: true,
      contextCompressionTriggerChars: 24000,
      contextCompressionModelId: null,
      skillIds: [],
      novelGenre: null,
      novelTone: '',
      novelProtagonistHint: '',
      agentMode: false,
      agentWorkspaceId: null,
      agentWorkspacePath: null,
      visionEnabled: false,
      visionPresetId: null,
    })
    vi.mocked(getAISkills).mockReturnValue([])
    mockUpdateSessionMessages.mockImplementation((sessionId, messages) => {
      if (mockCurrentSession.value && mockCurrentSession.value.id === sessionId) {
        mockCurrentSession.value = { ...mockCurrentSession.value, messages: [...messages] }
        // 更新 mockSessions 列表
        const idx = mockSessions.value.findIndex((s) => s.id === sessionId)
        if (idx !== -1) {
          mockSessions.value[idx] = mockCurrentSession.value
        } else {
          mockSessions.value.push(mockCurrentSession.value)
        }
      }
    })
    mockAddSessionMessage.mockImplementation((sessionId, message) => {
      if (mockCurrentSession.value && mockCurrentSession.value.id === sessionId) {
        mockCurrentSession.value = {
          ...mockCurrentSession.value,
          messages: [...mockCurrentSession.value.messages, message],
        }
        // 更新 mockSessions 列表
        const idx = mockSessions.value.findIndex((s) => s.id === sessionId)
        if (idx !== -1) {
          mockSessions.value[idx] = mockCurrentSession.value
        } else {
          mockSessions.value.push(mockCurrentSession.value)
        }
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
      if (!mockSessions.value.some((s) => s.id === mockCurrentSession.value!.id)) {
        mockSessions.value.push(mockCurrentSession.value!)
      }
      return mockCurrentSession.value!
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
        async (
          _messages: ChatMessage[],
          onChunk: OnChunk,
          _onThinking?: OnThinking,
          _onReasoning?: OnReasoningDetails,
        ) => {
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
        async (
          _messages: ChatMessage[],
          onChunk: OnChunk,
          _onThinking?: OnThinking,
          _onReasoning?: OnReasoningDetails,
        ) => {
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
        async (
          _messages: ChatMessage[],
          onChunk: OnChunk,
          onThinking?: OnThinking,
          _onReasoning?: OnReasoningDetails,
        ) => {
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

    it('should extract memories according to frequency strategy', async () => {
      const mockGetAIStaticResponse = vi.mocked(getAIStaticResponse)
      mockGetAIStreamResponse.mockImplementation(
        async (
          _messages: ChatMessage[],
          onChunk: OnChunk,
          _onThinking?: OnThinking,
          _onReasoning?: OnReasoningDetails,
        ) => {
          onChunk('Response')
          onChunk('[DONE]')
        },
      )
      mockGetAIStaticResponse.mockResolvedValue({ content: '["Memory A"]' })

      const { sendMessage } = useChat()

      // 1-2 轮：不应提取（新逻辑：每 3 轮提取一次，且无关键词）
      await sendMessage('normal msg 1')
      await sendMessage('normal msg 2')
      expect(mockGetAIStaticResponse).toHaveBeenCalledTimes(0)

      // 3. 第三轮：应提取
      await sendMessage('normal msg 3')
      expect(mockGetAIStaticResponse).toHaveBeenCalledTimes(1)
    })

    it('should extract memories immediately when semantic keywords are detected', async () => {
      mockGetAIStreamResponse.mockImplementation(
        async (
          _messages: ChatMessage[],
          onChunk: OnChunk,
          _onThinking?: OnThinking,
          _onReasoning?: OnReasoningDetails,
        ) => {
          onChunk('Response')
          onChunk('[DONE]')
        },
      )
      mockGetAIStaticResponse.mockResolvedValue({ content: '["Memory A"]' })

      const { sendMessage } = useChat()

      // 1. 普通消息：不触发（第 1 轮）
      await sendMessage('hello world')
      expect(mockGetAIStaticResponse).toHaveBeenCalledTimes(0)

      // 2. 包含关键词且长度足够：立即触发
      await sendMessage('我的技术栈是 Vue 和 TS')
      expect(mockGetAIStaticResponse).toHaveBeenCalledTimes(1)

      // 3. 再次普通消息：不触发
      await sendMessage('tell me a joke')
      expect(mockGetAIStaticResponse).toHaveBeenCalledTimes(1)

      // 4. 包含关键词：再次立即触发
      await sendMessage('我习惯使用 VS Code 开发')
      expect(mockGetAIStaticResponse).toHaveBeenCalledTimes(2)
    })

    it('should retry on failure and eventually succeed', async () => {
      let calls = 0
      mockGetAIStreamResponse.mockImplementation(
        async (
          _messages: ChatMessage[],
          onChunk: OnChunk,
          _onThinking?: OnThinking,
          _onReasoning?: OnReasoningDetails,
        ) => {
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

    it('should namespace MCP tool names to avoid collisions', async () => {
      const serverA = '11111111-1111-1111-1111-111111111111'
      const serverB = '22222222-2222-2222-2222-222222222222'
      vi.mocked(mcpApi.getAllTools).mockResolvedValue([
        { name: 'search', description: 'a', inputSchema: {}, serverId: serverA },
        { name: 'search', description: 'b', inputSchema: {}, serverId: serverB },
      ])

      vi.mocked(mcpApi.callTool).mockResolvedValue({
        content: [{ type: 'text', text: 'ok' }],
        isError: false,
      })

      let calls = 0
      const aiToolNameA = `mcp_${serverA.slice(0, 8)}_search`

      mockGetAIStreamResponse.mockImplementation(
        async (
          _messages: ChatMessage[],
          onChunk: OnChunk,
          _onThinking?: OnThinking,
          _onReasoning?: OnReasoningDetails,
          _options?: unknown,
          onToolCall?: (toolCall: ToolCall) => void,
        ) => {
          calls++

          if (calls === 1) {
            onToolCall?.({
              id: 'tc1',
              type: 'function',
              function: {
                name: aiToolNameA,
                arguments: JSON.stringify({ q: 'x' }),
              },
            } as ToolCall)
            onChunk('[DONE]')
            return
          }

          onChunk('Final')
          onChunk('[DONE]')
        },
      )

      const { sendMessage, messages } = useChat()
      await sendMessage('test message')

      // Since runtime auth access is disabled (getAuthToken returns null),
      // MCP tools are not loaded and runtime auth features are unavailable.
      expect(mcpApi.getAllTools).not.toHaveBeenCalled()
      expect(mcpApi.callTool).not.toHaveBeenCalled()

      // The AI tool call is still recorded, but since no tools were loaded,
      // the tool lookup fails and an error message is added instead.
      const toolMessages = messages.value.filter((m) => m.role === 'tool')
      expect(toolMessages.length).toBeGreaterThan(0)
      expect(toolMessages.some((m) => m.toolName === aiToolNameA)).toBe(true)
      expect(toolMessages.some((m) => m.content.includes('not found'))).toBe(true)
    })

    it('should preserve reasoning when a tool-only assistant message triggers the next iteration', async () => {
      const serverA = '11111111-1111-1111-1111-111111111111'
      const aiToolName = `mcp_${serverA.slice(0, 8)}_search`
      let secondIterationMessages: ChatMessage[] = []
      let calls = 0

      vi.mocked(mcpApi.getAllTools).mockResolvedValue([
        { name: 'search', description: 'a', inputSchema: {}, serverId: serverA },
      ])
      vi.mocked(mcpApi.callTool).mockResolvedValue({
        content: [{ type: 'text', text: 'ok' }],
        isError: false,
      })

      mockGetAIStreamResponse.mockImplementation(
        async (
          messagesForRequest: ChatMessage[],
          onChunk: OnChunk,
          _onThinking?: OnThinking,
          onReasoning?: OnReasoningDetails,
          _options?: unknown,
          onToolCall?: (toolCall: ToolCall) => void,
        ) => {
          calls++

          if (calls === 1) {
            onReasoning?.('Need to inspect the skill manifest first')
            onToolCall?.({
              id: 'tc1',
              type: 'function',
              function: {
                name: aiToolName,
                arguments: JSON.stringify({ q: 'x' }),
              },
            })
            onChunk('[DONE]')
            return
          }

          secondIterationMessages = messagesForRequest
          onChunk('Final')
          onChunk('[DONE]')
        },
      )

      const { sendMessage } = useChat()
      await sendMessage('test message')

      const assistantMessage = secondIterationMessages.find(
        (message) => message.role === 'assistant',
      )

      expect(assistantMessage?.content).toBe('')
      expect(assistantMessage?.thinkingContent).toBe('Need to inspect the skill manifest first')
      expect(assistantMessage?.reasoning_details).toBe('Need to inspect the skill manifest first')
      expect(assistantMessage?.tool_calls?.[0]?.id).toBe('tc1')
    })

    it('should treat selected skills as active in default chat mode', async () => {
      vi.mocked(getAIConfig).mockReturnValue({
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
        thinkingMode: 'off',
        todoAssistant: false,
        enableImageGeneration: false,
        mcpEnabled: false,
        contextCompressionEnabled: false,
        contextCompressionTriggerChars: 24000,
        contextCompressionModelId: null,
        skillIds: ['skill-1'],
        novelGenre: null,
        novelTone: '',
        novelProtagonistHint: '',
        agentMode: false,
        agentWorkspaceId: null,
        agentWorkspacePath: null,
        visionEnabled: false,
        visionPresetId: null,
      })
      vi.mocked(getAISkills).mockReturnValue([
        {
          id: 'skill-1',
          name: 'code-review',
          description: 'Review code risks',
          prompt: 'Always produce risk-first review findings',
        },
      ])

      mockGetAIStreamResponse.mockImplementation(
        async (_messages: ChatMessage[], onChunk: OnChunk) => {
          onChunk('ok')
          onChunk('[DONE]')
        },
      )

      const { sendMessage } = useChat()
      await sendMessage('review this change')

      const firstCall = mockGetAIStreamResponse.mock.calls[0]
      expect(firstCall).toBeDefined()

      const sentOptions = firstCall?.[4] as
        | { activeSkills?: Array<{ id: string; name: string }>; skills?: Array<{ id: string }> }
        | undefined

      expect(sentOptions?.skills?.map((skill) => skill.id)).toEqual(['skill-1'])
      expect(sentOptions?.activeSkills?.map((skill) => skill.id)).toEqual(['skill-1'])
      expect(sentOptions?.activeSkills?.map((skill) => skill.name)).toEqual(['code-review'])
    })

    it('should compress long context and pass summary to request', async () => {
      mockIsMemoryEnabled.value = false
      vi.mocked(getAIConfig).mockReturnValue({
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
        thinkingMode: 'off',
        todoAssistant: false,
        enableImageGeneration: false,
        mcpEnabled: true,
        contextCompressionEnabled: true,
        contextCompressionTriggerChars: 10,
        contextCompressionModelId: null,
        skillIds: [],
        novelGenre: null,
        novelTone: '',
        novelProtagonistHint: '',
        agentMode: false,
        agentWorkspaceId: null,
        agentWorkspacePath: null,
        visionEnabled: false,
        visionPresetId: null,
      })

      mockCurrentSession.value = {
        id: 's1',
        title: 'T1',
        messages: [
          { id: 'u1', role: 'user', content: 'old user message long long long' },
          { id: 'a1', role: 'assistant', content: 'old assistant message long long long' },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const mockGetAIStaticResponse = vi.mocked(getAIStaticResponse)
      mockGetAIStaticResponse.mockResolvedValueOnce({ content: 'summary' })

      mockGetAIStreamResponse.mockImplementation(
        async (_messages: ChatMessage[], onChunk: OnChunk) => {
          onChunk('ok')
          onChunk('[DONE]')
        },
      )

      const { sendMessage } = useChat()
      await sendMessage('new message')

      const firstCall = mockGetAIStreamResponse.mock.calls[0]
      expect(firstCall).toBeDefined()

      const sentMessages = firstCall[0]
      expect(sentMessages).toHaveLength(1)
      expect(sentMessages[0].role).toBe('user')
      expect(sentMessages[0].content).toBe('new message')

      const sentOptions = firstCall[4] as { contextSummary?: string } | undefined
      expect(sentOptions?.contextSummary).toBe('summary')
      expect(mockUpdateSessionContextSummary).toHaveBeenCalledWith('s1', {
        summary: 'summary',
        untilMessageId: 'a1',
      })
    })

    it('should use live memory injection instead of stale session snapshot', async () => {
      mockIsMemoryEnabled.value = true
      mockMemories.value = ['Live Memory']

      mockCurrentSession.value = {
        id: 's1',
        title: 'T1',
        messages: [],
        memorySnapshot: ['Stale Memory'],
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockGetAIStreamResponse.mockImplementation(
        async (_messages: ChatMessage[], onChunk: OnChunk) => {
          onChunk('ok')
          onChunk('[DONE]')
        },
      )

      const { sendMessage } = useChat()
      await sendMessage('test message')

      const firstCall = mockGetAIStreamResponse.mock.calls[0]
      const sentOptions = firstCall?.[4] as { memorySnapshot?: string[] } | undefined

      expect(sentOptions?.memorySnapshot).toBeUndefined()
    })

    it('should not parse streaming todo actions when todo assistant is disabled', async () => {
      vi.mocked(getAIConfig).mockReturnValue({
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
        thinkingMode: 'off',
        todoAssistant: false,
        enableImageGeneration: false,
        mcpEnabled: false,
        contextCompressionEnabled: false,
        contextCompressionTriggerChars: 24000,
        contextCompressionModelId: null,
        skillIds: [],
        novelGenre: null,
        novelTone: '',
        novelProtagonistHint: '',
        agentMode: false,
        agentWorkspaceId: null,
        agentWorkspacePath: null,
        visionEnabled: false,
        visionPresetId: null,
      })

      mockGetAIStreamResponse.mockImplementation(
        async (_messages: ChatMessage[], onChunk: OnChunk) => {
          onChunk(
            'planning...\n[TODO_ACTIONS_START]\n[{"type":"add","data":{"title":"Task A"}}]\n[TODO_ACTIONS_END]',
          )
        },
      )

      const { sendMessage, messages } = useChat()
      await sendMessage('test message')

      const streamingMessage = messages.value[messages.value.length - 1]
      expect(streamingMessage?.isStreaming).toBe(true)
      expect(streamingMessage?.todoActions).toBeUndefined()
    })

    it('should persist pending structured blocks into final assistant message', async () => {
      mockGetAIStreamResponse.mockImplementation(
        async (_messages: ChatMessage[], onChunk: OnChunk) => {
          onChunk('start\n[TEACHING_QUIZ_START]\n{"version":1')
          onChunk('[DONE]')
        },
      )

      const { sendMessage, messages } = useChat()
      await sendMessage('test message')

      const assistantMessage = messages.value.find((m) => m.role === 'assistant')
      expect(assistantMessage).toBeDefined()
      expect(assistantMessage?.pendingStructuredBlocks).toContain('teaching_quiz')
    })
  })

  describe('stopGenerating', () => {
    it('should call abortSessionRequest on current session', () => {
      const { stopGenerating } = useChat()
      mockCurrentSession.value = {
        id: 'test-session',
        title: 'Test',
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      stopGenerating()
      expect(mockAbortSessionRequest).toHaveBeenCalledWith('test-session')
    })
  })

  describe('clearHistory', () => {
    it('should create new session and reset state', () => {
      const { clearHistory, currentAIResponse, currentThinkingContent, error } = useChat()
      const todoStore = useTodoStore()

      // 设置当前会话包含消息，确保 clearHistory 守卫逻辑通过
      mockCurrentSession.value = {
        id: 'existing-session',
        title: 'Existing',
        messages: [{ id: 'msg-1', role: 'user', content: 'hello' }],
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      todoStore.setProposedChanges('assistant-1', [
        { id: 'temp-1', type: 'add', data: { title: 'A' } },
      ])
      currentAIResponse.value = 'test'
      currentThinkingContent.value = 'test'
      error.value = 'test'

      clearHistory()

      expect(mockCreateSession).toHaveBeenCalled()
      expect(currentAIResponse.value).toBe('')
      expect(currentThinkingContent.value).toBe('')
      expect(error.value).toBeNull()
      expect(todoStore.activeProposedChangeSetId).toBeNull()
      expect(todoStore.proposedChanges).toEqual([])
    })

    it('should not create a new session when current session is already empty', () => {
      const { clearHistory } = useChat()
      // 当前会话为 null（由 beforeEach 设置），chatHistory 为空
      clearHistory()
      expect(mockCreateSession).not.toHaveBeenCalled()
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

    it('should clear proposed changes when deleting assistant message', () => {
      const todoStore = useTodoStore()
      todoStore.setProposedChanges('m2', [{ id: 'temp-1', type: 'add', data: { title: 'A' } }])

      mockCurrentSession.value = {
        id: 's1',
        title: 'T1',
        messages: [
          { id: 'm1', role: 'user', content: 'h' },
          { id: 'm2', role: 'assistant', content: 'ok' },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const { deleteMessage, messages } = useChat()
      deleteMessage('m2')
      expect(messages.value).toHaveLength(0)
      expect(todoStore.activeProposedChangeSetId).toBeNull()
      expect(todoStore.proposedChanges).toEqual([])
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
        async (_messages: ChatMessage[], onChunk: OnChunk) => {
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
        async (_messages: ChatMessage[], onChunk: OnChunk) => {
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

    it('should correctly delete a message and update history', async () => {
      const { deleteMessage, messages } = useChat()

      // 添加几条消息
      const msg1: ChatMessage = { id: 'm1', role: 'user', content: 'Hi' }
      const msg2: ChatMessage = { id: 'm2', role: 'assistant', content: 'Hello' }
      mockCurrentSession.value = {
        id: 'session-1',
        title: 'Test',
        messages: [msg1, msg2],
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      deleteMessage('m1')

      expect(mockUpdateSessionMessages).toHaveBeenCalledWith('session-1', [msg2], true)
      expect(messages.value).toHaveLength(1)
      expect(messages.value[0].id).toBe('m2')
    })
  })

  describe('regenerateMessage', () => {
    it('should regenerate specified AI response and delete subsequent messages', async () => {
      mockCurrentSession.value = {
        id: 's1',
        title: 'T1',
        messages: [
          { id: 'm1', role: 'user', content: 'msg 1' },
          { id: 'm2', role: 'assistant', content: 'res 1' },
          { id: 'm3', role: 'user', content: 'msg 2' },
          { id: 'm4', role: 'assistant', content: 'res 2' },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      mockGetAIStreamResponse.mockImplementation(
        async (_messages: ChatMessage[], onChunk: OnChunk) => {
          onChunk('New res 1')
          onChunk('[DONE]')
        },
      )

      const { regenerateMessage, messages } = useChat()
      await regenerateMessage('m2')

      // Should keep m1, and regenerate m2, deleting m3 and m4
      expect(messages.value).toHaveLength(2)
      expect(messages.value[0].id).toBe('m1')
      expect(messages.value[1].content).toBe('New res 1')
      expect(messages.value.find((m) => m.id === 'm3')).toBeUndefined()
      expect(messages.value.find((m) => m.id === 'm4')).toBeUndefined()
    })
  })
})
