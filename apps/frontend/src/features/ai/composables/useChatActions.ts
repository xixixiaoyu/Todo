import i18n from '@/i18n'
import {
  getAIStreamResponse,
  getMultiModelDiscussionStream,
  getAIImageResponse,
  abortCurrentRequest,
  generateId,
  type ChatMessage,
  type AIRequestOptions,
  type Tool,
  type ToolCall,
} from '@/features/ai/services/aiService'
import { useChatState } from './useChatState'
import { useChatMemory } from './useChatMemory'
import { useChatHistory } from './useChatHistory'
import { getAIThinkingMode, getAIConfig } from './useAIConfig'
import { useTodoStore, type ProposedTodoChange } from '@/features/todo/stores/todo'
import type { McpToolResponse } from '@/features/mcp/api/mcp'

const MAX_RETRIES = 3

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
  const { createSession } = useChatHistory()
  const todoStore = useTodoStore()

  /**
   * 生成 AI 图片
   */
  async function generateImage(prompt: string, images?: string[]): Promise<void> {
    if (!prompt.trim() || isGenerating.value) return

    clearError()
    isGenerating.value = true

    // 创建用户消息
    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: prompt,
      images,
      createdAt: new Date(),
    }
    chatHistory.value = [...chatHistory.value, userMessage]

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
        chatHistory.value = [...chatHistory.value, aiMessage]
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
      chatHistory.value = [...chatHistory.value, userMessage]
    }

    isGenerating.value = true
    currentAssistantMessageId.value = generateId()

    try {
      const handleChunk = (chunk: string) => {
        if (chunk === '[DONE]') {
          if (currentAIResponse.value) {
            if (aiConfig.todoAssistant) {
              const content = currentAIResponse.value
              const startTag = '[TODO_ACTIONS_START]'
              const endTag = '[TODO_ACTIONS_END]'

              if (content.includes(startTag) && content.includes(endTag)) {
                const startIndex = content.indexOf(startTag) + startTag.length
                const endIndex = content.indexOf(endTag)
                const jsonStr = content.substring(startIndex, endIndex).trim()

                try {
                  const actions = JSON.parse(jsonStr)
                  if (Array.isArray(actions)) {
                    const proposedActions: ProposedTodoChange[] = actions.map((action) => ({
                      ...action,
                      id: action.id || generateId(),
                    }))
                    currentTodoActions.value = proposedActions
                    todoStore.addProposedChanges(proposedActions)
                  }
                } catch (e) {
                  console.error('Failed to parse todo actions:', e)
                }

                currentAIResponse.value = (
                  content.substring(0, content.indexOf(startTag)) +
                  content.substring(endIndex + endTag.length)
                ).trim()
              }
            }

            const aiMessage: ChatMessage = {
              id: currentAssistantMessageId.value!,
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
              createdAt: new Date(),
            }
            const newHistory = [...chatHistory.value, aiMessage]
            chatHistory.value = newHistory

            if (isMemoryEnabled.value) {
              void extractAndStoreMemories(newHistory)
            }
          }
          resetStreamingState()
          isGenerating.value = false
        } else if (chunk === '[ABORTED]') {
          if (currentAIResponse.value) {
            const aiMessage: ChatMessage = {
              id: currentAssistantMessageId.value!,
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
            chatHistory.value = [...chatHistory.value, aiMessage]
          }
          resetStreamingState()
          isGenerating.value = false
        } else {
          currentAIResponse.value += chunk
        }
      }

      if (aiConfig.discussionMode && aiConfig.discussionModelIds.length > 0) {
        await getMultiModelDiscussionStream(
          chatHistory.value,
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
          },
        )
      } else {
        const { mcpApi } = await import('@/features/mcp/api/mcp')
        let mcpTools: McpToolResponse[] = []
        if (aiConfig.mcpEnabled) {
          try {
            mcpTools = await mcpApi.getAllTools()
          } catch (e) {
            console.error('Failed to fetch MCP tools:', e)
          }
        }

        const aiTools: Tool[] = mcpTools.map((t) => ({
          type: 'function',
          function: {
            name: t.name,
            description: t.description,
            parameters: t.inputSchema,
          },
        }))

        const toolCalls: ToolCall[] = []

        await getAIStreamResponse(
          chatHistory.value,
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
          },
          (toolCall) => {
            toolCalls.push(toolCall)
          },
        )

        if (toolCalls.length > 0) {
          isGenerating.value = true
          const lastMsg = chatHistory.value[chatHistory.value.length - 1]
          const currentId = currentAssistantMessageId.value

          if (lastMsg && lastMsg.role === 'assistant' && lastMsg.id === currentId) {
            lastMsg.tool_calls = toolCalls
            chatHistory.value = [...chatHistory.value]
          } else {
            const assistantMessage: ChatMessage = {
              id: currentId || generateId(),
              role: 'assistant',
              content: currentAIResponse.value,
              tool_calls: toolCalls,
              createdAt: new Date(),
            }
            chatHistory.value = [...chatHistory.value, assistantMessage]
          }

          for (const call of toolCalls) {
            const toolName = call.function.name
            const toolArgs = JSON.parse(call.function.arguments || '{}')
            const mcpTool = mcpTools.find((t) => t.name === toolName)
            if (mcpTool && mcpTool.serverId) {
              try {
                const result = await mcpApi.callTool(mcpTool.serverId, toolName, toolArgs)
                let contentStr = JSON.stringify(result.content)
                const MAX_TOOL_CONTENT_LENGTH = 15000

                if (contentStr.length > MAX_TOOL_CONTENT_LENGTH) {
                  console.warn(`Tool result too large (${contentStr.length} chars), truncating...`)
                  contentStr =
                    contentStr.substring(0, MAX_TOOL_CONTENT_LENGTH) +
                    '\n\n... (Result truncated due to length) ...'
                }

                const toolResult: ChatMessage = {
                  id: generateId(),
                  role: 'tool',
                  tool_call_id: call.id,
                  toolName,
                  content: contentStr,
                  createdAt: new Date(),
                }
                chatHistory.value = [...chatHistory.value, toolResult]
              } catch (error) {
                const toolError: ChatMessage = {
                  id: generateId(),
                  role: 'tool',
                  tool_call_id: call.id,
                  toolName,
                  content: `Error: ${error instanceof Error ? error.message : String(error)}`,
                  createdAt: new Date(),
                }
                chatHistory.value = [...chatHistory.value, toolError]
              }
            } else {
              const toolNotFound: ChatMessage = {
                id: generateId(),
                role: 'tool',
                tool_call_id: call.id,
                toolName,
                content: `Error: Tool ${toolName} not found or server not identified.`,
                createdAt: new Date(),
              }
              chatHistory.value = [...chatHistory.value, toolNotFound]
            }
          }
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

  return {
    sendMessage,
    generateImage,
    stopGenerating,
    clearHistory,
    deleteMessage,
    regenerateMessage,
    regenerateLastResponse,
    editAndResendMessage,
  }
}
