import { computed } from 'vue'
import type {
  AIRequestOptions,
  ChatMessage,
  TeachingAssessment,
  TeachingQuiz,
  NovelCharacterCard,
  NovelWorldviewSetting,
  NovelChapterMeta,
} from '@/features/ai/services/aiService'
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

    // 检查是否需要显示流式消息
    // 条件：正在生成中，或者有未保存的响应内容（正文、思考内容、推理详情、讨论步骤）
    // 注意：hasUnsavedResponse 分支处理流式完成后的短暂窗口：
    //   - finalizeCompletedResponse 执行顺序为 addSessionMessage → resetStreamingState → isGenerating
    //     （小说模式自动补章时 isGenerating 保持 true，其余场景设为 false）
    //   - Vue 响应式更新时序可能导致 chatHistory 已更新但 currentAIResponse 尚未清空
    //   - 此分支确保在状态完全同步前，用户仍能看到响应内容
    const streamingId = currentAssistantMessageId.value || 'streaming-response'
    const hasUnsavedResponse = !!(
      currentAIResponse.value ||
      currentThinkingContent.value ||
      currentReasoningDetails.value ||
      currentDiscussionSteps.value.length > 0
    )

    if (isGenerating.value || hasUnsavedResponse) {
      const lastMessage = allMessages[allMessages.length - 1]
      const isCurrentStreamingMessage =
        !!lastMessage && lastMessage.id === streamingId && lastMessage.role === 'assistant'

      // 避免在流式结束瞬间产生重复
      // 检查：最后一条消息不是当前流式消息，且当前正在生成或有未保存的内容需要显示
      if (!isCurrentStreamingMessage && (isGenerating.value || hasUnsavedResponse)) {
        const aiConfig = getAIConfig()
        const parsed = parseAssistantBlocks(currentAIResponse.value, {
          enableTodoActions: aiConfig.todoAssistant,
        })
        const displayContent = parsed.cleanText
        const actions: ProposedTodoChange[] | undefined = parsed.todoActions
        const teachingQuizzes: TeachingQuiz[] | undefined = parsed.teachingQuizzes
        const teachingAssessments: TeachingAssessment[] | undefined = parsed.teachingAssessments
        const novelCharacters: NovelCharacterCard[] | undefined = parsed.novelCharacters
        const novelWorldview: NovelWorldviewSetting[] | undefined = parsed.novelWorldview
        const novelChapterMeta: NovelChapterMeta | undefined = parsed.novelChapterMeta
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
          teachingAssessments,
          novelCharacters,
          novelWorldview,
          novelChapterMeta,
          structuredBlockErrors,
          pendingStructuredBlocks,
          isStreaming: isGenerating.value,
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
