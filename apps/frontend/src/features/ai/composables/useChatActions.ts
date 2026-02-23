import i18n from '@/i18n'
import {
  getAIStreamResponse,
  getMultiModelDiscussionStream,
  getAIImageResponse,
  getAIStaticResponse,
  abortCurrentRequest,
  generateId,
  parseAssistantBlocks,
  type ChatMessage,
  type TeachingQuiz,
  type AIRequestOptions,
  type Tool,
  type ToolCall,
} from '@/features/ai/services/aiService'
import { useChatState } from './useChatState'
import { useChatMemory } from './useChatMemory'
import { useChatHistory, type ChatSession } from './useChatHistory'
import { getAIThinkingMode, getAIConfig, getAIPresets, type AIConfig } from './useAIConfig'
import { useTodoStore, type ProposedTodoChange } from '@/features/todo/stores/todo'
import type { McpToolResponse } from '@/features/mcp/api/mcp'

const MAX_RETRIES = 3
const compressingSessionIds = new Set<string>()

const DEFAULT_CONTEXT_COMPRESSION_TRIGGER_CHARS = 24000
const SUMMARY_MAX_CHARS = 2400
const SUMMARY_INPUT_MAX_CHARS_PER_MESSAGE = 2000
const REQUEST_MAX_DOCUMENT_CHARS_PER_DOC = 8000

function truncateText(input: string, maxChars: number): string {
  if (input.length <= maxChars) return input
  return `${input.slice(0, maxChars)}\n\n…(truncated)…`
}

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

function estimateMessageSize(msg: ChatMessage): number {
  const base = msg.content?.length ?? 0
  const docs = (msg.documents ?? []).reduce((acc, d) => acc + d.name.length + d.content.length, 0)
  const images = (msg.images ?? []).reduce((acc, url) => acc + url.length, 0)
  const toolName = msg.toolName?.length ?? 0
  const toolCalls = (msg.tool_calls ?? []).reduce(
    (acc, call) => acc + call.function.name.length + call.function.arguments.length,
    0,
  )
  return base + docs + images + toolName + toolCalls
}

function estimateHistorySize(messages: ChatMessage[]): number {
  return messages.reduce((acc, m) => acc + estimateMessageSize(m), 0)
}

function normalizeMessagesForRequest(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((m) => {
    if (!m.documents || m.documents.length === 0) return m

    return {
      ...m,
      documents: m.documents.map((d) => ({
        name: d.name,
        content: truncateText(d.content, REQUEST_MAX_DOCUMENT_CHARS_PER_DOC),
      })),
    }
  })
}

function findTailStartIndexByCharBudget(messages: ChatMessage[], budgetChars: number): number {
  if (budgetChars <= 0) return Math.max(0, messages.length - 1)
  if (messages.length <= 1) return 0

  let size = 0
  for (let i = messages.length - 1; i >= 0; i--) {
    const next = size + estimateMessageSize(messages[i])
    if (next > budgetChars) {
      return i === messages.length - 1 ? i : i + 1
    }
    size = next
  }

  return 0
}

function formatMessagesForSummary(messages: ChatMessage[]): string {
  return messages
    .map((m) => {
      const role = m.role === 'tool' ? `tool:${m.toolName || 'unknown'}` : m.role
      const content = truncateText(m.content || '', SUMMARY_INPUT_MAX_CHARS_PER_MESSAGE)
      const docs = (m.documents ?? [])
        .map(
          (d) =>
            `<document name="${d.name.replace(/\s+/g, ' ').slice(0, 120)}">\n${truncateText(d.content, 1200)}\n</document>`,
        )
        .join('\n\n')
      const body = docs ? `${content}\n\n[documents]\n${docs}\n[/documents]` : content
      return `【${role}】\n${body}`
    })
    .join('\n\n---\n\n')
}

/**
 * 后台压缩逻辑
 */
async function compressInBackground(
  session: ChatSession,
  segment: ChatMessage[],
  currentSummary: string,
  aiConfig: AIConfig,
  updateSessionContextSummary: (
    sessionId: string,
    context: { summary: string; untilMessageId: string },
  ) => void,
) {
  try {
    const inputText = formatMessagesForSummary(segment)
    const system =
      '你是一个上下文压缩器。目标：将早期对话压缩为高密度摘要，供后续对话继续使用。\n' +
      '要求：\n' +
      '- 输出中文，结构化，控制在 20 条以内的要点。\n' +
      '- 只保留：用户目标、约束/偏好、关键结论、已做决定、重要实体（如文件路径/ID/命令）。\n' +
      '- 严禁包含逐字转录、长段代码或长工具输出。\n' +
      '- 如果信息不足以确定某结论，明确标记为“未确认”。'

    const user =
      (currentSummary
        ? `【已存在摘要】\n${currentSummary}\n\n请在此基础上增量更新摘要。\n\n`
        : '') + `【新增对话片段】\n${inputText}`

    const modelOptions = (() => {
      if (!aiConfig.contextCompressionModelId) return {}
      const preset = getAIPresets().find((p) => p.id === aiConfig.contextCompressionModelId)
      if (!preset) return {}
      return {
        baseUrl: preset.baseUrl,
        apiKey: preset.apiKey,
        model: preset.model,
      }
    })()

    const res = await getAIStaticResponse(
      [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      {
        ...modelOptions,
        temperature: 0.2,
      },
    )

    const nextSummary = truncateText((res.content || '').trim(), SUMMARY_MAX_CHARS)
    if (nextSummary) {
      const untilMessageId = segment[segment.length - 1].id
      updateSessionContextSummary(session.id, { summary: nextSummary, untilMessageId })
    }
  } catch (err) {
    console.warn(`[ContextCompression] Failed for session ${session.id}:`, err)
  }
}

function fnv1a(input: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16)
}

function buildMcpAiToolName(serverId: string, toolName: string): string {
  const safeServer = serverId.slice(0, 8).replace(/[^a-zA-Z0-9_-]/g, '_')
  const safeTool = toolName.replace(/[^a-zA-Z0-9_-]/g, '_')
  const prefix = `mcp_${safeServer}_`
  const full = `${prefix}${safeTool}`

  if (full.length <= 64) return full

  const hash = fnv1a(`${serverId}:${toolName}`).slice(0, 8)
  const keep = Math.max(0, 64 - prefix.length - 1 - hash.length)
  return `${prefix}${safeTool.slice(0, keep)}_${hash}`.slice(0, 64)
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
  const { createSession, currentSession, updateSessionContextSummary, clearSessionContextSummary } =
    useChatHistory()
  const todoStore = useTodoStore()

  async function buildContextCompression(messages: ChatMessage[]): Promise<{
    messagesForRequest: ChatMessage[]
    contextSummary?: string
  }> {
    const aiConfig = getAIConfig()
    const enabled = aiConfig.contextCompressionEnabled !== false
    if (!enabled) {
      return { messagesForRequest: normalizeMessagesForRequest(messages) }
    }

    const triggerChars =
      aiConfig.contextCompressionTriggerChars ?? DEFAULT_CONTEXT_COMPRESSION_TRIGGER_CHARS

    const session = currentSession.value
    const hasSummary = !!session?.contextSummary?.trim()
    const size = estimateHistorySize(messages)

    const keepStartIndex = findTailStartIndexByCharBudget(messages, triggerChars)
    const keepMessages = messages.slice(keepStartIndex)

    if (size <= triggerChars && !hasSummary) {
      return { messagesForRequest: normalizeMessagesForRequest(messages) }
    }

    if (!session) {
      return { messagesForRequest: normalizeMessagesForRequest(keepMessages) }
    }

    const summary = session.contextSummary?.trim() || ''
    let summaryUntilIndex = -1

    if (session.contextSummaryUntilMessageId) {
      summaryUntilIndex = messages.findIndex((m) => m.id === session.contextSummaryUntilMessageId)
      if (summaryUntilIndex === -1) {
        clearSessionContextSummary(session.id)
      }
    }

    const segmentStart = Math.max(0, summaryUntilIndex + 1)
    const segmentEnd = Math.max(0, keepStartIndex)
    const segment = segmentEnd > segmentStart ? messages.slice(segmentStart, segmentEnd) : []

    // 检查是否正在压缩，避免重复触发
    if (compressingSessionIds.has(session.id)) {
      return { messagesForRequest: normalizeMessagesForRequest(messages) }
    }

    if (segment.length > 0) {
      // 标记开始压缩
      compressingSessionIds.add(session.id)

      // 异步执行压缩，不阻塞当前请求
      // Fire-and-forget: 我们不 await 这个 promise
      void compressInBackground(
        session,
        segment,
        summary,
        aiConfig,
        updateSessionContextSummary,
      ).finally(() => {
        compressingSessionIds.delete(session.id)
      })
    }

    return {
      messagesForRequest: normalizeMessagesForRequest(segment.length > 0 ? messages : keepMessages),
      contextSummary: summary || undefined,
    }
  }

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
            chatHistory.value = [...chatHistory.value, aiMessage]
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
          },
        )
      } else {
        const { messagesForRequest, contextSummary } = await buildContextCompression(
          chatHistory.value,
        )
        const { mcpApi } = await import('@/features/mcp/api/mcp')
        let mcpTools: McpToolResponse[] = []
        if (aiConfig.mcpEnabled) {
          try {
            mcpTools = await mcpApi.getAllTools()
          } catch (e) {
            console.error('Failed to fetch MCP tools:', e)
          }
        }

        const mcpToolLookup = new Map<string, { serverId: string; toolName: string }>()

        const aiTools: Tool[] = mcpTools
          .filter((t) => !!t.serverId)
          .map((t) => {
            const serverId = t.serverId as string
            const aiName = buildMcpAiToolName(serverId, t.name)
            mcpToolLookup.set(aiName, { serverId, toolName: t.name })
            return {
              type: 'function',
              function: {
                name: aiName,
                description: t.description,
                parameters: t.inputSchema,
              },
            }
          })

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
          },
          (toolCall) => {
            toolCalls.push(toolCall)
          },
        )

        if (toolCalls.length > 0) {
          isGenerating.value = true
          const index = chatHistory.value.findIndex(
            (m) => m.id === assistantMessageId && m.role === 'assistant',
          )

          if (index > -1) {
            chatHistory.value[index] = {
              ...chatHistory.value[index],
              tool_calls: toolCalls,
            }
            chatHistory.value = [...chatHistory.value]
          } else {
            chatHistory.value = [
              ...chatHistory.value,
              {
                id: assistantMessageId,
                role: 'assistant',
                content: '',
                tool_calls: toolCalls,
                createdAt: new Date(),
              },
            ]
          }

          for (const call of toolCalls) {
            const aiToolName = call.function.name
            let toolArgs: Record<string, unknown> = {}
            try {
              const parsed = JSON.parse(call.function.arguments || '{}') as unknown
              if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                toolArgs = parsed as Record<string, unknown>
              }
            } catch {
              const toolBadArgs: ChatMessage = {
                id: generateId(),
                role: 'tool',
                tool_call_id: call.id,
                toolName: aiToolName,
                content: 'Error: Invalid tool arguments JSON.',
                createdAt: new Date(),
              }
              chatHistory.value = [...chatHistory.value, toolBadArgs]
              continue
            }

            const mcpTool = mcpToolLookup.get(aiToolName)
            if (mcpTool) {
              try {
                const result = await mcpApi.callTool(mcpTool.serverId, mcpTool.toolName, toolArgs)
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
                  toolName: mcpTool.toolName,
                  content: contentStr,
                  createdAt: new Date(),
                }
                chatHistory.value = [...chatHistory.value, toolResult]
              } catch (error) {
                const toolError: ChatMessage = {
                  id: generateId(),
                  role: 'tool',
                  tool_call_id: call.id,
                  toolName: mcpTool.toolName,
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
                toolName: aiToolName,
                content: `Error: Tool ${aiToolName} not found or server not identified.`,
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
