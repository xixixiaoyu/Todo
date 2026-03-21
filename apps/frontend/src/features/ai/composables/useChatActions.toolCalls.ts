import { generateId, type ChatMessage, type ToolCall } from '@/features/ai/services/aiService'

const MAX_TOOL_CONTENT_LENGTH = 15000

function parseToolArgs(input: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(input || '{}') as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
    return {}
  } catch {
    return null
  }
}

function truncateToolContent(input: string): string {
  if (input.length <= MAX_TOOL_CONTENT_LENGTH) return input
  console.warn(`Tool result too large (${input.length} chars), truncating...`)
  return (
    input.substring(0, MAX_TOOL_CONTENT_LENGTH) + '\n\n... (Result truncated due to length) ...'
  )
}

export async function executeToolCalls(params: {
  assistantMessageId: string
  toolCalls: ToolCall[]
  assistantThinkingContent?: string
  assistantReasoningDetails?: string
  chatHistory: { value: ChatMessage[] }
  mcpToolLookup: Map<string, { serverId: string; toolName: string }>
  localToolHandlers?: Map<string, (args: Record<string, unknown>) => string | Promise<string>>
  callMcpTool: (
    serverId: string,
    toolName: string,
    args: Record<string, unknown>,
  ) => Promise<{ content: unknown }>
}) {
  const index = params.chatHistory.value.findIndex(
    (m) => m.id === params.assistantMessageId && m.role === 'assistant',
  )

  if (index > -1) {
    params.chatHistory.value[index] = {
      ...params.chatHistory.value[index],
      thinkingContent:
        params.chatHistory.value[index].thinkingContent || params.assistantThinkingContent,
      reasoning_details:
        params.chatHistory.value[index].reasoning_details || params.assistantReasoningDetails,
      tool_calls: params.toolCalls,
    }
    params.chatHistory.value = [...params.chatHistory.value]
  } else {
    params.chatHistory.value = [
      ...params.chatHistory.value,
      {
        id: params.assistantMessageId,
        role: 'assistant',
        content: '',
        thinkingContent: params.assistantThinkingContent,
        reasoning_details: params.assistantReasoningDetails,
        tool_calls: params.toolCalls,
        createdAt: new Date(),
      },
    ]
  }

  for (const call of params.toolCalls) {
    const aiToolName = call.function.name
    const toolArgs = parseToolArgs(call.function.arguments || '')
    if (!toolArgs) {
      params.chatHistory.value = [
        ...params.chatHistory.value,
        {
          id: generateId(),
          role: 'tool',
          tool_call_id: call.id,
          toolName: aiToolName,
          content: 'Error: Invalid tool arguments JSON.',
          createdAt: new Date(),
        },
      ]
      continue
    }

    const localHandler = params.localToolHandlers?.get(aiToolName)
    if (localHandler) {
      try {
        let contentStr = await localHandler(toolArgs)
        contentStr = truncateToolContent(contentStr)
        params.chatHistory.value = [
          ...params.chatHistory.value,
          {
            id: generateId(),
            role: 'tool',
            tool_call_id: call.id,
            toolName: aiToolName,
            content: contentStr,
            createdAt: new Date(),
          },
        ]
      } catch (error) {
        params.chatHistory.value = [
          ...params.chatHistory.value,
          {
            id: generateId(),
            role: 'tool',
            tool_call_id: call.id,
            toolName: aiToolName,
            content: `Error: ${error instanceof Error ? error.message : String(error)}`,
            createdAt: new Date(),
          },
        ]
      }
      continue
    }

    const mcpTool = params.mcpToolLookup.get(aiToolName)
    if (!mcpTool) {
      params.chatHistory.value = [
        ...params.chatHistory.value,
        {
          id: generateId(),
          role: 'tool',
          tool_call_id: call.id,
          toolName: aiToolName,
          content: `Error: Tool ${aiToolName} not found or server not identified.`,
          createdAt: new Date(),
        },
      ]
      continue
    }

    try {
      const result = await params.callMcpTool(mcpTool.serverId, mcpTool.toolName, toolArgs)
      let contentStr = JSON.stringify(result.content)
      contentStr = truncateToolContent(contentStr)
      params.chatHistory.value = [
        ...params.chatHistory.value,
        {
          id: generateId(),
          role: 'tool',
          tool_call_id: call.id,
          toolName: mcpTool.toolName,
          content: contentStr,
          createdAt: new Date(),
        },
      ]
    } catch (error) {
      params.chatHistory.value = [
        ...params.chatHistory.value,
        {
          id: generateId(),
          role: 'tool',
          tool_call_id: call.id,
          toolName: mcpTool.toolName,
          content: `Error: ${error instanceof Error ? error.message : String(error)}`,
          createdAt: new Date(),
        },
      ]
    }
  }
}
