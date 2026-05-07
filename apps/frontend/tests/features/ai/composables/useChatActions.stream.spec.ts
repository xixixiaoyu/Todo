/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { _resetChatState, novelBatchRemaining } from '@/features/ai/composables/useChatState'
import type { AIConfig } from '@/features/ai/composables/useAIConfig'
import type { ChatSession } from '@/features/ai/composables/useChatHistory'
import type { DiscussionStep } from '@/features/ai/services/aiService'
import type { ProposedTodoChange } from '@/features/todo/stores/todo'

vi.mock('@/features/ai/services/aiService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/ai/services/aiService')>()
  return {
    ...actual,
    parseAssistantBlocks: vi.fn(() => ({
      cleanText: 'test chapter content',
      errors: [],
      pendingStructuredBlocks: [],
    })),
  }
})

vi.mock('@/features/ai/composables/useChatActions.utils', () => ({
  buildTeachingFallbackQuiz: vi.fn(() => undefined),
  stripTodoIdsFromText: vi.fn((text: string) => text),
}))

import { finalizeCompletedResponse } from '@/features/ai/composables/useChatActions.stream'
import { parseAssistantBlocks } from '@/features/ai/services/aiService'

const mockParseAssistantBlocks = vi.mocked(parseAssistantBlocks)

function createNovelAIConfig(): AIConfig {
  return {
    assistantMode: 'novel',
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
    thinkingEffort: 'high',
    todoAssistant: false,
    enableImageGeneration: false,
    mcpEnabled: false,
    contextCompressionEnabled: false,
    contextCompressionTriggerChars: 24000,
    contextCompressionModelId: null,
    skillIds: [],
    novelGenre: 'fantasy',
    novelTone: 'epic',
    novelProtagonistHint: 'a brave knight',
    agentMode: false,
    agentWorkspaceId: null,
    agentWorkspacePath: null,
  }
}

function createDefaultAIConfig(): AIConfig {
  return {
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
    thinkingEffort: 'high',
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
  }
}

function createBaseParams(overrides?: Partial<Parameters<typeof finalizeCompletedResponse>[0]>) {
  const defaults = {
    aiConfig: createDefaultAIConfig(),
    assistantMessageId: 'msg-1',
    currentAIResponse: ref(''),
    currentThinkingContent: ref(''),
    currentReasoningDetails: ref(''),
    currentDiscussionSteps: ref<DiscussionStep[]>([]),
    currentTodoActions: ref<ProposedTodoChange[]>([]),
    sessions: ref<ChatSession[]>([]),
    generationSessionId: 'session-1',
    addSessionMessage: vi.fn(),
    extractAndStoreMemories: vi.fn(),
    isMemoryEnabled: ref(false),
    onStreamDone: vi.fn(),
    resetStreamingState: vi.fn(),
    todoStore: { setProposedChanges: vi.fn() },
    t: vi.fn((key: string) => key),
    ...overrides,
  }
  return defaults as Parameters<typeof finalizeCompletedResponse>[0]
}

describe('finalizeCompletedResponse — novel auto-continue', () => {
  beforeEach(() => {
    _resetChatState()
    vi.clearAllMocks()
    mockParseAssistantBlocks.mockReturnValue({
      cleanText: 'test chapter content',
      errors: [],
      pendingStructuredBlocks: [],
    })
  })

  describe('novelBatchRemaining decrement', () => {
    it('decrements by at least 1 when no [NOVEL_CHAPTER_START] markers present', () => {
      novelBatchRemaining.value = 3
      const currentAIResponse = ref('This is a chapter without any structured markers.')

      finalizeCompletedResponse(
        createBaseParams({
          aiConfig: createNovelAIConfig(),
          currentAIResponse,

          generationSessionId: null,
        }),
      )

      expect(novelBatchRemaining.value).toBe(2)
    })

    it('decrements by exact marker count when [NOVEL_CHAPTER_START] markers found', () => {
      novelBatchRemaining.value = 5
      const currentAIResponse = ref(
        '[NOVEL_CHAPTER_START]\nChapter 1\n[NOVEL_CHAPTER_START]\nChapter 2\n[NOVEL_CHAPTER_START]\nChapter 3',
      )

      finalizeCompletedResponse(
        createBaseParams({
          aiConfig: createNovelAIConfig(),
          currentAIResponse,

          generationSessionId: null,
        }),
      )

      expect(novelBatchRemaining.value).toBe(2)
    })

    it('never goes below zero', () => {
      novelBatchRemaining.value = 2
      const currentAIResponse = ref(
        '[NOVEL_CHAPTER_START]\nChapter 1\n[NOVEL_CHAPTER_START]\nChapter 2\n[NOVEL_CHAPTER_START]\nChapter 3',
      )

      finalizeCompletedResponse(
        createBaseParams({
          aiConfig: createNovelAIConfig(),
          currentAIResponse,

          generationSessionId: null,
        }),
      )

      expect(novelBatchRemaining.value).toBe(0)
    })

    it('does not decrement when novelBatchRemaining is already 0', () => {
      novelBatchRemaining.value = 0
      const currentAIResponse = ref('[NOVEL_CHAPTER_START]\nChapter 1')

      finalizeCompletedResponse(
        createBaseParams({
          aiConfig: createNovelAIConfig(),
          currentAIResponse,

          generationSessionId: null,
        }),
      )

      expect(novelBatchRemaining.value).toBe(0)
    })

    it('still decrements novelBatchRemaining in non-novel mode (defense-in-depth)', () => {
      novelBatchRemaining.value = 5
      const currentAIResponse = ref('Some default response')

      finalizeCompletedResponse(
        createBaseParams({
          aiConfig: createDefaultAIConfig(),
          currentAIResponse,

          generationSessionId: null,
        }),
      )

      expect(novelBatchRemaining.value).toBe(4)
    })
  })

  describe('onStreamDone callback for novel auto-continue', () => {
    it('sets isGenerating false when more novel chapters remain (allows auto-continue through guard)', () => {
      novelBatchRemaining.value = 3
      const onStreamDone = vi.fn()
      const currentAIResponse = ref('[NOVEL_CHAPTER_START]\nChapter 1')

      finalizeCompletedResponse(
        createBaseParams({
          aiConfig: createNovelAIConfig(),
          currentAIResponse,
          onStreamDone,

          generationSessionId: null,
        }),
      )

      // isGenerating 始终设为 false，避免 sendMessage 顶部守卫拦截后续自动补章
      expect(onStreamDone).toHaveBeenCalled()
    })

    it('sets isGenerating false when last novel chapter completes', () => {
      novelBatchRemaining.value = 1
      const onStreamDone = vi.fn()
      const currentAIResponse = ref('[NOVEL_CHAPTER_START]\nFinal chapter')

      finalizeCompletedResponse(
        createBaseParams({
          aiConfig: createNovelAIConfig(),
          currentAIResponse,
          onStreamDone,

          generationSessionId: null,
        }),
      )

      expect(novelBatchRemaining.value).toBe(0)
      expect(onStreamDone).toHaveBeenCalled()
    })

    it('sets isGenerating false in non-novel mode', () => {
      novelBatchRemaining.value = 0
      const onStreamDone = vi.fn()
      const currentAIResponse = ref('Default response')

      finalizeCompletedResponse(
        createBaseParams({
          aiConfig: createDefaultAIConfig(),
          currentAIResponse,
          onStreamDone,

          generationSessionId: null,
        }),
      )

      expect(onStreamDone).toHaveBeenCalled()
    })

    it('sets isGenerating false with floor decrement when no markers', () => {
      novelBatchRemaining.value = 2
      const onStreamDone = vi.fn()
      const currentAIResponse = ref('Chapter without markers')

      finalizeCompletedResponse(
        createBaseParams({
          aiConfig: createNovelAIConfig(),
          currentAIResponse,
          onStreamDone,

          generationSessionId: null,
        }),
      )

      // isGenerating 始终设为 false，小说补章由 sendMessage 递归调用驱动
      expect(onStreamDone).toHaveBeenCalled()
    })
  })
})
