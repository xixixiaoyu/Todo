import type { Ref } from 'vue'
import {
  generateId,
  parseAssistantBlocks,
  type ChatMessage,
  type DiscussionStep,
  type TeachingAssessment,
  type TeachingQuiz,
  type NovelCharacterCard,
  type NovelWorldviewSetting,
  type NovelChapterMeta,
} from '@/features/ai/services/aiService'
import type { ProposedTodoChange } from '@/features/todo/stores/todo'
import type { AIConfig } from './useAIConfig'
import type { ChatSession } from './useChatHistory'
import { buildTeachingFallbackQuiz, stripTodoIdsFromText } from './useChatActions.utils'
import { novelBatchRemaining as novelBatchRemainingRef } from './useChatState'

function buildAssistantMessage(params: {
  id: string
  content: string
  thinkingContent?: string
  reasoningDetails?: string
  discussionSteps?: DiscussionStep[]
  todoActions?: ProposedTodoChange[]
  teachingQuizzes?: TeachingQuiz[]
  teachingAssessments?: TeachingAssessment[]
  novelCharacters?: NovelCharacterCard[]
  novelWorldview?: NovelWorldviewSetting[]
  novelChapterMeta?: NovelChapterMeta
  structuredBlockErrors?: ChatMessage['structuredBlockErrors']
  pendingStructuredBlocks?: ChatMessage['pendingStructuredBlocks']
}): ChatMessage {
  return {
    id: params.id,
    role: 'assistant',
    content: params.content,
    thinkingContent: params.thinkingContent,
    reasoning_details: params.reasoningDetails,
    discussionSteps: params.discussionSteps,
    todoActions: params.todoActions,
    teachingQuizzes: params.teachingQuizzes,
    teachingAssessments: params.teachingAssessments,
    novelCharacters: params.novelCharacters,
    novelWorldview: params.novelWorldview,
    novelChapterMeta: params.novelChapterMeta,
    structuredBlockErrors: params.structuredBlockErrors,
    pendingStructuredBlocks: params.pendingStructuredBlocks,
    createdAt: new Date(),
  }
}

function buildCompletedAssistantMessage(params: {
  assistantMessageId: string
  content: string
  thinkingContent: string
  reasoningDetails: string
  discussionSteps: DiscussionStep[]
  todoActions: ProposedTodoChange[]
  teachingQuizzes?: TeachingQuiz[]
  teachingAssessments?: TeachingAssessment[]
  novelCharacters?: NovelCharacterCard[]
  novelWorldview?: NovelWorldviewSetting[]
  novelChapterMeta?: NovelChapterMeta
  structuredBlockErrors?: ChatMessage['structuredBlockErrors']
  pendingStructuredBlocks?: ChatMessage['pendingStructuredBlocks']
}): ChatMessage {
  return buildAssistantMessage({
    id: params.assistantMessageId,
    content: params.content,
    thinkingContent: params.thinkingContent || undefined,
    reasoningDetails: params.reasoningDetails || undefined,
    discussionSteps: params.discussionSteps.length > 0 ? [...params.discussionSteps] : undefined,
    todoActions: params.todoActions.length > 0 ? [...params.todoActions] : undefined,
    teachingQuizzes: params.teachingQuizzes,
    teachingAssessments: params.teachingAssessments,
    novelCharacters: params.novelCharacters,
    novelWorldview: params.novelWorldview,
    novelChapterMeta: params.novelChapterMeta,
    structuredBlockErrors: params.structuredBlockErrors,
    pendingStructuredBlocks: params.pendingStructuredBlocks,
  })
}

function buildAbortedAssistantMessage(params: {
  assistantMessageId: string
  content: string
  thinkingContent: string
  reasoningDetails: string
  discussionSteps: DiscussionStep[]
  t: (key: string, params?: Record<string, unknown>) => string
}): ChatMessage {
  return buildAssistantMessage({
    id: params.assistantMessageId,
    content: `${params.content}\n\n*${params.t('ai.aborted')}*`,
    thinkingContent: params.thinkingContent || undefined,
    reasoningDetails: params.reasoningDetails || undefined,
    discussionSteps: params.discussionSteps.length > 0 ? [...params.discussionSteps] : undefined,
  })
}

function normalizeTodoActions(todoActions: ProposedTodoChange[]): ProposedTodoChange[] {
  return todoActions.map((action) => ({
    ...action,
    id: action.id || generateId(),
  }))
}

function finalizeCompletedResponse(params: {
  aiConfig: AIConfig
  assistantMessageId: string
  currentAIResponse: Ref<string>
  currentThinkingContent: Ref<string>
  currentReasoningDetails: Ref<string>
  currentDiscussionSteps: Ref<DiscussionStep[]>
  currentTodoActions: Ref<ProposedTodoChange[]>
  sessions: Ref<ChatSession[]>
  generationSessionId: string | null
  addSessionMessage: (sessionId: string, message: ChatMessage) => void
  extractAndStoreMemories: (history: ChatMessage[]) => Promise<void> | void
  isMemoryEnabled: Ref<boolean>
  isGenerating: Ref<boolean>
  resetStreamingState: () => void
  todoStore: {
    setProposedChanges: (assistantMessageId: string, proposedActions: ProposedTodoChange[]) => void
  }
  t: (key: string, params?: Record<string, unknown>) => string
}) {
  const parsed = parseAssistantBlocks(params.currentAIResponse.value, {
    enableTodoActions: params.aiConfig.todoAssistant,
  })

  // 小说模式自动补章：从原始响应中统计已生成的章节数，扣减剩余计数
  if (novelBatchRemainingRef.value > 0) {
    const chapterMatches = params.currentAIResponse.value.match(/\[NOVEL_CHAPTER_START\]/g)
    const generatedCount = chapterMatches ? chapterMatches.length : 0
    novelBatchRemainingRef.value = Math.max(0, novelBatchRemainingRef.value - generatedCount)
  }

  const teachingQuizzes: TeachingQuiz[] | undefined =
    parsed.teachingQuizzes ||
    (params.aiConfig.assistantMode === 'teaching'
      ? buildTeachingFallbackQuiz(parsed.cleanText, params.assistantMessageId, params.t)
      : undefined)
  const teachingAssessments: TeachingAssessment[] | undefined = parsed.teachingAssessments
  const novelCharacters: NovelCharacterCard[] | undefined = parsed.novelCharacters
  const novelWorldview: NovelWorldviewSetting[] | undefined = parsed.novelWorldview
  const novelChapterMeta: NovelChapterMeta | undefined = parsed.novelChapterMeta

  params.currentAIResponse.value = parsed.cleanText
  if (params.aiConfig.todoAssistant && params.currentAIResponse.value) {
    params.currentAIResponse.value = stripTodoIdsFromText(params.currentAIResponse.value)
  }

  const proposedActions =
    params.aiConfig.todoAssistant && parsed.todoActions
      ? normalizeTodoActions(parsed.todoActions)
      : []
  if (proposedActions.length > 0) {
    params.currentTodoActions.value = proposedActions
    params.todoStore.setProposedChanges(params.assistantMessageId, proposedActions)
  }

  const structuredBlockErrors =
    parsed.errors.length > 0
      ? ([...parsed.errors] as ChatMessage['structuredBlockErrors'])
      : undefined
  const pendingStructuredBlocks =
    parsed.pendingStructuredBlocks.length > 0
      ? ([...parsed.pendingStructuredBlocks] as ChatMessage['pendingStructuredBlocks'])
      : undefined

  const assistantMessage = buildCompletedAssistantMessage({
    assistantMessageId: params.assistantMessageId,
    content: params.currentAIResponse.value,
    thinkingContent: params.currentThinkingContent.value,
    reasoningDetails: params.currentReasoningDetails.value,
    discussionSteps: params.currentDiscussionSteps.value,
    todoActions: params.currentTodoActions.value,
    teachingQuizzes,
    teachingAssessments,
    novelCharacters,
    novelWorldview,
    novelChapterMeta,
    structuredBlockErrors,
    pendingStructuredBlocks,
  })

  if (params.generationSessionId) {
    params.addSessionMessage(params.generationSessionId, assistantMessage)
  }

  if (params.isMemoryEnabled.value && params.generationSessionId) {
    const session = params.sessions.value.find((s) => s.id === params.generationSessionId)
    const newHistory = session?.messages ?? []
    void params.extractAndStoreMemories(newHistory)
  }

  params.resetStreamingState()
  params.isGenerating.value = false
}

function finalizeAbortedResponse(params: {
  assistantMessageId: string
  currentAIResponse: Ref<string>
  currentThinkingContent: Ref<string>
  currentReasoningDetails: Ref<string>
  currentDiscussionSteps: Ref<DiscussionStep[]>
  generationSessionId: string | null
  addSessionMessage: (sessionId: string, message: ChatMessage) => void
  resetStreamingState: () => void
  isGenerating: Ref<boolean>
  t: (key: string, params?: Record<string, unknown>) => string
}) {
  if (params.currentAIResponse.value && params.generationSessionId) {
    const assistantMessage = buildAbortedAssistantMessage({
      assistantMessageId: params.assistantMessageId,
      content: params.currentAIResponse.value,
      thinkingContent: params.currentThinkingContent.value,
      reasoningDetails: params.currentReasoningDetails.value,
      discussionSteps: params.currentDiscussionSteps.value,
      t: params.t,
    })
    params.addSessionMessage(params.generationSessionId, assistantMessage)
  }

  params.resetStreamingState()
  params.isGenerating.value = false
}

export function createStreamChunkHandler(params: {
  aiConfig: AIConfig
  assistantMessageId: string
  generationSessionId: string | null
  currentAIResponse: Ref<string>
  currentThinkingContent: Ref<string>
  currentReasoningDetails: Ref<string>
  currentDiscussionSteps: Ref<DiscussionStep[]>
  currentTodoActions: Ref<ProposedTodoChange[]>
  isGenerating: Ref<boolean>
  sessions: Ref<ChatSession[]>
  addSessionMessage: (sessionId: string, message: ChatMessage) => void
  extractAndStoreMemories: (history: ChatMessage[]) => Promise<void> | void
  isMemoryEnabled: Ref<boolean>
  resetStreamingState: () => void
  todoStore: {
    setProposedChanges: (assistantMessageId: string, proposedActions: ProposedTodoChange[]) => void
  }
  t: (key: string, params?: Record<string, unknown>) => string
}) {
  return (chunk: string) => {
    if (chunk === '[DONE]') {
      if (params.currentAIResponse.value) {
        finalizeCompletedResponse({
          aiConfig: params.aiConfig,
          assistantMessageId: params.assistantMessageId,
          currentAIResponse: params.currentAIResponse,
          currentThinkingContent: params.currentThinkingContent,
          currentReasoningDetails: params.currentReasoningDetails,
          currentDiscussionSteps: params.currentDiscussionSteps,
          currentTodoActions: params.currentTodoActions,
          sessions: params.sessions,
          generationSessionId: params.generationSessionId,
          addSessionMessage: params.addSessionMessage,
          extractAndStoreMemories: params.extractAndStoreMemories,
          isMemoryEnabled: params.isMemoryEnabled,
          isGenerating: params.isGenerating,
          resetStreamingState: params.resetStreamingState,
          todoStore: params.todoStore,
          t: params.t,
        })
      } else {
        params.resetStreamingState()
        params.isGenerating.value = false
      }
      return
    }

    if (chunk === '[ABORTED]') {
      finalizeAbortedResponse({
        assistantMessageId: params.assistantMessageId,
        currentAIResponse: params.currentAIResponse,
        currentThinkingContent: params.currentThinkingContent,
        currentReasoningDetails: params.currentReasoningDetails,
        currentDiscussionSteps: params.currentDiscussionSteps,
        generationSessionId: params.generationSessionId,
        addSessionMessage: params.addSessionMessage,
        resetStreamingState: params.resetStreamingState,
        isGenerating: params.isGenerating,
        t: params.t,
      })
      return
    }

    params.currentAIResponse.value += chunk
  }
}
