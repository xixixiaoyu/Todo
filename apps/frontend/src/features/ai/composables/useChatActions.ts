import i18n from '@/i18n'
import {
  getAIStreamResponse,
  getMultiModelDiscussionStream,
  getAIImageResponse,
  getSessionAbortSignal,
  abortSessionRequest,
  generateId,
} from '@/features/ai/services/aiService'
import type { ChatMessage, AIRequestOptions, ToolCall } from '@/features/ai/services/aiService'
import { useChatState, novelBatchRemaining, getStreamBuffer } from './useChatState'
import { useChatMemory } from './useChatMemory'
import { useChatHistory } from './useChatHistory'
import { getAIThinkingLevel, getAIConfig, getAISkills } from './useAIConfig'
import { useTodoStore } from '@/features/todo/stores/todo'
import { createContextCompression } from './useChatActions.contextCompression'
import { executeToolCalls } from './useChatActions.toolCalls'
import { useToolPermission } from './useToolPermission'
import { useGenerationState } from '@/features/ai/stores/generationState'
import { createStreamChunkHandler } from './useChatActions.stream'
import type { TeachingPersistPayload } from './useChatActions.stream'
import { prepareRuntimeCapabilities } from './useChatActions.runtime'
import { resolveSkillContext } from '@/features/ai/services/aiService'
import { httpClient } from '@/api'
import { useSidecar } from '@/composables/useSidecar'
import { useQueryClient } from '@tanstack/vue-query'

const MAX_RETRIES = 3

/**
 * Agent 工具调用最大迭代轮数。
 * 从 5 提升到 50 以支持复杂多步任务（如多文件重构、跨目录搜索）。
 * 每轮涉及一次 LLM API 往返（约 3-5s），最坏情况耗时约 4 分钟。
 * 后续可考虑做成用户可配置项。
 */
const MAX_TOOL_ITERATIONS = 50

/**
 * 聊天动作逻辑 composable
 */
export function useChatActions(options: AIRequestOptions = {}) {
  const t = i18n.global.t
  const {
    chatHistory,
    currentAIResponse,
    currentDiscussionSteps,
    currentAssistantMessageId,
    isGenerating,
    error,
    retryCount,
    resetStreamingState,
    clearError,
  } = useChatState()

  const { extractAndStoreMemories, isMemoryEnabled } = useChatMemory()
  const {
    sessions,
    createSession,
    currentSession,
    currentSessionId,
    addSessionMessage,
    getOrCreateCurrentSession,
    updateSessionContextSummary,
    clearSessionContextSummary,
  } = useChatHistory()
  const todoStore = useTodoStore()
  const { isAvailable: sidecarAvailable, sidecarPort, sidecarToken } = useSidecar()
  const { mode: permissionMode } = useToolPermission()
  const { startGenerating: markGenerating, stopGenerating: markDone } = useGenerationState()

  // 惰性获取 queryClient：避免在无 Vue 注入上下文的测试环境中崩溃
  let queryClient: ReturnType<typeof useQueryClient> | null = null
  try {
    queryClient = useQueryClient()
  } catch {
    // 非 Vue setup 上下文（如测试），跳过
  }

  // 教学模式：AI 评估后自动持久化测验记录与学习进度
  async function onTeachingPersist(payload: TeachingPersistPayload) {
    const persistTasks: Promise<unknown>[] = []

    for (const a of payload.assessments) {
      persistTasks.push(
        httpClient
          .post('/teaching/quizzes', {
            quizId: a.quizId,
            stem: a.stem,
            kind: a.kind,
            userAnswer: a.userAnswer,
            result: a.result,
            mastery: a.mastery,
            feedback: a.feedback,
            nextFocus: a.nextFocus,
          })
          .catch((e) => console.warn('[TeachingPersist] quiz record save failed:', e)),
      )

      // 同时更新学习进度：从 stem 中提取概念名（取前两个词或截断）
      const concept = a.stem ? a.stem.slice(0, 40) : a.quizId
      const correctCount = a.result === 'correct' ? 1 : 0
      persistTasks.push(
        httpClient
          .put('/teaching/progress', {
            concept,
            masteryLevel: a.mastery,
            quizCount: 1,
            correctCount,
          })
          .catch((e) => console.warn('[TeachingPersist] progress update failed:', e)),
      )
    }

    await Promise.allSettled(persistTasks)
    if (queryClient) {
      void queryClient.invalidateQueries({ queryKey: ['teaching', 'quizzes'] })
      void queryClient.invalidateQueries({ queryKey: ['teaching', 'progress'] })
      void queryClient.invalidateQueries({ queryKey: ['teaching', 'overview'] })
    }
  }

  const { buildContextCompression } = createContextCompression({
    currentSession,
    updateSessionContextSummary,
    clearSessionContextSummary,
  })

  /**
   * 生成 AI 图片
   */
  async function generateImage(prompt: string, images?: string[]): Promise<void> {
    if (!prompt.trim() || isGenerating.value) return

    clearError()
    const generationSessionId = currentSessionId.value || getOrCreateCurrentSession().id
    markGenerating(generationSessionId)

    // 创建用户消息
    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: prompt,
      images,
      createdAt: new Date(),
    }

    // 立即更新到当前会话
    chatHistory.value = [...chatHistory.value, userMessage]

    const buffer = getStreamBuffer(generationSessionId)
    currentAssistantMessageId.value = generateId()
    buffer.assistantMessageId.value = currentAssistantMessageId.value
    currentAIResponse.value = t('ai.generatingImage')
    buffer.response.value = currentAIResponse.value

    try {
      const aiConfig = getAIConfig()
      const imageUrls = await getAIImageResponse(prompt, images, {
        model: aiConfig.model,
        baseUrl: aiConfig.baseUrl,
        apiKey: aiConfig.apiKey,
      })

      if (imageUrls.length > 0) {
        const aiMessage: ChatMessage = {
          id: currentAssistantMessageId.value!,
          role: 'assistant',
          content: t('ai.imageGenerated'),
          images: imageUrls,
          createdAt: new Date(),
        }

        // 使用捕获的会话 ID 进行更新
        if (generationSessionId) {
          addSessionMessage(generationSessionId, aiMessage, true)
        }
      } else {
        throw new Error(t('ai.noImageGenerated'))
      }
    } catch (err) {
      let errorMessage = err instanceof Error ? err.message : String(err)
      if (
        errorMessage.toLowerCase().includes('modalities') ||
        errorMessage.toLowerCase().includes('not support') ||
        errorMessage.includes('400')
      ) {
        errorMessage = t('ai.noImageGenerated')
      }
      error.value = errorMessage
    } finally {
      markDone(generationSessionId)
      currentAssistantMessageId.value = null
      buffer.assistantMessageId.value = null
      buffer.response.value = ''
    }
  }

  /**
   * 发送消息
   */
  async function sendMessage(
    content: string,
    images?: string[],
    documents?: { name: string; content: string }[],
    isRetry = false,
    iteration = 0,
  ): Promise<void> {
    const isToolIteration =
      isRetry &&
      chatHistory.value.length > 0 &&
      chatHistory.value[chatHistory.value.length - 1].role === 'tool'

    if (
      (!content.trim() &&
        (!images || images.length === 0) &&
        (!documents || documents.length === 0) &&
        !isToolIteration) ||
      (isGenerating.value && !isToolIteration)
    )
      return

    if (iteration >= MAX_TOOL_ITERATIONS) {
      console.warn('Max iterations reached, stopping tool loop.')
      chatHistory.value = [
        ...chatHistory.value,
        {
          id: generateId(),
          role: 'assistant',
          content: t('ai.maxToolIterationsReached', { count: MAX_TOOL_ITERATIONS }),
          createdAt: new Date(),
        },
      ]
      return
    }

    const aiConfig = getAIConfig()

    if (aiConfig.enableImageGeneration) {
      return generateImage(content.trim(), images)
    }

    clearError()
    resetStreamingState()
    const generationSessionId = currentSessionId.value || getOrCreateCurrentSession().id

    // 标记此会话正在生成中
    markGenerating(generationSessionId)

    // 获取该会话的独立流式缓冲区
    const buffer = getStreamBuffer(generationSessionId)

    if (!isRetry) {
      retryCount.value = 0
      const userMessage: ChatMessage = {
        id: generateId(),
        role: 'user',
        content: content.trim(),
        images: images,
        documents: documents,
        createdAt: new Date(),
      }

      // 立即更新到当前会话
      chatHistory.value = [...chatHistory.value, userMessage]
    }

    markGenerating(generationSessionId)
    const assistantMessageId = generateId()
    currentAssistantMessageId.value = assistantMessageId
    buffer.assistantMessageId.value = assistantMessageId

    try {
      const handleChunk = createStreamChunkHandler({
        aiConfig,
        assistantMessageId,
        generationSessionId,
        currentAIResponse: buffer.response,
        currentThinkingContent: buffer.thinking,
        currentReasoningDetails: buffer.reasoning,
        currentDiscussionSteps: buffer.discussionSteps,
        currentTodoActions: buffer.todoActions,
        onStreamDone: () => markDone(generationSessionId),
        sessions,
        addSessionMessage,
        extractAndStoreMemories,
        isMemoryEnabled,
        resetStreamingState,
        todoStore,
        t,
        onTeachingPersist,
      })

      if (aiConfig.discussionMode && aiConfig.discussionModelIds.length > 0) {
        const { messagesForRequest, contextSummary } = await buildContextCompression(
          chatHistory.value,
        )
        const skillContext = resolveSkillContext({
          messages: messagesForRequest,
          skillLibrary: getAISkills(),
          selectedSkillIds: aiConfig.skillIds,
          autoActivateSelected: true,
        })
        const {
          mcpApi,
          aiTools,
          mcpToolLookup,
          localToolHandlers,
          skillRuntimeAvailability,
          agentToolsEnabled,
        } = await prepareRuntimeCapabilities({
          aiConfig,
          getAuthToken: () => null,
          hydrateAuth: () => {},
          skillContext,
          sidecarState: {
            port: sidecarPort.value,
            token: sidecarToken.value,
            isAvailable: sidecarAvailable.value,
          },
          sessionId: generationSessionId,
        })
        const toolCalls: ToolCall[] = []
        let assistantThinking = ''
        let assistantReasoningDetails = ''
        let latestDiscussionSteps = [...currentDiscussionSteps.value]

        await getMultiModelDiscussionStream(
          messagesForRequest,
          (steps) => {
            latestDiscussionSteps = [...steps]
            currentDiscussionSteps.value = steps
          },
          handleChunk,
          (thinking: string) => {
            assistantThinking += thinking
            buffer.thinking.value += thinking
          },
          (details: string) => {
            assistantReasoningDetails += details
            buffer.reasoning.value += details
          },
          {
            ...options,
            thinkingMode: getAIThinkingLevel(),
            contextSummary,
            tools: aiTools.length > 0 ? aiTools : undefined,
            skills: skillContext.catalogSkills,
            activeSkills: skillContext.activatedSkills,
            skillRuntimeAvailability,
            agentToolsEnabled,
            agentWorkspacePath: aiConfig.agentWorkspacePath,
            abortSignal: getSessionAbortSignal(generationSessionId),
          },
          (toolCall) => {
            toolCalls.push(toolCall)
          },
        )

        if (toolCalls.length > 0) {
          markGenerating(generationSessionId)
          await executeToolCalls({
            assistantMessageId,
            toolCalls,
            assistantThinkingContent: assistantThinking || undefined,
            assistantReasoningDetails: assistantReasoningDetails || undefined,
            discussionSteps: latestDiscussionSteps.length > 0 ? latestDiscussionSteps : undefined,
            chatHistory,
            mcpToolLookup,
            callMcpTool: mcpApi.callTool,
            localToolHandlers,
            permissionMode: permissionMode.value,
            onPermissionAsk: async (name) => {
              return window.confirm(`Allow execution?\n\n${name}`) ? 'allow' : 'deny'
            },
          })
          return sendMessage('', undefined, undefined, true, iteration + 1)
        }

        // 小说模式自动补章：若仍有剩余章节，自动发送"继续"
        if (novelBatchRemaining.value > 0) {
          return sendMessage(t('ai.novelContinueHint'))
        }
      } else {
        const { messagesForRequest, contextSummary } = await buildContextCompression(
          chatHistory.value,
        )
        const skillContext = resolveSkillContext({
          messages: messagesForRequest,
          skillLibrary: getAISkills(),
          selectedSkillIds: aiConfig.skillIds,
          autoActivateSelected: true,
        })
        const {
          mcpApi,
          aiTools,
          mcpToolLookup,
          localToolHandlers,
          activeSkillsForPrompt,
          skillRuntimeAvailability,
          agentToolsEnabled,
        } = await prepareRuntimeCapabilities({
          aiConfig,
          getAuthToken: () => null,
          hydrateAuth: () => {},
          skillContext,
          sidecarState: {
            port: sidecarPort.value,
            token: sidecarToken.value,
            isAvailable: sidecarAvailable.value,
          },
          sessionId: generationSessionId,
        })

        const toolCalls: ToolCall[] = []
        let assistantThinking = ''
        let assistantReasoningDetails = ''

        await getAIStreamResponse(
          messagesForRequest,
          handleChunk,
          (thinking: string) => {
            assistantThinking += thinking
            buffer.thinking.value += thinking
          },
          (details: string) => {
            assistantReasoningDetails += details
            buffer.reasoning.value += details
          },
          {
            ...options,
            thinkingMode: getAIThinkingLevel(),
            tools: aiTools.length > 0 ? aiTools : undefined,
            contextSummary,
            skills: skillContext.catalogSkills,
            activeSkills: activeSkillsForPrompt,
            skillRuntimeAvailability,
            agentToolsEnabled,
            agentWorkspacePath: aiConfig.agentWorkspacePath,
            abortSignal: getSessionAbortSignal(generationSessionId),
          },
          (toolCall) => {
            toolCalls.push(toolCall)
          },
        )

        if (toolCalls.length > 0) {
          markGenerating(generationSessionId)
          await executeToolCalls({
            assistantMessageId,
            toolCalls,
            assistantThinkingContent: assistantThinking || undefined,
            assistantReasoningDetails: assistantReasoningDetails || undefined,
            chatHistory,
            mcpToolLookup,
            callMcpTool: mcpApi.callTool,
            localToolHandlers,
            permissionMode: permissionMode.value,
            onPermissionAsk: async (name) => {
              return window.confirm(`Allow execution?\n\n${name}`) ? 'allow' : 'deny'
            },
          })
          return sendMessage('', undefined, undefined, true, iteration + 1)
        }

        // 小说模式自动补章：若仍有剩余章节，自动发送"继续"
        if (novelBatchRemaining.value > 0) {
          return sendMessage(t('ai.novelContinueHint'))
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('ai.requestFailed')
      error.value = errorMessage

      if (retryCount.value < MAX_RETRIES) {
        retryCount.value++
        console.warn(`Retrying ${retryCount.value}/${MAX_RETRIES}...`)
        markDone(generationSessionId)
        await sendMessage(content, images, documents, true)
      } else {
        markDone(generationSessionId)
        resetStreamingState()
      }
    }
  }

  function stopGenerating(): void {
    if (currentSessionId.value) {
      abortSessionRequest(currentSessionId.value)
      markDone(currentSessionId.value)
    }
  }

  function clearHistory(): void {
    createSession()
    todoStore.clearProposedChanges()
    resetStreamingState()
    clearError()
  }

  function deleteMessage(messageId: string): void {
    chatHistory.value = chatHistory.value.filter((msg) => msg.id !== messageId)
  }

  async function regenerateMessage(messageId: string): Promise<void> {
    if (isGenerating.value) return
    const index = chatHistory.value.findIndex((msg) => msg.id === messageId)
    if (index === -1) return

    let lastUserMsgIndex = -1
    for (let i = index - 1; i >= 0; i--) {
      if (chatHistory.value[i].role === 'user') {
        lastUserMsgIndex = i
        break
      }
    }

    if (lastUserMsgIndex === -1) return

    const userMsg = chatHistory.value[lastUserMsgIndex]
    const userContent = userMsg.content
    const userImages = userMsg.images
    const userDocuments = userMsg.documents

    const newHistory = chatHistory.value.slice(0, lastUserMsgIndex + 1)
    chatHistory.value = newHistory

    await sendMessage(userContent, userImages, userDocuments, true)
  }

  async function regenerateLastResponse(): Promise<void> {
    if (isGenerating.value || chatHistory.value.length === 0) return
    const lastAIMsg = [...chatHistory.value].reverse().find((m) => m.role === 'assistant')
    if (lastAIMsg) {
      return regenerateMessage(lastAIMsg.id)
    }
    const lastMsg = chatHistory.value[chatHistory.value.length - 1]
    if (lastMsg.role === 'user') {
      await sendMessage(lastMsg.content, lastMsg.images, lastMsg.documents, true)
    }
  }

  async function editAndResendMessage(
    messageId: string,
    newContent: string,
    newImages?: string[],
    newDocuments?: { name: string; content: string }[],
  ): Promise<void> {
    if (
      isGenerating.value ||
      (!newContent.trim() &&
        (!newImages || newImages.length === 0) &&
        (!newDocuments || newDocuments.length === 0))
    )
      return

    const index = chatHistory.value.findIndex((msg) => msg.id === messageId)
    if (index === -1) return

    const imagesToUse = newImages !== undefined ? newImages : chatHistory.value[index].images
    const documentsToUse =
      newDocuments !== undefined ? newDocuments : chatHistory.value[index].documents

    const newHistory = chatHistory.value.slice(0, index)
    chatHistory.value = newHistory

    await sendMessage(newContent, imagesToUse, documentsToUse)
  }

  /**
   * 手动添加一对消息（用户和助手）到历史记录
   */
  function addMessagePair(
    userContent: string,
    assistantContent: string,
    assistantThinking?: string,
  ) {
    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: userContent,
      createdAt: new Date(),
    }

    const assistantMessage: ChatMessage = {
      id: generateId(),
      role: 'assistant',
      content: assistantContent,
      thinkingContent: assistantThinking,
      createdAt: new Date(),
    }

    chatHistory.value = [...chatHistory.value, userMessage, assistantMessage]
  }

  return {
    sendMessage,
    generateImage,
    stopGenerating,
    clearHistory,
    deleteMessage,
    regenerateMessage,
    regenerateLastResponse,
    editAndResendMessage,
    addMessagePair,
  }
}
