import { computed } from 'vue'
import type { AIRequestOptions, ChatMessage, TeachingQuiz } from '@/features/ai/services/aiService'
import type { ProposedTodoChange } from '@/features/todo/stores/todo'
import { parseAssistantBlocks } from '@/features/ai/services/aiService'
import { getAIConfig } from '@/features/ai/composables/useAIConfig'
import { useTodoStore } from '@/features/todo/stores/todo'
import { useChatState } from './useChatState'
import { useChatActions } from './useChatActions'

export type { ChatMessage }

/**
 * 聊天功能聚合 composable
 * 负责协调状态管理、动作执行与记忆提取
 */
export function useChat(options: AIRequestOptions = {}) {
  const state = useChatState()
  const actions = useChatActions(options)
  const todoStore = useTodoStore()

  const {
    chatHistory,
    currentAIResponse,
    currentThinkingContent,
    currentReasoningDetails,
    currentDiscussionSteps,
    currentTodoActions,
    currentAssistantMessageId,
    isGenerating,
  } = state

  /**
   * 合并的消息列表（包含流式响应的实时解析）
   */
  const messages = computed(() => {
    const allMessages = [...chatHistory.value]

    if (isGenerating.value) {
      const lastMessage = allMessages[allMessages.length - 1]
      const streamingId = currentAssistantMessageId.value || 'streaming-response'

      // 避免在流式结束瞬间产生重复
      if (!lastMessage || lastMessage.id !== streamingId) {
        const aiConfig = getAIConfig()
        const parsed = parseAssistantBlocks(currentAIResponse.value, {
          enableTodoActions: aiConfig.todoAssistant,
        })
        const displayContent = parsed.cleanText
        const actions: ProposedTodoChange[] | undefined = parsed.todoActions
        const teachingQuizzes: TeachingQuiz[] | undefined = parsed.teachingQuizzes
        const structuredBlockErrors = parsed.errors.length > 0 ? [...parsed.errors] : undefined
        const pendingStructuredBlocks =
          parsed.pendingStructuredBlocks.length > 0
            ? [...parsed.pendingStructuredBlocks]
            : undefined

        allMessages.push({
          id: streamingId,
          role: 'assistant',
          content: displayContent,
          thinkingContent: currentThinkingContent.value,
          reasoning_details: currentReasoningDetails.value || undefined,
          discussionSteps:
            currentDiscussionSteps.value.length > 0 ? [...currentDiscussionSteps.value] : undefined,
          todoActions: aiConfig.todoAssistant
            ? actions ||
              (currentTodoActions.value.length > 0 ? [...currentTodoActions.value] : undefined)
            : undefined,
          teachingQuizzes,
          structuredBlockErrors,
          pendingStructuredBlocks,
          isStreaming: true,
        })
      }
    }

    return allMessages
  })

  function deleteMessage(id: string) {
    const history = [...chatHistory.value]
    const index = history.findIndex((m) => m.id === id)
    if (index === -1) return

    // 如果是 AI 消息，尝试删除它前面的用户消息
    if (history[index].role === 'assistant') {
      todoStore.clearProposedChanges(id)
      if (index > 0 && history[index - 1].role === 'user') {
        // 删除用户消息和 AI 消息
        history.splice(index - 1, 2)
      } else {
        // 只删除 AI 消息
        history.splice(index, 1)
      }
    } else {
      history.splice(index, 1)
    }

    chatHistory.value = history
  }

  return {
    // 状态 (直接暴露 state 中的响应式引用)
    ...state,
    messages,

    // 动作
    ...actions,
    deleteMessage,
  }
}
