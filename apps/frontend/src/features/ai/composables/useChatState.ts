import { ref, computed, watch } from 'vue'
import type { Ref } from 'vue'
import { useChatHistory } from './useChatHistory'
import { useGenerationState } from '@/features/ai/stores/generationState'
import type { ChatMessage, DiscussionStep } from '@/features/ai/services/aiService'
import type { ProposedTodoChange } from '@/features/todo/stores/todo'

interface StreamBuffer {
  response: Ref<string>
  thinking: Ref<string>
  reasoning: Ref<string>
  discussionSteps: Ref<DiscussionStep[]>
  todoActions: Ref<ProposedTodoChange[]>
  assistantMessageId: Ref<string | null>
}

// 全局单例状态（当前会话的流式缓冲区视图）
const currentAIResponse = ref('')
const currentThinkingContent = ref('')
const currentReasoningDetails = ref('')
const currentDiscussionSteps = ref<DiscussionStep[]>([])
const currentTodoActions = ref<ProposedTodoChange[]>([])
const currentAssistantMessageId = ref<string | null>(null)

// 每会话独立的流式缓冲区
const sessionBuffers = new Map<string, StreamBuffer>()

function getOrCreateBuffer(sessionId: string): StreamBuffer {
  let buf = sessionBuffers.get(sessionId)
  if (!buf) {
    buf = {
      response: ref(''),
      thinking: ref(''),
      reasoning: ref(''),
      discussionSteps: ref<DiscussionStep[]>([]),
      todoActions: ref<ProposedTodoChange[]>([]),
      assistantMessageId: ref<string | null>(null),
    }
    sessionBuffers.set(sessionId, buf)
  }
  return buf
}

/** 获取指定会话的流式缓冲区（用于写入操作） */
export function getStreamBuffer(sessionId: string): StreamBuffer {
  return getOrCreateBuffer(sessionId)
}

/** 清理指定会话的缓冲区 */
export function clearStreamBuffer(sessionId: string) {
  const buf = sessionBuffers.get(sessionId)
  if (buf) {
    buf.response.value = ''
    buf.thinking.value = ''
    buf.reasoning.value = ''
    buf.discussionSteps.value = []
    buf.todoActions.value = []
    buf.assistantMessageId.value = null
  }
  sessionBuffers.delete(sessionId)
}

// 小说模式批量章节剩余计数（自动补章）
export const novelBatchRemaining = ref(0)

// 加载/错误状态（仍然全局共享 — 这些是 UI 级概念）
const isLoading = ref(false)
const error = ref<string | null>(null)
const retryCount = ref(0)

/**
 * 仅供测试使用：重置所有全局状态
 */
export function _resetChatState() {
  currentAIResponse.value = ''
  currentThinkingContent.value = ''
  currentReasoningDetails.value = ''
  currentDiscussionSteps.value = []
  currentTodoActions.value = []
  currentAssistantMessageId.value = null
  novelBatchRemaining.value = 0
  isLoading.value = false
  error.value = null
  retryCount.value = 0
  sessionBuffers.clear()
  const { activeIds } = useGenerationState()
  activeIds.value = new Set()
}

/**
 * 聊天状态管理 composable
 */
export function useChatState() {
  const { currentSession, getOrCreateCurrentSession, updateSessionMessages, currentSessionId } =
    useChatHistory()
  const { activeIds } = useGenerationState()

  // 聊天历史（从当前会话获取）
  const chatHistory = computed({
    get: () => currentSession.value?.messages ?? [],
    set: (messages: ChatMessage[]) => {
      const session = getOrCreateCurrentSession()
      updateSessionMessages(session.id, messages, true)
    },
  })

  // 当前会话是否正在生成
  const isGenerating = computed(
    () => currentSessionId.value !== null && activeIds.value.has(currentSessionId.value),
  )

  // 仅在切换会话时清除错误状态，避免流式 chunk 更新把错误提示抹掉
  watch(currentSessionId, () => {
    clearError()
  })

  // 监听当前会话与其流式缓冲区变化，保持 UI 展示状态与 buffer 实时同步
  watch(
    () => {
      const activeSessionId = currentSessionId.value
      if (!activeSessionId) return null
      const buf = getOrCreateBuffer(activeSessionId)
      return [
        activeSessionId,
        buf.response.value,
        buf.thinking.value,
        buf.reasoning.value,
        buf.discussionSteps.value,
        buf.todoActions.value,
        buf.assistantMessageId.value,
      ] as const
    },
    (payload) => {
      if (!payload) {
        currentAIResponse.value = ''
        currentThinkingContent.value = ''
        currentReasoningDetails.value = ''
        currentDiscussionSteps.value = []
        currentTodoActions.value = []
        currentAssistantMessageId.value = null
        return
      }

      const [, response, thinking, reasoning, discussionSteps, todoActions, assistantMessageId] =
        payload
      currentAIResponse.value = response
      currentThinkingContent.value = thinking
      currentReasoningDetails.value = reasoning
      currentDiscussionSteps.value = discussionSteps
      currentTodoActions.value = todoActions
      currentAssistantMessageId.value = assistantMessageId
    },
    { immediate: true },
  )

  /**
   * 重置流式响应状态。sessionId 为空时重置当前会话
   */
  function resetStreamingState(sessionId?: string) {
    // 清除指定（或当前）会话的 per-session buffer
    const targetId = sessionId || currentSessionId.value
    if (targetId) {
      const buf = sessionBuffers.get(targetId)
      if (buf) {
        buf.response.value = ''
        buf.thinking.value = ''
        buf.reasoning.value = ''
        buf.discussionSteps.value = []
        buf.todoActions.value = []
        buf.assistantMessageId.value = null
      }
    }
    // 仅当是当前会话时清除全局视图，避免误清其他会话的数据
    if (!sessionId || sessionId === currentSessionId.value) {
      currentAIResponse.value = ''
      currentThinkingContent.value = ''
      currentReasoningDetails.value = ''
      currentDiscussionSteps.value = []
      currentTodoActions.value = []
      currentAssistantMessageId.value = null
    }
  }

  /**
   * 清除错误状态
   */
  function clearError() {
    error.value = null
  }

  /**
   * 更新教学模式问答的用户答案
   */
  function updateTeachingQuizAnswer(quizId: string, answer: string | string[]) {
    if (!chatHistory.value.length) return
    const messages = [...chatHistory.value]
    let updated = false
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i]
      if (msg.teachingQuizzes) {
        const quiz = msg.teachingQuizzes.find((q) => q.id === quizId)
        if (quiz) {
          quiz.userAnswer = answer
          updated = true
          break
        }
      }
    }
    if (updated) chatHistory.value = messages
  }

  function getTeachingQuizSnapshot(quizId: string) {
    const messages = chatHistory.value
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i]
      const quiz = msg.teachingQuizzes?.find((q) => q.id === quizId)
      if (!quiz) continue
      return {
        id: quiz.id,
        kind: quiz.kind,
        stem: quiz.stem,
        options: quiz.options,
        answerHint: quiz.answerHint,
      }
    }
    return null
  }

  return {
    chatHistory,
    currentAIResponse,
    currentThinkingContent,
    currentReasoningDetails,
    currentDiscussionSteps,
    currentTodoActions,
    currentAssistantMessageId,
    isGenerating,
    isLoading,
    error,
    retryCount,
    resetStreamingState,
    clearError,
    updateTeachingQuizAnswer,
    getTeachingQuizSnapshot,
    novelBatchRemaining,
  }
}
