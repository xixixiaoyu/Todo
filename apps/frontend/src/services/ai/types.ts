/**
 * AI 服务相关类型定义
 */

export interface ReasoningDetailItem {
  type?: string
  text?: string
  [key: string]: unknown
}

export interface DiscussionStep {
  modelId: string
  modelName: string
  content: string
  status: 'thinking' | 'done' | 'error'
}

export interface ToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export interface ToolResult {
  role: 'tool'
  tool_call_id: string
  content: string
}

export interface Tool {
  type: 'function'
  function: {
    name: string
    description?: string
    parameters: Record<string, unknown>
  }
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  tool_calls?: ToolCall[]
  tool_call_id?: string // 用于 role: 'tool'
  images?: string[] // 图片 URL 或 base64
  documents?: { name: string; content: string }[] // 解析后的文档内容
  thinkingContent?: string
  reasoning_details?: string
  discussionSteps?: DiscussionStep[]
  todoActions?: import('@/features/todo/stores/todo').ProposedTodoChange[] // AI 建议的 Todo 变更
  todoActionsProcessed?: 'applied' | 'discarded' // AI 建议的处理状态
  isStreaming?: boolean
  createdAt?: Date
}

export interface AIRequestOptions {
  model?: string
  baseUrl?: string
  apiKey?: string
  temperature?: number
  maxTokens?: number
  systemPrompt?: string
  thinkingMode?: 'enabled' | 'disabled'
  tools?: Tool[]
  toolChoice?: 'none' | 'auto' | 'required' | { type: 'function'; function: { name: string } }
}

export interface MultiModalContent {
  type: 'text' | 'image_url'
  text?: string
  image_url?: {
    url: string
  }
}
