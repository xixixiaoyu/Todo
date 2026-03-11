import { ref, computed, watch } from 'vue'
import { useChatHistory } from './useChatHistory'
import type { ChatMessage, DiscussionStep } from '@/features/ai/services/aiService'
import type { ProposedTodoChange } from '@/features/todo/stores/todo'

// 全局单例状态，确保多处调用共享同一状态
const currentAIResponse = ref('')
const currentThinkingContent = ref('')
const currentReasoningDetails = ref('')
const currentDiscussionSteps = ref<DiscussionStep[]>([])
const currentTodoActions = ref<ProposedTodoChange[]>([])
const currentAssistantMessageId = ref<string | null>(null)

// 加载/生成状态
const isGenerating = ref(false)
const isLoading = ref(false)
const error = ref<string | null>(null)

// 重试计数
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
  isGenerating.value = false
  isLoading.value = false
  error.value = null
  retryCount.value = 0
}

/**
 * 聊天状态管理 composable
 */
export function useChatState() {
  const { currentSession, getOrCreateCurrentSession, updateSessionMessages } = useChatHistory()

  // 聊天历史（从当前会话获取）
  const chatHistory = computed({
    get: () => currentSession.value?.messages ?? [],
    set: (messages: ChatMessage[]) => {
      const session = getOrCreateCurrentSession()
      updateSessionMessages(session.id, messages)
    },
  })

  // 监听当前会话变化，重置流式状态
  const { currentSessionId } = useChatHistory()
  watch(currentSessionId, () => {
    resetStreamingState()
    clearError()
  })

  /**
   * 重置流式响应状态
   */
  function resetStreamingState() {
    currentAIResponse.value = ''
    currentThinkingContent.value = ''
    currentReasoningDetails.value = ''
    currentDiscussionSteps.value = []
    currentTodoActions.value = []
    currentAssistantMessageId.value = null
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

    // 深拷贝以确保触发更新
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

    if (updated) {
      chatHistory.value = messages
    }
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
    // 状态
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

    // 方法
    resetStreamingState,
    clearError,
    updateTeachingQuizAnswer,
    getTeachingQuizSnapshot,
  }
}
