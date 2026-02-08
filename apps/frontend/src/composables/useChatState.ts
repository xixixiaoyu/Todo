import { ref, computed } from 'vue'
import { useChatHistory } from './useChatHistory'
import type { ChatMessage, DiscussionStep } from '@/services/aiService'
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
  }
}
