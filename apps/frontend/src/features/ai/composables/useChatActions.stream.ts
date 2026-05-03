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

export interface NovelPersistPayload {
  draftId: string
  chapter?: NovelChapterMeta
  characters?: NovelCharacterCard[]
  worldviews?: NovelWorldviewSetting[]
}

export interface TeachingAssessmentWithContext {
  quizId: string
  result: string
  mastery: string
  feedback: string
  nextFocus?: string
  stem: string
  kind: string
  userAnswer: string | string[]
}

export interface TeachingPersistPayload {
  assessments: TeachingAssessmentWithContext[]
}

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
  onNovelPersist?: (payload: NovelPersistPayload) => void | Promise<void>
  onTeachingPersist?: (payload: TeachingPersistPayload) => void | Promise<void>
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

  // 小说模式：自动持久化章节/角色/世界观
  if (
    params.aiConfig.assistantMode === 'novel' &&
    params.onNovelPersist &&
    (novelChapterMeta ||
      (novelCharacters && novelCharacters.length > 0) ||
      (novelWorldview && novelWorldview.length > 0))
  ) {
    const payload: NovelPersistPayload = { draftId: '' }
    // draftId 由调用方通过 onNovelPersist 闭包注入
    if (novelChapterMeta) payload.chapter = novelChapterMeta
    if (novelCharacters && novelCharacters.length > 0) payload.characters = novelCharacters
    if (novelWorldview && novelWorldview.length > 0) payload.worldviews = novelWorldview
    void params.onNovelPersist(payload)
  }

  // 教学模式：自动持久化评估记录与学习进度
  if (
    params.aiConfig.assistantMode === 'teaching' &&
    params.onTeachingPersist &&
    teachingAssessments &&
    teachingAssessments.length > 0 &&
    params.generationSessionId
  ) {
    const session = params.sessions.value.find((s) => s.id === params.generationSessionId)
    const messages = session?.messages ?? []
    const enriched: TeachingAssessmentWithContext[] = []

    for (const assessment of teachingAssessments) {
      // 从历史消息中提取原始测验数据（stem, kind）和用户答案
      let stem = ''
      let kind = 'short_answer'
      let userAnswer: string | string[] = ''

      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i]
        if (msg.role !== 'user') continue
        const content = msg.content

        // 尝试匹配 [TEACHING_ANSWERS] 批量格式
        const batchMatch = content.match(/^\[TEACHING_ANSWERS\]\s*\n(.+)$/s)
        if (batchMatch) {
          try {
            const batch = JSON.parse(batchMatch[1])
            if (Array.isArray(batch)) {
              for (const item of batch) {
                if (item.quizId === assessment.quizId || item.quiz?.id === assessment.quizId) {
                  stem = item.quiz?.stem || ''
                  kind = item.kind || item.quiz?.kind || 'short_answer'
                  userAnswer = item.answer || ''
                }
              }
            }
          } catch {
            /* 格式不合法，跳过 */
          }
          break
        }

        // 尝试匹配 [TEACHING_ANSWER] 单题格式
        const singleMatch = content.match(/^\[TEACHING_ANSWER\]\s*\n(.+)$/s)
        if (singleMatch) {
          try {
            const item = JSON.parse(singleMatch[1])
            if (item.quizId === assessment.quizId || item.quiz?.id === assessment.quizId) {
              stem = item.quiz?.stem || ''
              kind = item.kind || item.quiz?.kind || 'short_answer'
              userAnswer = item.answer || ''
            }
          } catch {
            /* 格式不合法，跳过 */
          }
          break
        }
      }

      enriched.push({
        quizId: assessment.quizId,
        result: assessment.result,
        mastery: assessment.mastery,
        feedback: assessment.feedback,
        nextFocus: assessment.nextFocus,
        stem,
        kind,
        userAnswer,
      })
    }

    if (enriched.length > 0) {
      void params.onTeachingPersist({ assessments: enriched })
    }
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
  onNovelPersist?: (payload: NovelPersistPayload) => void | Promise<void>
  onTeachingPersist?: (payload: TeachingPersistPayload) => void | Promise<void>
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
          onNovelPersist: params.onNovelPersist,
          onTeachingPersist: params.onTeachingPersist,
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
