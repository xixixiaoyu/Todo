import i18n from '@/i18n'
import {
  getAIStreamResponse,
  getMultiModelDiscussionStream,
  getAIImageResponse,
  abortCurrentRequest,
  generateId,
  parseAssistantBlocks,
  type ChatMessage,
  type TeachingQuiz,
  type AIRequestOptions,
  type ToolCall,
} from '@/features/ai/services/aiService'
import { useChatState } from './useChatState'
import { useChatMemory } from './useChatMemory'
import { useChatHistory } from './useChatHistory'
import { getAIThinkingMode, getAIConfig } from './useAIConfig'
import { useTodoStore, type ProposedTodoChange } from '@/features/todo/stores/todo'
import { useAuthStore } from '@/features/auth/stores/auth'
import type { McpToolResponse } from '@/features/mcp/api/mcp'
import { createContextCompression } from './useChatActions.contextCompression'
import { buildAiToolsFromMcpTools } from './useChatActions.mcpTools'
import { executeToolCalls } from './useChatActions.toolCalls'

const MAX_RETRIES = 3

function stripTodoIdsFromText(input: string): string {
  const uuid = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'
  const tempId = 'temp-[A-Za-z0-9_-]+'

  let out = input
  out = out.replace(
    new RegExp(`^\\s*(?:ID|Id|id)\\s*[:：]\\s*(?:${uuid}|${tempId})\\s*$`, 'gm'),
    '',
  )
  out = out.replace(
    new RegExp(`\\s*[（(]\\s*(?:ID|Id|id)\\s*[:：]\\s*(?:${uuid}|${tempId})\\s*[)）]\\s*`, 'g'),
    ' ',
  )
  out = out.replace(new RegExp(`\\b(?:ID|Id|id)\\s*[:：]\\s*(?:${uuid}|${tempId})\\b`, 'g'), '')
  out = out.replace(/\n{3,}/g, '\n\n').trim()
  return out
}

/**
 * 聊天动作逻辑 composable
 */
export function useChatActions(options: AIRequestOptions = {}) {
  const t = i18n.global.t
  const {
    chatHistory,
    currentAIResponse,
    currentThinkingContent,
    currentReasoningDetails,
    currentDiscussionSteps,
    currentTodoActions,
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
  const authStore = useAuthStore()

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
    isGenerating.value = true
    const generationSessionId = currentSessionId.value || getOrCreateCurrentSession().id // 捕获发起生成的会话 ID

    // 创建用户消息
    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: prompt,
      images,
      createdAt: new Date(),
    }

    // 立即更新到指定会话
    if (generationSessionId) {
      addSessionMessage(generationSessionId, userMessage)
    }

    currentAssistantMessageId.value = generateId()
    currentAIResponse.value = t('ai.generatingImage')

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
          addSessionMessage(generationSessionId, aiMessage)
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
      isGenerating.value = false
      currentAssistantMessageId.value = null
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
    const MAX_ITERATIONS = 5

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

    if (iteration >= MAX_ITERATIONS) {
      console.warn('Max iterations reached, stopping tool loop.')
      isGenerating.value = false
      return
    }

    const aiConfig = getAIConfig()

    if (aiConfig.enableImageGeneration) {
      return generateImage(content.trim(), images)
    }

    clearError()
    resetStreamingState()
    const generationSessionId = currentSessionId.value || getOrCreateCurrentSession().id // 捕获发起生成的会话 ID

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

      // 立即更新到指定会话
      if (generationSessionId) {
        addSessionMessage(generationSessionId, userMessage)
      }
    }

    isGenerating.value = true
    const assistantMessageId = generateId()
    currentAssistantMessageId.value = assistantMessageId

    try {
      const handleChunk = (chunk: string) => {
        if (chunk === '[DONE]') {
          if (currentAIResponse.value) {
            const parsed = parseAssistantBlocks(currentAIResponse.value, {
              enableTodoActions: aiConfig.todoAssistant,
            })

            if (aiConfig.todoAssistant && parsed.todoActions) {
              const proposedActions: ProposedTodoChange[] = parsed.todoActions.map((action) => ({
                ...action,
                id: action.id || generateId(),
              }))
              currentTodoActions.value = proposedActions
              todoStore.setProposedChanges(assistantMessageId, proposedActions)
            }

            const teachingQuizzes: TeachingQuiz[] | undefined = parsed.teachingQuizzes
            currentAIResponse.value = parsed.cleanText
            if (aiConfig.todoAssistant && currentAIResponse.value) {
              currentAIResponse.value = stripTodoIdsFromText(currentAIResponse.value)
            }
            const structuredBlockErrors = parsed.errors.length > 0 ? [...parsed.errors] : undefined
            const pendingStructuredBlocks =
              parsed.pendingStructuredBlocks.length > 0
                ? [...parsed.pendingStructuredBlocks]
                : undefined

            const aiMessage: ChatMessage = {
              id: assistantMessageId,
              role: 'assistant',
              content: currentAIResponse.value,
              thinkingContent: currentThinkingContent.value || undefined,
              reasoning_details: currentReasoningDetails.value || undefined,
              discussionSteps:
                currentDiscussionSteps.value.length > 0
                  ? [...currentDiscussionSteps.value]
                  : undefined,
              todoActions:
                currentTodoActions.value.length > 0 ? [...currentTodoActions.value] : undefined,
              teachingQuizzes,
              structuredBlockErrors,
              pendingStructuredBlocks,
              createdAt: new Date(),
            }

            // 使用捕获的会话 ID 进行更新，防止切换会话后存错位置
            if (generationSessionId) {
              addSessionMessage(generationSessionId, aiMessage)
            }

            if (isMemoryEnabled.value && generationSessionId) {
              const session = sessions.value.find((s) => s.id === generationSessionId)
              const newHistory = session?.messages ?? []
              void extractAndStoreMemories(newHistory)
            }
          }
          resetStreamingState()
          isGenerating.value = false
        } else if (chunk === '[ABORTED]') {
          if (currentAIResponse.value) {
            const aiMessage: ChatMessage = {
              id: assistantMessageId,
              role: 'assistant',
              content: currentAIResponse.value + `\n\n*${t('ai.aborted')}*`,
              thinkingContent: currentThinkingContent.value || undefined,
              reasoning_details: currentReasoningDetails.value || undefined,
              discussionSteps:
                currentDiscussionSteps.value.length > 0
                  ? [...currentDiscussionSteps.value]
                  : undefined,
              createdAt: new Date(),
            }

            // 使用捕获的会话 ID 进行更新
            if (generationSessionId) {
              addSessionMessage(generationSessionId, aiMessage)
            }
          }
          resetStreamingState()
          isGenerating.value = false
        } else {
          currentAIResponse.value += chunk
        }
      }

      if (aiConfig.discussionMode && aiConfig.discussionModelIds.length > 0) {
        const { messagesForRequest, contextSummary } = await buildContextCompression(
          chatHistory.value,
        )
        await getMultiModelDiscussionStream(
          messagesForRequest,
          (steps) => {
            currentDiscussionSteps.value = steps
          },
          handleChunk,
          (thinking: string) => {
            currentThinkingContent.value += thinking
          },
          (details: string) => {
            currentReasoningDetails.value += details
          },
          {
            ...options,
            thinkingMode: getAIThinkingMode(),
            contextSummary,
            memorySnapshot: currentSession.value?.memorySnapshot,
          },
        )
      } else {
        const { messagesForRequest, contextSummary } = await buildContextCompression(
          chatHistory.value,
        )
        const { mcpApi } = await import('@/features/mcp/api/mcp')
        let mcpTools: McpToolResponse[] = []
        if (aiConfig.mcpEnabled && authStore.isAuthenticated) {
          try {
            mcpTools = await mcpApi.getAllTools()
          } catch (e) {
            console.error('Failed to fetch MCP tools:', e)
          }
        }

        const { aiTools, mcpToolLookup } = buildAiToolsFromMcpTools(mcpTools)

        const toolCalls: ToolCall[] = []

        await getAIStreamResponse(
          messagesForRequest,
          handleChunk,
          (thinking: string) => {
            currentThinkingContent.value += thinking
          },
          (details: string) => {
            currentReasoningDetails.value += details
          },
          {
            ...options,
            thinkingMode: getAIThinkingMode(),
            tools: aiTools.length > 0 ? aiTools : undefined,
            contextSummary,
            memorySnapshot: currentSession.value?.memorySnapshot,
          },
          (toolCall) => {
            toolCalls.push(toolCall)
          },
        )

        if (toolCalls.length > 0) {
          isGenerating.value = true
          await executeToolCalls({
            assistantMessageId,
            toolCalls,
            chatHistory,
            mcpToolLookup,
            callMcpTool: mcpApi.callTool,
          })
          return sendMessage('', undefined, undefined, true, iteration + 1)
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('ai.requestFailed')
      error.value = errorMessage

      if (retryCount.value < MAX_RETRIES) {
        retryCount.value++
        console.warn(`Retrying ${retryCount.value}/${MAX_RETRIES}...`)
        isGenerating.value = false
        await sendMessage(content, images, documents, true)
      } else {
        isGenerating.value = false
        resetStreamingState()
      }
    }
  }

  function stopGenerating(): void {
    abortCurrentRequest()
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

    const newHistory = [...chatHistory.value.slice(0, index)]
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
