import type { ToolCallResult } from '@/features/mcp/api/mcp'
import { generateId } from '@/features/ai/services/aiService'
import type { ChatMessage, DiscussionStep, ToolCall } from '@/features/ai/services/aiService'
import { classifyPermission } from './useToolPermission'

const MAX_TOOL_CONTENT_LENGTH = 15000

export function parseToolArgs(input: string): Record<string, unknown> | null {
  try {
    const cleaned = (input || '').trim()
    const parsed = JSON.parse(cleaned || '{}') as unknown
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
  discussionSteps?: DiscussionStep[]
  chatHistory: { value: ChatMessage[] }
  mcpToolLookup: Map<string, { serverId: string; toolName: string }>
  localToolHandlers?: Map<string, (args: Record<string, unknown>) => string | Promise<string>>
  callMcpTool: (
    serverId: string,
    toolName: string,
    args: Record<string, unknown>,
  ) => Promise<ToolCallResult>
  permissionMode?: 'operate' | 'ask' | 'read_only'
  onPermissionAsk?: (
    toolName: string,
    toolArgs: Record<string, unknown>,
  ) => Promise<'allow' | 'deny'>
}) {
  const index = params.chatHistory.value.findIndex(
    (m) => m.id === params.assistantMessageId && m.role === 'assistant',
  )

  if (index > -1) {
    params.chatHistory.value[index] = {
      ...params.chatHistory.value[index],
      thinkingContent:
        params.chatHistory.value[index].thinkingContent ||
        params.assistantThinkingContent ||
        params.assistantReasoningDetails,
      reasoning_details:
        params.chatHistory.value[index].reasoning_details || params.assistantReasoningDetails,
      discussionSteps: params.chatHistory.value[index].discussionSteps || params.discussionSteps,
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
        thinkingContent: params.assistantThinkingContent || params.assistantReasoningDetails,
        reasoning_details: params.assistantReasoningDetails,
        discussionSteps: params.discussionSteps,
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
        // 权限检查
        if (params.permissionMode) {
          const decision = classifyPermission(aiToolName, params.permissionMode)
          if (decision.action === 'deny') {
            params.chatHistory.value = [
              ...params.chatHistory.value,
              {
                id: generateId(),
                role: 'tool',
                tool_call_id: call.id,
                toolName: aiToolName,
                content: `Blocked: ${decision.reason || 'Permission denied.'}`,
                createdAt: new Date(),
              },
            ]
            continue
          }
          if (decision.action === 'ask' && params.onPermissionAsk) {
            const allowed = await params.onPermissionAsk(aiToolName, toolArgs)
            if (allowed === 'deny') {
              params.chatHistory.value = [
                ...params.chatHistory.value,
                {
                  id: generateId(),
                  role: 'tool',
                  tool_call_id: call.id,
                  toolName: aiToolName,
                  content: 'User denied the tool execution.',
                  createdAt: new Date(),
                },
              ]
              continue
            }
          }
        }

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
      let contentStr: string
      if (result.isError) {
        contentStr = `MCP Tool Error: ${JSON.stringify(result.content)}`
        console.warn(
          `[ToolCall] MCP tool "${mcpTool.toolName}" on server "${mcpTool.serverId}" returned isError=true:`,
          result.content,
        )
      } else {
        contentStr = JSON.stringify(result.content)
      }
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
